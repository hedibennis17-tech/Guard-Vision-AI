"""
Vision Guard AI Server — Version minimale Railway
Firebase + API REST — ONNX s'ajoute après
"""
import time, json, os, base64
from typing import Optional, List, Dict
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from loguru import logger

app = FastAPI(title="Vision Guard AI", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Auto-train PPE au démarrage ─────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    import asyncio
    asyncio.create_task(_auto_train_background())

async def _auto_train_background():
    """Lance l'entraînement PPE en background si models/ppe.pt absent"""
    import asyncio
    if os.path.exists("models/ppe.pt"):
        logger.info("✅ models/ppe.pt présent")
        return
    logger.info("🏋️ Auto-train PPE démarré en arrière-plan...")
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _run_auto_train)
    except Exception as e:
        logger.error(f"Auto-train PPE error: {e}")

def _run_auto_train():
    try:
        from ppe_training.auto_train import run
        run()
    except Exception as e:
        logger.error(f"auto_train import error: {e}")

# ── Firebase (lazy init) ──────────────────────────────────────────────────────
_db = None

def get_db():
    global _db
    if _db: return _db
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
        if not firebase_admin._apps:
            creds_json = os.environ.get("FIREBASE_CREDENTIALS_JSON", "")
            project_id = os.environ.get("FIREBASE_PROJECT_ID", "ai-guard-vision-8ef41")
            if creds_json:
                cred = credentials.Certificate(json.loads(creds_json))
            else:
                cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred, {"projectId": project_id})
        _db = firestore.client()
        logger.success("✅ Firebase connecté")
    except Exception as e:
        logger.error(f"❌ Firebase: {e}")
    return _db

# ── ONNX détection (lazy, optionnelle) ───────────────────────────────────────
_onnx_session = None
_onnx_loaded  = False

def get_onnx():
    global _onnx_session, _onnx_loaded
    if _onnx_loaded: return _onnx_session
    try:
        import onnxruntime as ort
        import urllib.request
        model_path = "models/yolo11n.onnx"
        os.makedirs("models", exist_ok=True)
        if not os.path.exists(model_path):
            logger.info("📥 Téléchargement yolo11n.onnx...")
            urllib.request.urlretrieve(
                "https://github.com/ultralytics/assets/releases/download/v8.3.0/yolo11n.onnx",
                model_path
            )
        opts = ort.SessionOptions()
        opts.inter_op_num_threads = 1
        opts.intra_op_num_threads = 1
        _onnx_session = ort.InferenceSession(model_path, sess_options=opts,
                                              providers=["CPUExecutionProvider"])
        _onnx_loaded = True
        logger.success("✅ ONNX prêt")
    except Exception as e:
        logger.warning(f"⚠️ ONNX non disponible: {e}")
        _onnx_loaded = True  # pour ne pas réessayer
    return _onnx_session

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "timestamp": time.time()}

@app.get("/")
def root():
    db      = get_db()
    session = get_onnx()
    return {
        "service": "Vision Guard AI Server",
        "version": "1.0.0",
        "status":  "operational",
        "firebase": {"connected": db is not None},
        "yolo":     {"loaded": session is not None},
    }

class DetectRequest(BaseModel):
    image:           str
    module_id:       str   = "general"
    organization_id: str   = ""
    camera_id:       str   = ""
    confidence:      float = 0.45
    save_to_firebase:bool  = False

@app.post("/detect")
def detect(req: DetectRequest):
    session = get_onnx()
    if not session:
        return {"detections": [], "count": 0, "error": "ONNX non disponible — install onnxruntime"}

    try:
        from PIL import Image
        import numpy as np
        import io

        # Décoder l'image
        b64 = req.image
        if "," in b64: b64 = b64.split(",")[1]
        img_bytes = base64.b64decode(b64)
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        orig_w, orig_h = img.size

        # Préprocess YOLO (640x640)
        SIZE = 640
        scale = min(SIZE/orig_w, SIZE/orig_h)
        nw, nh = int(orig_w*scale), int(orig_h*scale)
        img_resized = img.resize((nw, nh), Image.BILINEAR)
        padded = Image.new("RGB", (SIZE, SIZE), (114,114,114))
        padded.paste(img_resized, (0, 0))

        blob = np.array(padded, dtype=np.float32) / 255.0
        blob = np.transpose(blob, (2,0,1))[np.newaxis]

        # Inférence
        input_name = session.get_inputs()[0].name
        outputs    = session.run(None, {input_name: blob})
        preds      = outputs[0][0].T  # (8400, 84)

        # Parser
        COCO = ["person","bicycle","car","motorcycle","airplane","bus","train","truck",
                "boat","traffic light","fire hydrant","stop sign","parking meter","bench",
                "bird","cat","dog","horse","sheep","cow","elephant","bear","zebra","giraffe",
                "backpack","umbrella","handbag","tie","suitcase","frisbee","skis","snowboard",
                "sports ball","kite","baseball bat","baseball glove","skateboard","surfboard",
                "tennis racket","bottle","wine glass","cup","fork","knife","spoon","bowl",
                "banana","apple","sandwich","orange","broccoli","carrot","hot dog","pizza",
                "donut","cake","chair","couch","potted plant","bed","dining table","toilet",
                "tv","laptop","mouse","remote","keyboard","cell phone","microwave","oven",
                "toaster","sink","refrigerator","book","clock","vase","scissors",
                "teddy bear","hair drier","toothbrush"]

        dets = []
        for pred in preds:
            scores   = pred[4:]
            cls_id   = int(np.argmax(scores))
            conf     = float(scores[cls_id])
            if conf < req.confidence: continue
            cx,cy,pw,ph = pred[0],pred[1],pred[2],pred[3]
            x1 = int(max(0, (cx-pw/2)/scale))
            y1 = int(max(0, (cy-ph/2)/scale))
            x2 = int(min(orig_w, (cx+pw/2)/scale))
            y2 = int(min(orig_h, (cy+ph/2)/scale))
            if x2<=x1 or y2<=y1: continue
            cls_name = COCO[cls_id] if cls_id < len(COCO) else f"cls{cls_id}"
            dets.append({"class":cls_name,"score":round(conf,3),"bbox":[x1,y1,x2,y2]})

        # NMS simple (garder best par classe)
        from collections import defaultdict
        by_class = defaultdict(list)
        for d in dets: by_class[d["class"]].append(d)
        final = [max(v, key=lambda x:x["score"]) for v in by_class.values()]

        # Sauvegarder dans Firebase
        if req.save_to_firebase and req.organization_id and req.camera_id:
            db = get_db()
            if db:
                for det in final[:5]:
                    from datetime import datetime, timezone
                    now = datetime.now(timezone.utc).isoformat()
                    ref = db.collection("organizations").document(req.organization_id)\
                             .collection("detections").document()
                    ref.set({
                        "id":ref.id,"organizationId":req.organization_id,
                        "cameraId":req.camera_id,"type":det["class"],
                        "label":det["class"],"severity":"info",
                        "confidence":det["score"],"bbox":det["bbox"],
                        "source":"yolov11_server","detectedAt":now,
                    })

        return {"detections":final,"count":len(final),"module":req.module_id}

    except Exception as e:
        logger.error(f"detect error: {e}")
        return {"detections":[],"count":0,"error":str(e)}

@app.post("/pipeline/run")
def pipeline(req: DetectRequest):
    return detect(req)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)


# ── PPE Professional Detection ────────────────────────────────────────────────

class PPERequest(BaseModel):
    image:           str
    sector:          str   = "general"  # construction|industrial|warehouse|mining
    organization_id: str   = ""
    camera_id:       str   = ""
    confidence:      float = 0.45
    save_firebase:   bool  = False

@app.post("/detect/ppe")
def detect_ppe(req: PPERequest):
    """
    Détection PPE professionnelle par secteur.
    Retourne: EPI présents ✅, EPI manquants 🚨, score conformité
    """
    try:
        from detection.ppe_detector import get_ppe_detector
        detector = get_ppe_detector()
    except Exception as e:
        return {"error": f"PPE detector non disponible: {e}", "detections": []}

    if not detector.loaded:
        return {
            "error":   "Aucun modèle PPE disponible",
            "status":  detector.status,
            "solution":"Exécuter ppe_training/train_ppe.py ou uploader models/ppe.pt",
            "detections": [],
        }

    start = time.time()
    
    try:
        from PIL import Image
        import numpy as np
        import io
        
        b64 = req.image
        if "," in b64: b64 = b64.split(",")[1]
        img_bytes = base64.b64decode(b64)
        img = np.array(Image.open(io.BytesIO(img_bytes)).convert("RGB"))
    except Exception as e:
        return {"error": f"Décodage image: {e}", "detections": []}

    dets       = detector.detect(img, req.sector, req.confidence)
    compliance = detector.get_compliance_score(dets)

    # Sauvegarder dans Firebase
    if req.save_firebase and req.organization_id and req.camera_id:
        db = get_db()
        if db:
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc).isoformat()
            for det in dets:
                if det.get("alert"):
                    ref = db.collection("organizations").document(req.organization_id)\
                             .collection("events").document()
                    ref.set({
                        "id":ref.id,"organizationId":req.organization_id,
                        "cameraId":req.camera_id,"siteId":"default",
                        "primaryType":det["class"],"label":det["label"],
                        "category":"ppe","severity":det["severity"],
                        "detectionIds":[],"durationSeconds":0,
                        "thumbnailUrl":None,"videoClipUrl":None,
                        "clipStatus":"pending","acknowledged":False,
                        "source":"ppe_detector","sector":req.sector,
                        "createdAt":now,"updatedAt":now,
                    })

    return {
        "detections":       dets,
        "count":            len(dets),
        "alerts":           [d for d in dets if d.get("alert")],
        "critical":         [d for d in dets if d.get("severity")=="critical"],
        "compliance":       compliance,
        "sector":           req.sector,
        "inference_ms":     round((time.time()-start)*1000),
        "model_status":     detector.status,
    }

@app.get("/detect/ppe/status")
def ppe_status():
    """Status des modèles PPE disponibles"""
    try:
        from detection.ppe_detector import get_ppe_detector
        return get_ppe_detector().status
    except Exception as e:
        return {"error": str(e), "loaded": False}


# ── OCR AI Bundle — Vision Guard Recognition Engine ───────────────────────────

class OCRRequest(BaseModel):
    image:           str
    module:          str  = "general"   # transportation|retail|industrial|construction|defense
    organization_id: str  = ""
    camera_id:       str  = ""
    run_plate:       bool = True
    run_barcode:     bool = True
    run_serial:      bool = True
    run_warning:     bool = True
    run_text:        bool = True
    save_firebase:   bool = False

@app.post("/api/v1/ocr/analyze")
@app.post("/ocr/analyze")
def ocr_analyze(req: OCRRequest):
    """
    Vision Guard Recognition Engine — Analyse OCR complète
    Plaques · Codes-barres · QR · Numéros de série · Panneaux danger · Texte
    Réutilisable: TrafficGuard · Retail · Industrial · AgriGuard · Defense
    """
    try:
        from ocr.vision_guard_ocr import get_ocr
        engine = get_ocr()
    except Exception as e:
        return {"error": f"OCR engine: {e}", "results": {}}

    results = engine.analyze(
        image_b64=  req.image,
        module=     req.module,
        run_plate=  req.run_plate,
        run_barcode=req.run_barcode,
        run_serial= req.run_serial,
        run_warning=req.run_warning,
        run_text=   req.run_text,
    )

    # Sauvegarder dans Firebase si détection importante
    if req.save_firebase and req.organization_id and req.camera_id:
        db = get_db()
        if db and results.get("alerts"):
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc).isoformat()
            for alert in results["alerts"]:
                if alert.get("type") == "license_plate" or alert.get("severity") == "critical":
                    ref = db.collection("organizations").document(req.organization_id)\
                             .collection("events").document()
                    ref.set({
                        "id":ref.id,"organizationId":req.organization_id,
                        "cameraId":req.camera_id,"siteId":"default",
                        "primaryType":f"ocr_{alert['type']}",
                        "label":f"{alert['icon']} {alert['value']}",
                        "category":"ocr","severity":alert.get("severity","info"),
                        "detectionIds":[],"durationSeconds":0,
                        "thumbnailUrl":None,"videoClipUrl":None,
                        "clipStatus":"pending","acknowledged":False,
                        "source":"ocr_engine","module":req.module,
                        "createdAt":now,"updatedAt":now,
                    })

    return results

@app.get("/ocr/status")
def ocr_status():
    """Status du moteur OCR"""
    try:
        from ocr.vision_guard_ocr import get_ocr
        return get_ocr().status
    except Exception as e:
        return {"error": str(e), "loaded": False}

@app.post("/ocr/plate")
def ocr_plate_only(req: OCRRequest):
    """ALPR rapide — plaques seulement"""
    req.run_barcode = False
    req.run_text    = False
    req.run_serial  = False
    req.run_warning = False
    return ocr_analyze(req)

@app.post("/ocr/barcode")
def ocr_barcode_only(req: OCRRequest):
    """Codes-barres et QR seulement"""
    req.run_plate   = False
    req.run_text    = False
    req.run_serial  = False
    req.run_warning = False
    return ocr_analyze(req)
