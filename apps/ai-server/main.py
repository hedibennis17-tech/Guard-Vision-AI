"""
Vision Guard AI Server v2.0
FastAPI + ONNX + Firebase + PPE Training + OCR
"""
import time, json, os, base64
from typing import Optional, List, Dict
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from loguru import logger

app = FastAPI(title="Vision Guard AI", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Training state ────────────────────────────────────────────────────────────
_train_log:     list = []
_train_running: bool = False

# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status":    "ok",
        "version":   "2.0.0",
        "timestamp": time.time(),
        "endpoints": ["/ppe/train-status", "/ppe/start-training", "/detect/ppe", "/ocr/analyze"],
    }

@app.get("/")
def root():
    return {
        "service": "Vision Guard AI Server",
        "version": "2.0.0",
        "firebase": {"connected": _firebase_ok()},
        "models": {
            "onnx":      os.path.exists("models/yolo11n.onnx"),
            "ppe":       os.path.exists("models/ppe.pt"),
            "shoplifting": os.path.exists("models/shoplifting_wights.pt"),
        },
        "training": {"running": _train_running, "logs": _train_log[-3:]},
    }

# ── Firebase ──────────────────────────────────────────────────────────────────
_db = None

def _firebase_ok():
    try:
        import firebase_admin
        return bool(firebase_admin._apps)
    except: return False

def get_db():
    global _db
    if _db: return _db
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
        if not firebase_admin._apps:
            creds_json = os.environ.get("FIREBASE_CREDENTIALS_JSON","")
            project_id = os.environ.get("FIREBASE_PROJECT_ID","ai-guard-vision-8ef41")
            cred = credentials.Certificate(json.loads(creds_json)) if creds_json else credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred, {"projectId": project_id})
        _db = firestore.client()
        logger.success("✅ Firebase connecté")
    except Exception as e:
        logger.error(f"❌ Firebase: {e}")
    return _db

# Initialiser Firebase au démarrage (léger)
@app.on_event("startup")
async def startup():
    logger.info("🚀 Vision Guard AI Server v2.0 démarrage...")
    get_db()
    logger.success("✅ Serveur prêt")

# ── ONNX Detector (lazy) ──────────────────────────────────────────────────────
_onnx = None

COCO = ["person","bicycle","car","motorcycle","airplane","bus","train","truck","boat",
        "traffic light","fire hydrant","stop sign","parking meter","bench","bird","cat",
        "dog","horse","sheep","cow","elephant","bear","zebra","giraffe","backpack",
        "umbrella","handbag","tie","suitcase","frisbee","skis","snowboard","sports ball",
        "kite","baseball bat","baseball glove","skateboard","surfboard","tennis racket",
        "bottle","wine glass","cup","fork","knife","spoon","bowl","banana","apple",
        "sandwich","orange","broccoli","carrot","hot dog","pizza","donut","cake","chair",
        "couch","potted plant","bed","dining table","toilet","tv","laptop","mouse","remote",
        "keyboard","cell phone","microwave","oven","toaster","sink","refrigerator","book",
        "clock","vase","scissors","teddy bear","hair drier","toothbrush"]

MODULE_MAPS = {
    "construction":{"person":{"label":"Travailleur — Vérif. EPI","icon":"👷","severity":"warning","alert":True},"truck":{"label":"Engin lourd","icon":"🚛","severity":"warning","alert":True},"car":{"label":"Véhicule chantier","icon":"🚗","severity":"warning","alert":True}},
    "industrial":  {"person":{"label":"Travailleur — Vérif. EPI & Uniforme","icon":"👷","severity":"warning","alert":True},"truck":{"label":"Chariot élévateur","icon":"🏭","severity":"warning","alert":True}},
    "retail":      {"person":{"label":"Client","icon":"🛍️","severity":"info","alert":False},"backpack":{"label":"Sac suspect","icon":"🎒","severity":"warning","alert":True},"suitcase":{"label":"Bagage suspect","icon":"🧳","severity":"warning","alert":True}},
    "defense":     {"person":{"label":"INTRUS 🚨","icon":"🚨","severity":"critical","alert":True},"car":{"label":"Véhicule suspect","icon":"🚗","severity":"critical","alert":True}},
    "agriculture": {"person":{"label":"Intrus/Braconnage","icon":"🚨","severity":"critical","alert":True},"cow":{"label":"Vache","icon":"🐄","severity":"info","alert":False},"horse":{"label":"Cheval","icon":"🐎","severity":"info","alert":False},"sheep":{"label":"Mouton","icon":"🐑","severity":"info","alert":False}},
    "home_security":{"person":{"label":"Personne détectée","icon":"🚨","severity":"warning","alert":True},"car":{"label":"Véhicule","icon":"🚗","severity":"info","alert":False}},
}

def get_onnx():
    global _onnx
    if _onnx: return _onnx
    try:
        import onnxruntime as ort, urllib.request
        path = "models/yolo11n.onnx"
        os.makedirs("models", exist_ok=True)
        if not os.path.exists(path):
            logger.info("📥 Téléchargement yolo11n.onnx...")
            urllib.request.urlretrieve("https://github.com/ultralytics/assets/releases/download/v8.3.0/yolo11n.onnx", path)
        opts = ort.SessionOptions()
        opts.inter_op_num_threads = 2
        opts.intra_op_num_threads = 2
        _onnx = ort.InferenceSession(path, sess_options=opts, providers=["CPUExecutionProvider"])
        logger.success("✅ ONNX prêt")
    except Exception as e:
        logger.error(f"❌ ONNX: {e}")
    return _onnx

class DetectRequest(BaseModel):
    image:           str
    module_id:       str   = "general"
    organization_id: str   = ""
    camera_id:       str   = ""
    confidence:      float = 0.45
    save_to_firebase:bool  = False

@app.post("/detect")
@app.post("/pipeline/run")
def detect(req: DetectRequest):
    session = get_onnx()
    if not session:
        return {"detections":[], "count":0, "error":"ONNX non disponible"}
    try:
        from PIL import Image
        import numpy as np, io
        b64 = req.image
        if "," in b64: b64 = b64.split(",")[1]
        img      = Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")
        ow, oh   = img.size
        S        = 640
        scale    = min(S/ow, S/oh)
        nw, nh   = int(ow*scale), int(oh*scale)
        padded   = Image.new("RGB",(S,S),(114,114,114))
        padded.paste(img.resize((nw,nh),Image.BILINEAR),(0,0))
        blob     = np.array(padded,dtype=np.float32)/255.0
        blob     = np.transpose(blob,(2,0,1))[np.newaxis]
        preds    = session.run(None,{session.get_inputs()[0].name:blob})[0][0].T
        cmap     = MODULE_MAPS.get(req.module_id,{})
        dets     = []
        for p in preds:
            scores = p[4:]; ci = int(np.argmax(scores)); conf = float(scores[ci])
            if conf < req.confidence or ci >= len(COCO): continue
            cx,cy,pw,ph = p[0],p[1],p[2],p[3]
            x1,y1 = int(max(0,(cx-pw/2)/scale)), int(max(0,(cy-ph/2)/scale))
            x2,y2 = int(min(ow,(cx+pw/2)/scale)), int(min(oh,(cy+ph/2)/scale))
            if x2<=x1 or y2<=y1: continue
            cls = COCO[ci]
            e   = cmap.get(cls)
            dets.append({"class":cls,"label":e["label"] if e else cls,"icon":e["icon"] if e else "📦",
                "category":"human" if cls=="person" else "vehicle","severity":e["severity"] if e else "info",
                "score":round(conf,3),"confidence":round(conf*100,1),"bbox":[x1,y1,x2,y2],
                "alert":e["alert"] if e else False,"module":req.module_id})
        from collections import defaultdict
        by_cls = defaultdict(list)
        for d in dets: by_cls[d["class"]].append(d)
        final = [max(v,key=lambda x:x["score"]) for v in by_cls.values()]
        return {"detections":final,"count":len(final),"alerts":[d for d in final if d.get("alert")],"module":req.module_id}
    except Exception as e:
        return {"detections":[],"count":0,"error":str(e)}

# ── PPE Train Status ──────────────────────────────────────────────────────────
@app.get("/ppe/train-status")
def ppe_train_status():
    return {
        "version":          "2.0.0",
        "ppe_pt_exists":    os.path.exists("models/ppe.pt"),
        "onnx_exists":      os.path.exists("models/yolo11n.onnx"),
        "training_running": _train_running,
        "last_logs":        _train_log[-20:],
        "models_dir":       os.listdir("models") if os.path.exists("models") else [],
        "roboflow_key":     bool(os.environ.get("ROBOFLOW_API_KEY")),
        "env_vars":         {k:bool(v) for k,v in {"ROBOFLOW_API_KEY":os.environ.get("ROBOFLOW_API_KEY"),"FIREBASE_PROJECT_ID":os.environ.get("FIREBASE_PROJECT_ID")}.items()},
    }

@app.post("/ppe/start-training")
async def start_training():
    global _train_running
    if _train_running:
        return {"status":"already_running","logs":_train_log[-5:]}
    import asyncio
    asyncio.create_task(_do_train())
    return {"status":"started","message":"Entraînement démarré en background","check":"/ppe/train-status"}

async def _do_train():
    global _train_running, _train_log
    _train_running = True
    _train_log = []

    def log(msg):
        _train_log.append(f"{time.strftime('%H:%M:%S')} {msg}")
        logger.info(msg)

    try:
        log("🚀 Démarrage entraînement PPE")
        api_key = os.environ.get("ROBOFLOW_API_KEY","9H5LTv4r2ToBc0cb0rh5")

        # Installer roboflow + ultralytics à la volée
        log("📦 Installation ultralytics + roboflow...")
        import subprocess, sys
        subprocess.run([sys.executable,"-m","pip","install","ultralytics","roboflow","-q"],
                      capture_output=True, timeout=300)
        log("✅ Packages installés")

        # Télécharger dataset
        from roboflow import Roboflow
        rf = Roboflow(api_key=api_key)
        log(f"🔑 Roboflow connecté")

        datasets = [
            ("roboflow-universe-datasets","hard-hat-workers-cghgq",2),
            ("roboflow-universe-datasets","ppe-detection-nf06a",4),
            ("roboflow-100","construction-safety-gsnvb",2),
            ("roboflow-universe-datasets","construction-site-safety-iabkl",1),
        ]

        location = None
        for ws, proj, ver in datasets:
            try:
                log(f"📥 {ws}/{proj}...")
                ds       = rf.workspace(ws).project(proj).version(ver).download("yolov8",location="ppe_ds")
                location = ds.location
                log(f"✅ Dataset: {location}")
                break
            except Exception as e:
                log(f"❌ {proj}: {str(e)[:60]}")

        if not location:
            log("❌ Aucun dataset disponible"); return

        yaml = os.path.join(location,"data.yaml")
        if not os.path.exists(yaml):
            files = os.listdir(location) if os.path.exists(location) else []
            log(f"❌ data.yaml absent. Fichiers: {files}"); return

        # Entraîner
        log("🏋️ Entraînement YOLOv11n (30 epochs)...")
        from ultralytics import YOLO
        import asyncio, shutil
        loop = asyncio.get_event_loop()

        def train():
            # Mode headless obligatoire sur Railway
            import os as _os
            _os.environ["QT_QPA_PLATFORM"] = "offscreen"
            _os.environ["MPLBACKEND"]      = "Agg"
            _os.environ["DISPLAY"]         = ""
            m = YOLO("yolo11n.pt")
            m.train(data=yaml,epochs=30,imgsz=640,batch=8,device="cpu",name="ppe_v1",verbose=False,plots=False)
            best = "runs/detect/ppe_v1/weights/best.pt"
            if os.path.exists(best):
                os.makedirs("models",exist_ok=True)
                shutil.copy2(best,"models/ppe.pt")
                shutil.copy2(best,"models/ppe_construction.pt")
                log("✅ models/ppe.pt créé!")
            else:
                log("❌ best.pt introuvable après entraînement")

        await loop.run_in_executor(None, train)

    except Exception as e:
        log(f"❌ Erreur: {e}")
    finally:
        _train_running = False

# ── OCR ───────────────────────────────────────────────────────────────────────
class OCRRequest(BaseModel):
    image:str; module:str="general"; organization_id:str=""; camera_id:str=""

@app.post("/ocr/analyze")
@app.post("/api/v1/ocr/analyze")
def ocr_analyze(req: OCRRequest):
    try:
        from ocr.vision_guard_ocr import get_ocr
        return get_ocr().analyze(req.image, req.module)
    except Exception as e:
        return {"error":str(e),"engines_used":{"tesseract":False,"pyzbar":False,"opencv_qr":True}}

@app.get("/ocr/status")
def ocr_status():
    try:
        from ocr.vision_guard_ocr import get_ocr
        return get_ocr().status
    except Exception as e:
        return {"loaded":False,"error":str(e)}

# ── PPE detect ────────────────────────────────────────────────────────────────
class PPERequest(BaseModel):
    image:str; sector:str="general"; organization_id:str=""; camera_id:str=""; confidence:float=0.45

@app.post("/detect/ppe")
def detect_ppe(req: PPERequest):
    if not os.path.exists("models/ppe.pt"):
        return {"error":"models/ppe.pt manquant","solution":"POST /ppe/start-training","deployed":False,"detections":[]}
    try:
        from detection.ppe_detector import get_ppe_detector
        from PIL import Image
        import numpy as np, io
        b64 = req.image
        if "," in b64: b64 = b64.split(",")[1]
        img  = np.array(Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB"))
        det  = get_ppe_detector()
        dets = det.detect(img, req.sector, req.confidence)
        return {"detections":dets,"count":len(dets),"alerts":[d for d in dets if d.get("alert")],"compliance":det.get_compliance_score(dets)}
    except Exception as e:
        return {"error":str(e),"detections":[]}

@app.get("/detect/ppe/status")
def ppe_status():
    return {
        "model_available": os.path.exists("models/ppe.pt"),
        "training_running": _train_running,
        "start_training":  "POST /ppe/start-training",
        "check_progress":  "GET /ppe/train-status",
    }

@app.post("/detect/shoplifting")
def detect_shoplifting(image:str="", organization_id:str="", camera_id:str="", confidence:float=0.50):
    try:
        from detection.shoplifting_detector import get_shoplifting_detector
        det  = get_shoplifting_detector()
        dets = det.detect_b64(image, confidence)
        return {"shoplifting_detected":any(d["class"]=="shoplifting" for d in dets),"detections":dets,"status":det.status}
    except Exception as e:
        return {"error":str(e),"detections":[]}

@app.get("/detect/shoplifting/status")
def shoplifting_status():
    try:
        from detection.shoplifting_detector import get_shoplifting_detector
        return get_shoplifting_detector().status
    except Exception as e:
        return {"loaded":False,"error":str(e)}
