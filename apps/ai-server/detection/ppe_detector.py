"""
PPE Detector — ONNX Runtime (sans torch/ultralytics)
Utilise ppe.onnx exporté depuis YOLOv11
Classes: helmet, no-helmet, no-vest, person, vest
"""
import os, base64
from typing import Optional, List, Dict
import numpy as np
from loguru import logger

PPE_CLASS_MAP = {
    "helmet":    {"label":"Casque ✅",         "severity":"info",    "alert":False,"icon":"⛑️","category":"ppe"},
    "no-helmet": {"label":"SANS CASQUE 🚨",     "severity":"critical","alert":True, "icon":"🚫","category":"ppe"},
    "no_helmet": {"label":"SANS CASQUE 🚨",     "severity":"critical","alert":True, "icon":"🚫","category":"ppe"},
    "vest":      {"label":"Gilet haute-vis ✅", "severity":"info",    "alert":False,"icon":"🦺","category":"ppe"},
    "safety_vest":{"label":"Gilet haute-vis ✅","severity":"info",    "alert":False,"icon":"🦺","category":"ppe"},
    "no-vest":   {"label":"SANS GILET 🚨",      "severity":"critical","alert":True, "icon":"🚫","category":"ppe"},
    "no_vest":   {"label":"SANS GILET 🚨",      "severity":"critical","alert":True, "icon":"🚫","category":"ppe"},
    "person":    {"label":"Travailleur 👷",     "severity":"warning", "alert":True, "icon":"👷","category":"human"},
}

ONNX_PATHS = ["models/ppe.onnx","ppe.onnx","/app/ppe.onnx","/app/models/ppe.onnx"]
PT_PATHS   = ["models/ppe.pt","ppe.pt","/app/ppe.pt","/app/models/ppe.pt"]

class PPEDetector:
    def __init__(self):
        self.session    = None
        self.loaded     = False
        self.mode       = "not_loaded"
        self.class_names= list(PPE_CLASS_MAP.keys())
        self._load()

    def _load(self):
        # Essai 1: ONNX Runtime (léger, pas de torch)
        for path in ONNX_PATHS:
            if os.path.exists(path):
                try:
                    import onnxruntime as ort
                    opts = ort.SessionOptions()
                    opts.inter_op_num_threads = 2
                    opts.intra_op_num_threads = 2
                    self.session = ort.InferenceSession(path, sess_options=opts,
                                   providers=["CPUExecutionProvider"])
                    # Lire les noms de classes depuis les métadonnées si disponibles
                    meta = self.session.get_modelmeta().custom_metadata_map
                    if "names" in meta:
                        import ast
                        names = ast.literal_eval(meta["names"])
                        if isinstance(names, dict):
                            self.class_names = [names[i] for i in sorted(names.keys())]
                        elif isinstance(names, list):
                            self.class_names = names
                    self.loaded = True
                    self.mode   = "onnx"
                    logger.success(f"✅ PPE ONNX chargé: {path} | Classes: {self.class_names}")
                    return
                except Exception as e:
                    logger.warning(f"⚠️ ONNX {path}: {e}")

        # Essai 2: ultralytics (si disponible)
        for path in PT_PATHS:
            if os.path.exists(path):
                try:
                    from ultralytics import YOLO
                    self._pt_model = YOLO(path)
                    self.loaded    = True
                    self.mode      = "pytorch"
                    logger.success(f"✅ PPE PyTorch chargé: {path}")
                    return
                except Exception as e:
                    logger.warning(f"⚠️ PyTorch {path}: {e}")

        logger.warning("⚠️ PPE: aucun modèle ONNX trouvé. Uploader ppe.onnx sur GitHub → apps/ai-server/")

    def detect(self, image: np.ndarray, sector:str="general", confidence:float=0.40) -> List[Dict]:
        if not self.loaded: return []
        if self.mode == "onnx":   return self._detect_onnx(image, confidence)
        if self.mode == "pytorch": return self._detect_pt(image, confidence)
        return []

    def _detect_onnx(self, img: np.ndarray, conf_thresh:float) -> List[Dict]:
        try:
            from PIL import Image
            h, w = img.shape[:2]
            SIZE  = 640
            scale = min(SIZE/w, SIZE/h)
            nw, nh = int(w*scale), int(h*scale)
            pil   = Image.fromarray(img).resize((nw,nh), Image.BILINEAR)
            pad   = Image.new("RGB",(SIZE,SIZE),(114,114,114))
            pad.paste(pil,(0,0))
            blob  = np.array(pad,dtype=np.float32)/255.0
            blob  = np.transpose(blob,(2,0,1))[np.newaxis]
            input_name = self.session.get_inputs()[0].name
            outputs    = self.session.run(None,{input_name:blob})
            preds      = outputs[0][0].T  # (8400,nc+4)
            dets = []
            for pred in preds:
                scores = pred[4:]
                ci     = int(np.argmax(scores))
                conf   = float(scores[ci])
                if conf < conf_thresh: continue
                cx,cy,pw,ph = pred[0],pred[1],pred[2],pred[3]
                x1=int(max(0,(cx-pw/2)/scale)); y1=int(max(0,(cy-ph/2)/scale))
                x2=int(min(w,(cx+pw/2)/scale)); y2=int(min(h,(cy+ph/2)/scale))
                if x2<=x1 or y2<=y1: continue
                cls_name = self.class_names[ci] if ci<len(self.class_names) else f"cls{ci}"
                info     = PPE_CLASS_MAP.get(cls_name,{"label":cls_name,"severity":"info","alert":False,"icon":"📦","category":"object"})
                dets.append({
                    "class":cls_name,"label":info["label"],"icon":info["icon"],
                    "category":info["category"],"severity":info["severity"],
                    "score":round(conf,3),"confidence":round(conf*100,1),
                    "bbox":[x1,y1,x2,y2],"center":[int((x1+x2)/2),int((y1+y2)/2)],
                    "alert":info["alert"],"module":"ppe","model":"ppe_onnx",
                })
            dets.sort(key=lambda d:(d["severity"]=="critical",d["score"]),reverse=True)
            return dets
        except Exception as e:
            logger.error(f"PPE ONNX detect: {e}"); return []

    def _detect_pt(self, img: np.ndarray, conf_thresh:float) -> List[Dict]:
        try:
            results = self._pt_model.predict(img, conf=conf_thresh, verbose=False)
            dets = []
            for r in results:
                if r.boxes is None: continue
                for box in r.boxes:
                    cls_name = r.names[int(box.cls[0])]
                    conf     = float(box.conf[0])
                    x1,y1,x2,y2 = [int(v) for v in box.xyxy[0].tolist()]
                    info = PPE_CLASS_MAP.get(cls_name,{"label":cls_name,"severity":"info","alert":False,"icon":"📦","category":"object"})
                    dets.append({
                        "class":cls_name,"label":info["label"],"icon":info["icon"],
                        "category":info["category"],"severity":info["severity"],
                        "score":round(conf,3),"confidence":round(conf*100,1),
                        "bbox":[x1,y1,x2,y2],"center":[int((x1+x2)/2),int((y1+y2)/2)],
                        "alert":info["alert"],"module":"ppe","model":"ppe_pytorch",
                    })
            return dets
        except Exception as e:
            logger.error(f"PPE PT detect: {e}"); return []

    def get_compliance_score(self, dets:List[Dict]) -> Dict:
        critical = [d for d in dets if d["severity"]=="critical" and d["alert"]]
        warnings = [d for d in dets if d["severity"]=="warning"  and d["alert"]]
        score    = max(0, 100 - len(critical)*25 - len(warnings)*10)
        return {"score":score,"critical":len(critical),"warnings":len(warnings),
                "violations":[d["label"] for d in critical+warnings],"compliant":score>=80}

    @property
    def status(self):
        return {
            "loaded":     self.loaded,
            "mode":       self.mode,
            "classes":    self.class_names,
            "onnx_found": any(os.path.exists(p) for p in ONNX_PATHS),
            "pt_found":   any(os.path.exists(p) for p in PT_PATHS),
            "models_dir": os.listdir("models") if os.path.exists("models") else [],
        }

_ppe:Optional[PPEDetector]=None
def get_ppe_detector()->PPEDetector:
    global _ppe
    if _ppe is None: _ppe=PPEDetector()
    return _ppe
