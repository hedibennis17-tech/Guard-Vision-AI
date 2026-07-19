"""
Vision Guard AI Server v2.0
FastAPI + ONNX + Firebase + PPE Training + OCR
"""
# CRITIQUE: env vars headless AVANT tout import (cv2/ultralytics chargent libGL à l'import)
import os
os.environ["QT_QPA_PLATFORM"]   = "offscreen"
os.environ["MPLBACKEND"]         = "Agg"
os.environ["DISPLAY"]            = ""
os.environ["OPENCV_IO_ENABLE_OPENEXR"] = "0"
import time, json, base64
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

class TrainRequest(BaseModel):
    model_size: str = "n"  # n=nano s=small m=medium l=large x=xlarge

@app.post("/ppe/start-training")
async def start_training(req: TrainRequest = TrainRequest()):
    global _train_running
    if _train_running:
        return {"status":"already_running","logs":_train_log[-5:]}
    import asyncio
    asyncio.create_task(_do_train(req.model_size))
    model_name = {"n":"YOLOv11 Nano (rapide)","s":"YOLOv11 Small","m":"YOLOv11 Medium (recommandé)","l":"YOLOv11 Large","x":"YOLOv11 XLarge (précision max)"}.get(req.model_size,"YOLOv11n")
    return {"status":"started","model":model_name,"message":f"Entraînement {model_name} démarré","check":"/ppe/train-status"}

async def _do_train(model_size: str = "n"):
    global _train_running, _train_log
    _train_running = True
    _train_log = []
    # CRITIQUE: forcer headless AVANT tout import ultralytics/cv2/matplotlib
    import os as _env
    _env.environ["QT_QPA_PLATFORM"]  = "offscreen"
    _env.environ["MPLBACKEND"]        = "Agg"
    _env.environ["DISPLAY"]           = ""
    _env.environ["OPENCV_IO_ENABLE_OPENEXR"] = "0"
    _env.environ["QT_DEBUG_PLUGINS"] = "0"

    def log(msg):
        _train_log.append(f"{time.strftime('%H:%M:%S')} {msg}")
        logger.info(msg)

    try:
        log("🚀 Démarrage entraînement PPE")
        api_key = os.environ.get("ROBOFLOW_API_KEY","9H5LTv4r2ToBc0cb0rh5")

        log("✅ Packages prêts (ultralytics installé au build)")

        # Télécharger dataset via HTTP direct (sans SDK Roboflow = sans libxcb)
        import urllib.request, zipfile, io as _io
        log("📥 Téléchargement dataset PPE via API directe...")

        # Datasets PPE publics — téléchargement direct HTTP
        download_urls = [
            f"https://api.roboflow.com/roboflow-100/construction-safety-gsnvb/2/yolov8?api_key={api_key}",
            f"https://api.roboflow.com/roboflow-universe-datasets/hard-hat-workers-cghgq/2/yolov8?api_key={api_key}",
            f"https://api.roboflow.com/roboflow-universe-datasets/ppe-detection-nf06a/4/yolov8?api_key={api_key}",
            f"https://api.roboflow.com/roboflow-universe-datasets/construction-site-safety-iabkl/1/yolov8?api_key={api_key}",
        ]

        location = None
        for api_url in download_urls:
            try:
                # Étape 1: obtenir le lien de téléchargement
                log(f"📡 {api_url.split('/')[4]}/{api_url.split('/')[5]}...")
                req  = urllib.request.Request(api_url, headers={"User-Agent":"VisionGuard/2.0"})
                with urllib.request.urlopen(req, timeout=30) as r:
                    info = json.loads(r.read())

                dl_url = info.get("export",{}).get("link") or info.get("link")
                if not dl_url:
                    log(f"❌ Pas de lien: {str(info)[:100]}")
                    continue

                # Étape 2: télécharger le ZIP
                log(f"📦 Téléchargement ZIP...")
                with urllib.request.urlopen(dl_url, timeout=120) as r:
                    zip_data = r.read()

                # Étape 3: extraire
                os.makedirs("ppe_ds", exist_ok=True)
                with zipfile.ZipFile(_io.BytesIO(zip_data)) as z:
                    z.extractall("ppe_ds")
                location = "ppe_ds"
                log(f"✅ Dataset extrait dans {location}")
                log(f"   Fichiers: {os.listdir(location)[:10]}")
                break

            except Exception as e:
                log(f"❌ {str(e)[:80]}")

        if not location:
            log("❌ Aucun dataset téléchargé"); return

        yaml = os.path.join(location,"data.yaml")
        if not os.path.exists(yaml):
            files = os.listdir(location) if os.path.exists(location) else []
            log(f"❌ data.yaml absent. Fichiers: {files}"); return

        # ── Nettoyer les anciens fichiers yaml corrompus ────────────────────────
        for old_f in ["ppe_ds/data_fixed.yaml"]:  # NE PAS supprimer data.yaml
            if os.path.exists(old_f):
                os.remove(old_f)
                log(f"🗑️ Supprimé: {old_f}")

        # ── Diagnostic et fix automatique du dataset ──────────────────────────
        log("🔍 Vérification structure dataset...")
        abs_location = os.path.abspath(location)

        # Détecter les noms de dossiers (valid vs validation vs val)
        val_name = None
        for candidate in ["valid","val","validation"]:
            if os.path.exists(os.path.join(abs_location, candidate)):
                val_name = candidate; break

        for split, name in [("train","train"),("valid", val_name or "valid"),("test","test")]:
            path = os.path.join(abs_location, name or split)
            img  = os.path.join(path,"images")
            lbl  = os.path.join(path,"labels")
            if os.path.exists(img):
                count = len(os.listdir(img))
                log(f"✅ {split}/images — {count} images")
            else:
                log(f"⚠️ {split}/images absent (cherché: {img})")
            if os.path.exists(lbl):
                log(f"✅ {split}/labels — OK")

        # Lire et afficher le data.yaml original
        with open(yaml) as f:
            yaml_content = f.read()
        log(f"📄 data.yaml original:\n{yaml_content[:300]}")

        # Corriger data.yaml avec PyYAML (pas de regex, format garanti valide)
        import re as _re
        # Extraire nc
        nc_match = _re.search(r"nc:\s*(\d+)", yaml_content)
        nc = int(nc_match.group(1)) if nc_match else 5
        # Extraire names avec PyYAML
        try:
            import yaml as _yaml
            orig = _yaml.safe_load(yaml_content)
            names_list = orig.get("names", ["helmet","no-helmet","no-vest","person","vest"])
            nc = orig.get("nc", nc)
        except Exception as _ye:
            log(f"⚠️ PyYAML parse: {_ye}")
            names_list = ["helmet","no-helmet","no-vest","person","vest"]
        # Écrire YAML valide avec PyYAML
        fixed_data = {
            "path":  abs_location,
            "train": "train/images",
            "val":   f"{val_name or 'valid'}/images",
            "test":  "test/images",
            "nc":    nc,
            "names": names_list,
        }
        fixed_yaml = os.path.join(abs_location, "data_fixed.yaml")
        import yaml as _yaml2
        with open(fixed_yaml, "w") as f:
            _yaml2.dump(fixed_data, f, default_flow_style=False, allow_unicode=True)
        # Vérifier le contenu écrit
        with open(fixed_yaml) as f:
            written = f.read()
        log(f"✅ data_fixed.yaml valide:\n{written}")
        yaml = fixed_yaml

        # Forcer opencv-headless AVANT d'importer ultralytics (qui importe cv2→libGL)
        log("🔧 Configuration OpenCV headless...")
        import subprocess, sys
        subprocess.run([sys.executable,"-m","pip","uninstall","opencv-python","opencv-contrib-python","-y","-q"], capture_output=True, timeout=120)
        subprocess.run([sys.executable,"-m","pip","install","opencv-python-headless","-q"], capture_output=True, timeout=180)
        log("✅ OpenCV headless installé")

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
            model_file = f"yolo11{model_size}.pt"
            epochs_map  = {"n":30,"s":50,"m":80,"l":100,"x":150}
            epochs      = epochs_map.get(model_size, 30)
            log(f"🤖 Modèle: {model_file} | {epochs} epochs")
            m = YOLO(model_file)
            m.train(data=yaml,epochs=epochs,imgsz=640,batch=8,device="cpu",name="ppe_v1",verbose=False,plots=False)
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
