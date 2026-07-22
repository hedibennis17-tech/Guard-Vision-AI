"""
PPE Detector — Vision Guard AI
16 classes: helmet/no_helmet/vest/no_vest/gloves/no_gloves/
            boots/no_boots/glasses/no_glasses/harness/no_harness/
            uniform/no_uniform/mask/person
Charge dans l'ordre: ppe_final.pt → ppe.pt → ppe_final.onnx → ppe.onnx
"""
import os, numpy as np
from loguru import logger
from typing import Optional, List, Dict

FINAL_CLASSES = [
    "helmet","no_helmet","vest","no_vest","gloves","no_gloves",
    "boots","no_boots","glasses","no_glasses","harness","no_harness",
    "uniform","no_uniform","mask","person"
]

CLASS_INFO = {
    "helmet":   {"label":"Casque ✅",          "severity":"info",    "alert":False, "icon":"⛑️",  "color":"#10B981"},
    "no_helmet":{"label":"SANS CASQUE 🚨",     "severity":"critical","alert":True,  "icon":"🚫",  "color":"#EF4444"},
    "no-helmet":{"label":"SANS CASQUE 🚨",     "severity":"critical","alert":True,  "icon":"🚫",  "color":"#EF4444"},
    "vest":     {"label":"Gilet ✅",            "severity":"info",    "alert":False, "icon":"🦺",  "color":"#10B981"},
    "no_vest":  {"label":"SANS GILET 🚨",      "severity":"critical","alert":True,  "icon":"🚫",  "color":"#EF4444"},
    "no-vest":  {"label":"SANS GILET 🚨",      "severity":"critical","alert":True,  "icon":"🚫",  "color":"#EF4444"},
    "gloves":   {"label":"Gants ✅",            "severity":"info",    "alert":False, "icon":"🧤",  "color":"#10B981"},
    "no_gloves":{"label":"SANS GANTS 🚨",      "severity":"critical","alert":True,  "icon":"🚫",  "color":"#EF4444"},
    "boots":    {"label":"Bottes sécu ✅",      "severity":"info",    "alert":False, "icon":"👢",  "color":"#10B981"},
    "no_boots": {"label":"SANS BOTTES 🚨",     "severity":"warning", "alert":True,  "icon":"⚠️", "color":"#F59E0B"},
    "glasses":  {"label":"Lunettes sécu ✅",    "severity":"info",    "alert":False, "icon":"🥽",  "color":"#10B981"},
    "no_glasses":{"label":"SANS LUNETTES ⚠️", "severity":"warning", "alert":True,  "icon":"⚠️", "color":"#F59E0B"},
    "harness":  {"label":"Harnais ✅",          "severity":"info",    "alert":False, "icon":"🪝",  "color":"#10B981"},
    "no_harness":{"label":"SANS HARNAIS 🚨",   "severity":"critical","alert":True,  "icon":"🚫",  "color":"#EF4444"},
    "uniform":  {"label":"Uniforme ✅",         "severity":"info",    "alert":False, "icon":"👷",  "color":"#10B981"},
    "no_uniform":{"label":"SANS UNIFORME ⚠️", "severity":"warning", "alert":True,  "icon":"⚠️", "color":"#F59E0B"},
    "mask":     {"label":"Masque ✅",           "severity":"info",    "alert":False, "icon":"😷",  "color":"#10B981"},
    "person":   {"label":"Travailleur 👷",      "severity":"info",    "alert":False, "icon":"👷",  "color":"#3B82F6"},
}

# Priorité de chargement des modèles
MODEL_PRIORITY = [
    ("pt",   "models/ppe_final.pt"),
    ("pt",   "models/ppe.pt"),
    ("onnx", "models/ppe_final.onnx"),
    ("onnx", "models/ppe.onnx"),
    ("pt",   "/app/ppe_final.pt"),
    ("pt",   "/app/ppe.pt"),
    ("onnx", "/app/ppe_final.onnx"),
    ("onnx", "/app/ppe.onnx"),
]

class PPEDetector:
    def __init__(self):
        self.session     = None
        self._pt_model   = None
        self.loaded      = False
        self.mode        = "not_loaded"
        self.model_path  = None
        self.class_names = FINAL_CLASSES
        self._load()

    def _load(self):
        for mode, path in MODEL_PRIORITY:
            if not os.path.exists(path):
                continue
            try:
                if mode == "onnx":
                    import onnxruntime as ort
                    opts = ort.SessionOptions()
                    opts.inter_op_num_threads = 2
                    opts.intra_op_num_threads = 2
                    self.session = ort.InferenceSession(
                        path, sess_options=opts,
                        providers=["CPUExecutionProvider"]
                    )
                    # Lire les noms de classes depuis les métadonnées
                    meta = self.session.get_modelmeta().custom_metadata_map
                    if "names" in meta:
                        import ast
                        names = ast.literal_eval(meta["names"])
                        self.class_names = [names[i] for i in sorted(names.keys())] if isinstance(names,dict) else names
                    self.loaded = True; self.mode = "onnx"; self.model_path = path
                    logger.success(f"✅ PPE ONNX: {path} | {len(self.class_names)} classes: {self.class_names}")
                    return
                else:
                    from ultralytics import YOLO
                    self._pt_model = YOLO(path)
                    self.class_names = list(self._pt_model.names.values())
                    self.loaded = True; self.mode = "pytorch"; self.model_path = path
                    logger.success(f"✅ PPE PyTorch: {path} | {len(self.class_names)} classes: {self.class_names}")
                    return
            except Exception as e:
                logger.warning(f"⚠️ {path}: {e}")

        logger.error("❌ Aucun modèle PPE trouvé dans models/")

    def detect(self, image: np.ndarray, confidence: float = 0.40) -> List[Dict]:
        if not self.loaded:
            return []
        try:
            if self.mode == "onnx":
                return self._detect_onnx(image, confidence)
            else:
                return self._detect_pt(image, confidence)
        except Exception as e:
            logger.error(f"PPE detect error: {e}")
            return []

    def _detect_onnx(self, img: np.ndarray, conf_thresh: float) -> List[Dict]:
        from PIL import Image
        h, w = img.shape[:2]
        SIZE  = 640
        scale = min(SIZE/w, SIZE/h)
        nw, nh = int(w*scale), int(h*scale)
        pil = Image.fromarray(img).resize((nw,nh), Image.BILINEAR)
        pad = Image.new("RGB",(SIZE,SIZE),(114,114,114))
        pad.paste(pil,(0,0))
        blob = np.array(pad,dtype=np.float32)/255.0
        blob = np.transpose(blob,(2,0,1))[np.newaxis]
        inp  = self.session.get_inputs()[0].name
        out  = self.session.run(None,{inp:blob})
        preds = out[0][0].T
        dets = []
        for pred in preds:
            scores = pred[4:]
            ci = int(np.argmax(scores))
            conf = float(scores[ci])
            if conf < conf_thresh: continue
            cx,cy,pw,ph = pred[0],pred[1],pred[2],pred[3]
            x1=int(max(0,(cx-pw/2)/scale)); y1=int(max(0,(cy-ph/2)/scale))
            x2=int(min(w,(cx+pw/2)/scale)); y2=int(min(h,(cy+ph/2)/scale))
            if x2<=x1 or y2<=y1: continue
            cls_name = self.class_names[ci] if ci < len(self.class_names) else f"cls{ci}"
            info = CLASS_INFO.get(cls_name, {"label":cls_name,"severity":"info","alert":False,"icon":"📦","color":"#94A3B8"})
            dets.append({
                "class":cls_name, "label":info["label"], "icon":info["icon"],
                "category":"ppe", "severity":info["severity"],
                "score":round(conf,3), "confidence":round(conf*100,1),
                "bbox":[x1,y1,x2,y2], "center":[int((x1+x2)/2),int((y1+y2)/2)],
                "alert":info["alert"], "color":info["color"], "module":"ppe",
            })
        dets.sort(key=lambda d:(d["severity"]=="critical",d["score"]), reverse=True)
        return dets

    def _detect_pt(self, img: np.ndarray, conf_thresh: float) -> List[Dict]:
        results = self._pt_model.predict(img, conf=conf_thresh, verbose=False)
        dets = []
        for r in results:
            if r.boxes is None: continue
            for box in r.boxes:
                cls_name = r.names[int(box.cls[0])]
                conf = float(box.conf[0])
                x1,y1,x2,y2 = [int(v) for v in box.xyxy[0].tolist()]
                info = CLASS_INFO.get(cls_name, {"label":cls_name,"severity":"info","alert":False,"icon":"📦","color":"#94A3B8"})
                dets.append({
                    "class":cls_name, "label":info["label"], "icon":info["icon"],
                    "category":"ppe", "severity":info["severity"],
                    "score":round(conf,3), "confidence":round(conf*100,1),
                    "bbox":[x1,y1,x2,y2], "center":[int((x1+x2)/2),int((y1+y2)/2)],
                    "alert":info["alert"], "color":info["color"], "module":"ppe",
                })
        return dets

    @property
    def status(self):
        return {
            "loaded":     self.loaded,
            "mode":       self.mode,
            "model_path": self.model_path,
            "classes":    self.class_names,
            "nc":         len(self.class_names),
            "onnx_found": any(os.path.exists(p) for _,p in MODEL_PRIORITY if p.endswith(".onnx")),
            "pt_found":   any(os.path.exists(p) for _,p in MODEL_PRIORITY if p.endswith(".pt")),
            "models_dir": os.listdir("models") if os.path.exists("models") else [],
        }

_ppe: Optional[PPEDetector] = None
def get_ppe_detector() -> PPEDetector:
    global _ppe
    if _ppe is None:
        _ppe = PPEDetector()
    return _ppe
