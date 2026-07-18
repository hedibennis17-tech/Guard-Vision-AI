"""
Vision Guard AI Server — FastAPI
Architecture: Caméra → WebSocket → YOLOv11 → ByteTrack → OCR → CLIP → Firebase

Endpoints:
  GET  /                     → Status + modèles chargés
  GET  /health               → Health check
  POST /detect               → Détection sur une image (base64/bytes)
  POST /detect/frame         → Détection frame + tracking + OCR
  WS   /ws/{camera_id}       → Stream temps réel
  GET  /models               → Liste des modèles disponibles
  POST /pipeline/run         → Pipeline complet (YOLO → Track → OCR → Firebase)
"""

import asyncio
import base64
import time
import json
import traceback
from typing import Optional, List, Dict, Any

import numpy as np
import cv2
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from loguru import logger

from config.settings import settings
from detection.yolo_detector import get_detector
from tracking.bytetrack import get_tracker
from ocr.paddle_ocr import get_ocr
from firebase.firestore_client import get_firestore

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Vision Guard AI Server",
    description="YOLOv11 + ByteTrack + PaddleOCR + CLIP — AI Vision Platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],     # En prod: mettre l'URL du dashboard Vercel
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Startup ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    logger.info("🚀 Vision Guard AI Server starting...")
    # Précharger les modèles
    detector  = get_detector()
    tracker   = get_tracker()
    ocr       = get_ocr()
    firestore = get_firestore()
    logger.success(
        f"✅ Server ready — "
        f"YOLO: {'✅' if detector.loaded else '❌'} | "
        f"OCR: {'✅' if ocr._loaded else '❌'} | "
        f"Firebase: {'✅' if firestore.connected else '❌'}"
    )

# ── Models de requêtes ────────────────────────────────────────────────────────

class DetectRequest(BaseModel):
    image:          str              # base64 image (avec ou sans header data:image/...)
    module_id:      str = "general"  # construction | industrial | retail | transportation
    organization_id:str = ""
    camera_id:      str = ""
    confidence:     Optional[float] = None
    run_ocr:        bool = False
    run_tracking:   bool = True
    save_to_firebase:bool = False

class PipelineRequest(BaseModel):
    image:          str
    organization_id:str
    camera_id:      str
    module_id:      str = "general"
    confidence:     Optional[float] = None
    save_firebase:  bool = True

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    detector  = get_detector()
    ocr       = get_ocr()
    firestore = get_firestore()
    return {
        "service":    "Vision Guard AI Server",
        "version":    "1.0.0",
        "status":     "operational",
        "models": {
            "yolov11":   {"loaded": detector.loaded, "models": list(detector.models.keys())},
            "bytetrack": {"loaded": True, "description": "Multi-object tracking"},
            "paddleocr": {"loaded": ocr._loaded, "language": settings.OCR_LANGUAGE},
            "clip":      {"loaded": False, "note": "GPU recommandé"},
            "sam2":      {"loaded": False, "note": "GPU requis"},
        },
        "firebase":   {"connected": firestore.connected, "project": settings.FIREBASE_PROJECT_ID},
        "settings": {
            "device":    settings.YOLO_DEVICE,
            "yolo_model":settings.YOLO_MODEL,
            "confidence":settings.YOLO_CONFIDENCE,
        }
    }

@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": time.time()}

@app.get("/models")
async def list_models():
    detector = get_detector()
    return {
        "available": list(detector.models.keys()),
        "yolo_model": settings.YOLO_MODEL,
        "device": settings.YOLO_DEVICE,
        "custom_models": [k for k in detector.models.keys() if k != "general"],
    }


@app.post("/detect")
async def detect_image(req: DetectRequest):
    """
    Détecte les objets dans une image base64.
    Point d'entrée principal pour le dashboard.
    """
    start = time.time()
    detector = get_detector()

    if not detector.loaded:
        raise HTTPException(503, "YOLOv11 non chargé")

    detections = detector.detect(req.image, req.module_id, req.confidence)

    # ByteTrack
    if req.run_tracking and req.camera_id and detections:
        tracker    = get_tracker()
        detections = tracker.update(req.camera_id, detections)

    # OCR
    ocr_results = []
    if req.run_ocr and detections:
        ocr = get_ocr()
        img = detector._decode_image(req.image)
        if img is not None:
            # OCR sur les zones de texte détectées
            plate_dets = [d for d in detections if d["class"] in ["license_plate","text"]]
            if plate_dets:
                for det in plate_dets:
                    x1,y1,x2,y2 = det["bbox"]
                    crop = img[y1:y2, x1:x2]
                    result = ocr.read_license_plate(crop)
                    if result:
                        det["ocr"] = result
                        ocr_results.append(result)

    # Sauvegarder dans Firebase
    if req.save_to_firebase and req.organization_id and req.camera_id:
        fs = get_firestore()
        for det in detections[:5]:  # max 5 par frame
            det_id = fs.write_detection(req.organization_id, req.camera_id, det)
            if det_id and det.get("alert"):
                ev_id = fs.write_event(req.organization_id, req.camera_id, det_id, det)
                if ev_id:
                    fs.write_notification(req.organization_id, ev_id, det)

    elapsed = round((time.time()-start)*1000)

    return {
        "detections":    detections,
        "count":         len(detections),
        "alerts":        [d for d in detections if d.get("alert")],
        "critical":      [d for d in detections if d.get("severity")=="critical"],
        "ocr_results":   ocr_results,
        "module":        req.module_id,
        "inference_ms":  elapsed,
        "model":         settings.YOLO_MODEL,
    }


@app.post("/pipeline/run")
async def run_pipeline(req: PipelineRequest):
    """
    Pipeline complet:
    Image → YOLOv11 → ByteTrack → OCR (si plaque) → Firebase → Response
    """
    start    = time.time()
    detector = get_detector()
    tracker  = get_tracker()
    ocr      = get_ocr()
    fs       = get_firestore()

    # 1. Détection YOLO
    detections = detector.detect(req.image, req.module_id, req.confidence)

    # 2. ByteTrack
    if detections:
        detections = tracker.update(req.camera_id, detections)

    # 3. OCR sur les plaques
    plate_results = []
    img = detector._decode_image(req.image)
    if img is not None:
        plate_dets = [d for d in detections if "plate" in d.get("class","")]
        for det in plate_dets:
            x1,y1,x2,y2 = det["bbox"]
            crop   = img[y1:y2, x1:x2]
            plate  = ocr.read_license_plate(crop)
            if plate:
                det["plate"] = plate
                plate_results.append(plate)

    # 4. Firebase
    saved_events = []
    if req.save_firebase:
        for det in detections:
            det_id = fs.write_detection(req.organization_id, req.camera_id, det)
            if det_id and det.get("severity") in ["warning","critical"]:
                ev_id = fs.write_event(req.organization_id, req.camera_id, det_id, det)
                if ev_id:
                    fs.write_notification(req.organization_id, ev_id, det)
                    saved_events.append(ev_id)

    elapsed = round((time.time()-start)*1000)

    return {
        "success":      True,
        "detections":   detections,
        "count":        len(detections),
        "events_saved": saved_events,
        "plates":       plate_results,
        "module":       req.module_id,
        "inference_ms": elapsed,
    }


# ── WebSocket — Stream temps réel ─────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.connections: Dict[str, WebSocket] = {}

    async def connect(self, camera_id: str, ws: WebSocket):
        await ws.accept()
        self.connections[camera_id] = ws
        logger.info(f"📡 Camera connectée: {camera_id} ({len(self.connections)} total)")

    def disconnect(self, camera_id: str):
        self.connections.pop(camera_id, None)
        logger.info(f"📴 Camera déconnectée: {camera_id}")

manager = ConnectionManager()


@app.websocket("/ws/{camera_id}")
async def websocket_stream(ws: WebSocket, camera_id: str):
    """
    WebSocket pour stream temps réel.

    Client envoie : JSON { image: base64, organization_id, module_id, ... }
    Serveur répond: JSON { detections, count, alerts, inference_ms, ... }
    """
    await manager.connect(camera_id, ws)
    detector = get_detector()
    tracker  = get_tracker()
    fs       = get_firestore()

    try:
        while True:
            raw = await ws.receive_text()
            payload = json.loads(raw)

            image           = payload.get("image","")
            module_id       = payload.get("module_id","general")
            organization_id = payload.get("organization_id","")
            save_firebase   = payload.get("save_firebase", bool(organization_id))

            if not image:
                continue

            start      = time.time()
            detections = detector.detect(image, module_id)

            if detections:
                detections = tracker.update(camera_id, detections)

            # Firebase (alertes uniquement pour ne pas surcharger)
            events = []
            if save_firebase and organization_id:
                for det in detections:
                    if det.get("severity") in ["warning","critical"]:
                        det_id = fs.write_detection(organization_id, camera_id, det)
                        if det_id:
                            ev_id = fs.write_event(organization_id, camera_id, det_id, det)
                            if ev_id:
                                events.append(ev_id)
                                fs.write_notification(organization_id, ev_id, det)

            await ws.send_json({
                "detections":   detections,
                "count":        len(detections),
                "alerts":       [d for d in detections if d.get("alert")],
                "events":       events,
                "module":       module_id,
                "inference_ms": round((time.time()-start)*1000),
                "timestamp":    time.time(),
            })

    except WebSocketDisconnect:
        manager.disconnect(camera_id)
    except Exception as e:
        logger.error(f"❌ WebSocket error {camera_id}: {e}")
        manager.disconnect(camera_id)


# ── Upload image directe ──────────────────────────────────────────────────────

@app.post("/detect/upload")
async def detect_upload(
    file:            UploadFile = File(...),
    module_id:       str        = Form("general"),
    organization_id: str        = Form(""),
    camera_id:       str        = Form(""),
    save_firebase:   bool       = Form(False),
):
    """Détection sur image uploadée (multipart/form-data)"""
    contents = await file.read()
    b64      = base64.b64encode(contents).decode()

    req = DetectRequest(
        image=b64,
        module_id=module_id,
        organization_id=organization_id,
        camera_id=camera_id,
        run_tracking=bool(camera_id),
        run_ocr=module_id=="transportation",
        save_to_firebase=save_firebase,
    )
    return await detect_image(req)


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        workers=settings.WORKERS,
        log_level=settings.LOG_LEVEL,
        reload=settings.ENVIRONMENT == "development",
    )
