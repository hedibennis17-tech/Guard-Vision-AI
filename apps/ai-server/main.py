"""
Vision Guard AI Server
YOLOv11 + ByteTrack + OCR (optionnel) + Firebase
"""
import asyncio, base64, time, json, os
from typing import Optional, List, Dict, Any

import numpy as np
import cv2
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from loguru import logger

from config.settings import settings
from detection.yolo_detector import get_detector
from tracking.bytetrack import get_tracker
from firebase.firestore_client import get_firestore

app = FastAPI(title="Vision Guard AI Server", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Startup ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    logger.info("🚀 Vision Guard AI Server démarrage...")
    detector  = get_detector()
    tracker   = get_tracker()
    firestore = get_firestore()
    logger.success(
        f"✅ Prêt — YOLO:{detector.loaded} | Firebase:{firestore.connected}"
    )

# ── Health / Status ───────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": time.time()}

@app.get("/")
async def root():
    detector  = get_detector()
    firestore = get_firestore()

    # Test OCR optionnel
    ocr_loaded = False
    try:
        from ocr.paddle_ocr import get_ocr
        ocr_loaded = get_ocr()._loaded
    except Exception: pass

    # Test Shoplifting optionnel
    shoplifting_loaded = False
    try:
        from detection.shoplifting_detector import get_shoplifting_detector
        shoplifting_loaded = get_shoplifting_detector().loaded
    except Exception: pass

    return {
        "service": "Vision Guard AI Server",
        "version": "1.0.0",
        "status":  "operational",
        "models": {
            "yolov11":    {"loaded": detector.loaded,       "models": list(detector.models.keys())},
            "bytetrack":  {"loaded": True,                  "note":   "Intégré via ultralytics"},
            "paddleocr":  {"loaded": ocr_loaded,            "note":   "Optionnel — installez PaddleOCR séparément"},
            "shoplifting":{"loaded": shoplifting_loaded,    "note":   "Nécessite shoplifting_wights.pt dans models/"},
            "clip":       {"loaded": False,                 "note":   "GPU requis"},
            "sam2":       {"loaded": False,                 "note":   "GPU requis"},
        },
        "firebase": {"connected": firestore.connected, "project": settings.FIREBASE_PROJECT_ID},
    }

# ── Modèles de requêtes ────────────────────────────────────────────────────────

class DetectRequest(BaseModel):
    image:           str
    module_id:       str  = "general"
    organization_id: str  = ""
    camera_id:       str  = ""
    confidence:      Optional[float] = None
    run_ocr:         bool = False
    run_tracking:    bool = True
    save_to_firebase:bool = False

class PipelineRequest(BaseModel):
    image:           str
    organization_id: str
    camera_id:       str
    module_id:       str  = "general"
    confidence:      Optional[float] = None
    save_firebase:   bool = True

# ── Endpoints détection ───────────────────────────────────────────────────────

@app.post("/detect")
async def detect_image(req: DetectRequest):
    start    = time.time()
    detector = get_detector()
    if not detector.loaded:
        raise HTTPException(503, "YOLOv11 non chargé — vérifiez les logs")

    dets = detector.detect(req.image, req.module_id, req.confidence)

    if req.run_tracking and req.camera_id and dets:
        tracker = get_tracker()
        dets    = tracker.update(req.camera_id, dets)

    # OCR optionnel
    ocr_results = []
    if req.run_ocr and dets:
        try:
            from ocr.paddle_ocr import get_ocr
            ocr = get_ocr()
            img = detector._decode_image(req.image)
            if img is not None:
                for det in dets:
                    if "plate" in det.get("class", ""):
                        x1,y1,x2,y2 = det["bbox"]
                        crop   = img[y1:y2, x1:x2]
                        result = ocr.read_license_plate(crop)
                        if result: det["ocr"] = result; ocr_results.append(result)
        except Exception as e:
            logger.warning(f"OCR non disponible: {e}")

    # Firebase
    if req.save_to_firebase and req.organization_id and req.camera_id:
        fs = get_firestore()
        for det in dets[:5]:
            det_id = fs.write_detection(req.organization_id, req.camera_id, det)
            if det_id and det.get("alert"):
                ev_id = fs.write_event(req.organization_id, req.camera_id, det_id, det)
                if ev_id: fs.write_notification(req.organization_id, ev_id, det)

    return {
        "detections":   dets,
        "count":        len(dets),
        "alerts":       [d for d in dets if d.get("alert")],
        "critical":     [d for d in dets if d.get("severity")=="critical"],
        "ocr_results":  ocr_results,
        "module":       req.module_id,
        "inference_ms": round((time.time()-start)*1000),
        "model":        settings.YOLO_MODEL,
    }

@app.post("/pipeline/run")
async def run_pipeline(req: PipelineRequest):
    start    = time.time()
    detector = get_detector()
    tracker  = get_tracker()
    fs       = get_firestore()

    dets = detector.detect(req.image, req.module_id, req.confidence)
    if dets: dets = tracker.update(req.camera_id, dets)

    saved_events = []
    if req.save_firebase:
        for det in dets:
            det_id = fs.write_detection(req.organization_id, req.camera_id, det)
            if det_id and det.get("severity") in ["warning","critical"]:
                ev_id = fs.write_event(req.organization_id, req.camera_id, det_id, det)
                if ev_id:
                    fs.write_notification(req.organization_id, ev_id, det)
                    saved_events.append(ev_id)

    return {
        "success":      True,
        "detections":   dets,
        "count":        len(dets),
        "events_saved": saved_events,
        "module":       req.module_id,
        "inference_ms": round((time.time()-start)*1000),
    }

@app.post("/detect/shoplifting")
async def detect_shoplifting(
    image:           str  = "",
    organization_id: str  = "",
    camera_id:       str  = "",
    confidence:      float= 0.50,
    save_firebase:   bool = False,
):
    try:
        from detection.shoplifting_detector import get_shoplifting_detector
        detector = get_shoplifting_detector()
    except Exception as e:
        return JSONResponse({"error": f"Module shoplifting non disponible: {e}"}, status_code=503)

    if not detector.loaded:
        return JSONResponse({
            "error":    "Modèle shoplifting non chargé",
            "solution": "Placez shoplifting_wights.pt dans models/",
            "status":   detector.status,
        }, status_code=503)

    start = time.time()
    dets  = detector.detect_b64(image, confidence)
    shoplifting = any(d["class"]=="shoplifting" for d in dets)

    events = []
    if save_firebase and organization_id and camera_id:
        fs = get_firestore()
        for det in dets:
            if det.get("alert"):
                det_id = fs.write_detection(organization_id, camera_id, det)
                if det_id:
                    ev_id = fs.write_event(organization_id, camera_id, det_id, det)
                    if ev_id:
                        fs.write_notification(organization_id, ev_id, det)
                        events.append(ev_id)

    return {
        "shoplifting_detected": shoplifting,
        "status":       "SHOPLIFTING" if shoplifting else "NORMAL",
        "detections":   dets,
        "events":       events,
        "inference_ms": round((time.time()-start)*1000),
    }

@app.post("/detect/upload")
async def detect_upload(
    file:            UploadFile = File(...),
    module_id:       str        = Form("general"),
    organization_id: str        = Form(""),
    camera_id:       str        = Form(""),
):
    contents = await file.read()
    b64      = base64.b64encode(contents).decode()
    req = DetectRequest(
        image=b64, module_id=module_id,
        organization_id=organization_id, camera_id=camera_id,
        run_tracking=bool(camera_id),
        run_ocr=(module_id=="transportation"),
    )
    return await detect_image(req)

# ── WebSocket stream ──────────────────────────────────────────────────────────

@app.websocket("/ws/{camera_id}")
async def ws_stream(ws: WebSocket, camera_id: str):
    await ws.accept()
    detector = get_detector()
    tracker  = get_tracker()
    fs       = get_firestore()

    try:
        while True:
            raw     = await ws.receive_text()
            payload = json.loads(raw)
            image   = payload.get("image","")
            module  = payload.get("module_id","general")
            org     = payload.get("organization_id","")
            save    = payload.get("save_firebase", bool(org))
            if not image: continue

            start = time.time()
            dets  = detector.detect(image, module)
            if dets: dets = tracker.update(camera_id, dets)

            events = []
            if save and org:
                for det in dets:
                    if det.get("severity") in ["warning","critical"]:
                        det_id = fs.write_detection(org, camera_id, det)
                        if det_id:
                            ev_id = fs.write_event(org, camera_id, det_id, det)
                            if ev_id:
                                events.append(ev_id)
                                fs.write_notification(org, ev_id, det)

            await ws.send_json({
                "detections":   dets,
                "count":        len(dets),
                "alerts":       [d for d in dets if d.get("alert")],
                "events":       events,
                "module":       module,
                "inference_ms": round((time.time()-start)*1000),
                "timestamp":    time.time(),
            })
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WS error {camera_id}: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT,
                workers=1, log_level=settings.LOG_LEVEL)
