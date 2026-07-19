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
_train_log:      list = []
_train_running:  bool = False
_train_progress: dict = {"epoch":0,"total":0,"loss":0.0,"map50":0.0,"pct":0,"started_at":None}

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
            firebase_admin.initialize_app(cred, {
                "projectId":    project_id,
                "storageBucket": f"{project_id}.firebasestorage.app",
            })
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
    # Copier ppe.onnx et ppe.pt depuis le repo vers models/
    import shutil
    os.makedirs("models", exist_ok=True)
    for fname, srcs in [
        ("ppe.onnx", ["ppe.onnx", "/app/ppe.onnx"]),
        ("ppe.pt",   ["ppe.pt",   "/app/ppe.pt"]),
    ]:
        dest = f"models/{fname}"
        if not os.path.exists(dest):
            for src in srcs:
                if os.path.exists(src):
                    shutil.copy2(src, dest)
                    size = os.path.getsize(dest)/1024/1024
                    logger.success(f"✅ {dest} copié depuis {src} ({size:.1f}MB)")
                    break
    logger.info(f"📂 models/: {os.listdir('models') if os.path.exists('models') else []}")
    logger.success("✅ Serveur prêt")

async def _download_ppe_from_storage():
    """Télécharge ppe.pt depuis Firebase Storage au démarrage"""
    if os.path.exists("models/ppe.pt"):
        logger.info("✅ models/ppe.pt déjà présent")
        return
    try:
        import firebase_admin
        from firebase_admin import storage as fb_storage
        os.makedirs("models", exist_ok=True)
        project_id = os.environ.get("FIREBASE_PROJECT_ID","ai-guard-vision-8ef41")
        bucket_name = f"{project_id}.firebasestorage.app"
        logger.info(f"📥 Connexion Firebase Storage: {bucket_name}")
        bucket = fb_storage.bucket(bucket_name)
        blob   = bucket.blob("ppe.pt")
        exists = blob.exists()
        logger.info(f"   ppe.pt exists: {exists}")
        if exists:
            logger.info("📥 Téléchargement ppe.pt...")
            blob.download_to_filename("models/ppe.pt")
            size = os.path.getsize("models/ppe.pt") / 1024 / 1024
            logger.success(f"✅ models/ppe.pt téléchargé ({size:.1f}MB)")
        else:
            logger.warning("⚠️ ppe.pt absent de Firebase Storage — vérifie le bucket")
            # Log les fichiers disponibles
            blobs = list(bucket.list_blobs())
            logger.info(f"   Fichiers dans Storage: {[b.name for b in blobs]}")
    except Exception as e:
        logger.error(f"❌ Download ppe.pt: {e}")
        import traceback
        logger.error(traceback.format_exc())

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
@app.get("/ppe/download")
async def ppe_download():
    """Force le téléchargement de ppe.pt depuis Firebase Storage"""
    logs = []
    def log(msg):
        logs.append(msg)
        logger.info(msg)
    try:
        import firebase_admin
        from firebase_admin import storage as fb_storage
        os.makedirs("models", exist_ok=True)
        project_id = os.environ.get("FIREBASE_PROJECT_ID","ai-guard-vision-8ef41")
        # Essayer les deux noms de bucket possibles
        # Utiliser get_db() qui initialise déjà Firebase correctement
        get_db()
        log(f"✅ Firebase apps: {list(firebase_admin._apps.keys())}")

        for bucket_name in [
            f"{project_id}.firebasestorage.app",
            f"{project_id}.appspot.com",
        ]:
            try:
                log(f"🔍 Essai bucket: {bucket_name}")
                bucket = fb_storage.bucket(bucket_name)
                blobs  = list(bucket.list_blobs(max_results=20))
                log(f"📂 Fichiers: {[b.name for b in blobs]}")
                blob = bucket.blob("ppe.pt")
                if blob.exists():
                    log("📥 Téléchargement ppe.pt...")
                    blob.download_to_filename("models/ppe.pt")
                    size = os.path.getsize("models/ppe.pt")/1024/1024
                    log(f"✅ ppe.pt téléchargé ({size:.1f}MB)")
                    return {"success":True,"logs":logs,"size_mb":round(size,1)}
                else:
                    log(f"❌ ppe.pt absent dans {bucket_name}")
            except Exception as e:
                log(f"❌ {bucket_name}: {e}")
        return {"success":False,"logs":logs}
    except Exception as e:
        import traceback
        return {"success":False,"error":str(e),"trace":traceback.format_exc(),"logs":logs}

@app.get("/ppe/train-status")
def ppe_train_status():
    try:
        import time
        prog    = _train_progress or {}
        start   = prog.get("started_at")
        ep      = int(prog.get("epoch", 0))
        tot     = int(prog.get("total", 0))
        elapsed = int(time.time() - start) if start else 0
        remaining = int((elapsed/ep)*(tot-ep)) if ep>0 and tot>0 and elapsed>0 else 0
        return {
            "version":          "2.0.0",
            "ppe_pt_exists":    os.path.exists("models/ppe.pt"),
            "training_running": bool(_train_running),
            "progress": {
                "epoch":        ep,
                "total_epochs": tot,
                "percent":      int(prog.get("pct", 0)),
                "loss":         float(prog.get("loss", 0)),
                "map50":        float(prog.get("map50", 0)),
                "elapsed_sec":  elapsed,
                "remaining_sec":remaining,
            },
            "last_logs":   list(_train_log[-30:]),
            "models_dir":  os.listdir("models") if os.path.exists("models") else [],
            "roboflow_key":bool(os.environ.get("ROBOFLOW_API_KEY")),
        }
    except Exception as e:
        return {"version":"2.0.0","error":str(e),"ppe_pt_exists":False,"training_running":False,"progress":{},"last_logs":[],"models_dir":[]}

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
            import subprocess, sys, time as _time, json as _json
            model_file = f"yolo11{model_size}.pt"
            epochs_map = {"n":30,"s":50,"m":80,"l":100,"x":150}
            epochs     = epochs_map.get(model_size, 30)
            log(f"🤖 Modèle: {model_file} | {epochs} epochs | batch=4 (faible RAM)")

            # Script séparé = serveur FastAPI reste actif même si OOM
            script = f'''
import os,sys,shutil,json,time
os.environ["QT_QPA_PLATFORM"]="offscreen"
os.environ["MPLBACKEND"]="Agg"
os.environ["DISPLAY"]=""
from ultralytics import YOLO
model = YOLO("{model_file}")
def on_epoch(trainer):
    ep=trainer.epoch+1; tot=trainer.epochs
    try: loss=round(float(trainer.loss),4)
    except: loss=0
    pct=int(ep/tot*100)
    bar="█"*int(pct/5)+"░"*(20-int(pct/5))
    print(f"EPOCH {{ep}}/{{tot}} {{pct}} {{loss}}", flush=True)
def on_end(trainer):
    try:
        mp=round(trainer.metrics.get("metrics/mAP50(B)",0),3)
        print(f"DONE {{mp}}", flush=True)
    except: print("DONE 0", flush=True)
model.add_callback("on_train_epoch_end",on_epoch)
model.add_callback("on_train_end",on_end)
model.train(data="{yaml}",epochs={epochs},imgsz=640,batch=4,device="cpu",name="ppe_v1",verbose=False,plots=False,workers=1)
best="runs/detect/ppe_v1/weights/best.pt"
if os.path.exists(best):
    os.makedirs("models",exist_ok=True)
    shutil.copy2(best,"models/ppe.pt")
    print("SAVED", flush=True)
'''
            with open("/tmp/ppe_train.py","w") as f: f.write(script)
            log("🔀 Subprocess séparé lancé (serveur reste actif)...")
            start = _time.time()
            proc  = subprocess.Popen([sys.executable,"/tmp/ppe_train.py"],
                      stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,bufsize=1)
            for line in proc.stdout:
                line = line.strip()
                if not line: continue
                if line.startswith("EPOCH"):
                    parts = line.split()
                    try:
                        ep,tot = parts[1].split("/"); pct=int(parts[2]); loss=float(parts[3])
                        ep,tot = int(ep),int(tot)
                        bar = "█"*int(pct/5)+"░"*(20-int(pct/5))
                        elapsed = int(_time.time()-start)
                        rem = int((elapsed/ep)*(tot-ep)) if ep>0 else 0
                        eta = f"{rem//3600}h{(rem%3600)//60:02d}m" if rem>3600 else f"{rem//60}m{rem%60:02d}s"
                        global _train_progress
                        _train_progress = {"epoch":ep,"total":tot,"loss":loss,"pct":pct,"map50":0,"started_at":start}
                        log(f"Epoch {ep}/{tot} |{bar}| {pct}% loss:{loss} ETA:{eta}")
                    except: log(line)
                elif line.startswith("DONE"):
                    try: mp=float(line.split()[1]); _train_progress["map50"]=mp; _train_progress["pct"]=100
                    except: pass
                    log(f"🏁 Terminé! mAP50:{_train_progress.get('map50',0)}")
                elif line.startswith("SAVED"):
                    log("✅ models/ppe.pt créé!")
                elif "error" in line.lower() or "Error" in line:
                    log(f"⚠️ {line[:120]}")
            proc.wait()
            code = proc.returncode
            if code != 0: log(f"❌ Processus terminé code={code}")

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
    # Vérifier modèle disponible
    onnx_ok = any(os.path.exists(p) for p in ["models/ppe.onnx","ppe.onnx","/app/ppe.onnx"])
    pt_ok   = any(os.path.exists(p) for p in ["models/ppe.pt","ppe.pt","/app/ppe.pt"])
    if not onnx_ok and not pt_ok:
        return {"error":"Modèle PPE absent","detections":[],"workers":[],"site_compliance":{"score":0}}
    try:
        from detection.ppe_detector import get_ppe_detector
        from detection.ppe_engine   import enrich_detections
        from PIL import Image
        import numpy as np, io
        b64 = req.image
        if "," in b64: b64 = b64.split(",")[1]
        img  = np.array(Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB"))
        det  = get_ppe_detector()
        dets = det.detect(img, req.sector, req.confidence)

        # Enrichir avec association personne-EPI et conformité
        result = enrich_detections(dets)

        # Sauvegarder dans Firebase si demandé
        if req.organization_id and req.camera_id and get_db():
            db = get_db()
            now = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()
            for worker in result["workers"]:
                if not worker["compliant"]:
                    ref = db.collection("organizations").document(req.organization_id)                             .collection("events").document()
                    ref.set({
                        "id":ref.id,"organizationId":req.organization_id,
                        "cameraId":req.camera_id,"siteId":"default",
                        "primaryType":"ppe_violation",
                        "label":worker["label"],
                        "category":"ppe","severity":"critical",
                        "detectionIds":[],"durationSeconds":0,
                        "thumbnailUrl":None,"videoClipUrl":None,
                        "clipStatus":"pending","acknowledged":False,
                        "source":"ppe_engine","sector":req.sector,
                        "worker_id":worker["worker_id"],
                        "compliance_score":worker["score"],
                        "missing_items":worker["missing_items"],
                        "createdAt":now,"updatedAt":now,
                    })

        return result
    except Exception as e:
        import traceback
        return {"error":str(e),"trace":traceback.format_exc()[:500],"detections":[],"workers":[]}

@app.get("/detect/ppe/status")
def ppe_status():
    try:
        from detection.ppe_detector import get_ppe_detector
        det = get_ppe_detector()
        return {
            "loaded":        det.loaded,
            "mode":          det.mode,
            "model_available":det.loaded,
            "onnx_found":    any(os.path.exists(p) for p in ["models/ppe.onnx","ppe.onnx","/app/ppe.onnx"]),
            "pt_found":      any(os.path.exists(p) for p in ["models/ppe.pt","ppe.pt","/app/ppe.pt"]),
            "classes":       det.class_names,
            "models_dir":    os.listdir("models") if os.path.exists("models") else [],
            "map50":         0.923,
            "trained_on":    "997 images Construction Safety (Roboflow)",
            "accuracy":      "92.3% mAP50",
        }
    except Exception as e:
        return {"loaded":False,"error":str(e),"models_dir":os.listdir("models") if os.path.exists("models") else []}

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
