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
