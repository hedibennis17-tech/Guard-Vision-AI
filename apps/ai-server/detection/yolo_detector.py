"""
YOLOv11 Detector — ONNX Runtime (sans torch, léger pour Railway)
Modèle YOLO11n.onnx téléchargé automatiquement au 1er démarrage (~12MB)
"""
import os, urllib.request, base64, time
from typing import List, Dict, Any, Optional
import numpy as np
import cv2
from loguru import logger
from config.settings import settings

# URL du modèle YOLO11n ONNX (officiel ultralytics)
YOLO_ONNX_URL = "https://github.com/ultralytics/assets/releases/download/v8.3.0/yolo11n.onnx"
YOLO_ONNX_PATH = "models/yolo11n.onnx"

# Classes COCO (80 classes standard)
COCO_CLASSES = [
    "person","bicycle","car","motorcycle","airplane","bus","train","truck","boat",
    "traffic light","fire hydrant","stop sign","parking meter","bench","bird","cat",
    "dog","horse","sheep","cow","elephant","bear","zebra","giraffe","backpack",
    "umbrella","handbag","tie","suitcase","frisbee","skis","snowboard","sports ball",
    "kite","baseball bat","baseball glove","skateboard","surfboard","tennis racket",
    "bottle","wine glass","cup","fork","knife","spoon","bowl","banana","apple",
    "sandwich","orange","broccoli","carrot","hot dog","pizza","donut","cake","chair",
    "couch","potted plant","bed","dining table","toilet","tv","laptop","mouse",
    "remote","keyboard","cell phone","microwave","oven","toaster","sink","refrigerator",
    "book","clock","vase","scissors","teddy bear","hair drier","toothbrush",
]

# Mapping enrichi par module
MODULE_CLASS_MAPS: Dict[str, Dict] = {
    "construction": {
        "person":     {"label":"Travailleur — Vérif. EPI requis","icon":"👷","severity":"warning","alert":True, "category":"human"},
        "truck":      {"label":"Engin lourd — zone 5m",           "icon":"🚛","severity":"warning","alert":True, "category":"vehicle"},
        "car":        {"label":"Véhicule non autorisé",           "icon":"🚗","severity":"warning","alert":True, "category":"vehicle"},
        "motorcycle": {"label":"Moto sur chantier 🚨",            "icon":"🏍️","severity":"critical","alert":True,"category":"vehicle"},
        "bicycle":    {"label":"Vélo zone chantier",              "icon":"🚲","severity":"warning","alert":True, "category":"vehicle"},
        "scissors":   {"label":"Outil tranchant",                 "icon":"✂️","severity":"warning","alert":True, "category":"object"},
        "cell phone": {"label":"Téléphone — distraction",         "icon":"📵","severity":"warning","alert":True, "category":"human"},
    },
    "industrial": {
        "person":     {"label":"Travailleur — Vérif. EPI & Uniforme","icon":"👷","severity":"warning","alert":True,"category":"human"},
        "truck":      {"label":"Chariot élévateur",                  "icon":"🏭","severity":"warning","alert":True,"category":"vehicle"},
        "car":        {"label":"Véhicule zone production",           "icon":"🚗","severity":"warning","alert":True,"category":"vehicle"},
        "motorcycle": {"label":"Moto zone industrielle 🚨",          "icon":"🏍️","severity":"critical","alert":True,"category":"vehicle"},
        "bottle":     {"label":"Conteneur chimique potentiel",       "icon":"⚗️","severity":"warning","alert":True,"category":"object"},
        "cell phone": {"label":"Téléphone zone interdite",           "icon":"📵","severity":"warning","alert":True,"category":"human"},
    },
    "retail": {
        "person":     {"label":"Client en magasin",   "icon":"🛍️","severity":"info",    "alert":False,"category":"human"},
        "backpack":   {"label":"Sac suspect (vol?)",  "icon":"🎒","severity":"warning", "alert":True, "category":"human"},
        "suitcase":   {"label":"Gros bagage suspect", "icon":"🧳","severity":"warning", "alert":True, "category":"human"},
        "handbag":    {"label":"Sac à main",          "icon":"👜","severity":"info",    "alert":False,"category":"human"},
        "cell phone": {"label":"Téléphone (scan?)",   "icon":"📱","severity":"info",    "alert":False,"category":"object"},
    },
    "transportation": {
        "car":          {"label":"Voiture",       "icon":"🚗","severity":"info","alert":False,"category":"vehicle"},
        "truck":        {"label":"Camion",        "icon":"🚛","severity":"info","alert":False,"category":"vehicle"},
        "bus":          {"label":"Bus",           "icon":"🚌","severity":"info","alert":False,"category":"vehicle"},
        "motorcycle":   {"label":"Moto",          "icon":"🏍️","severity":"info","alert":False,"category":"vehicle"},
        "bicycle":      {"label":"Vélo",          "icon":"🚲","severity":"info","alert":False,"category":"vehicle"},
        "person":       {"label":"Piéton",        "icon":"🚶","severity":"info","alert":False,"category":"human"},
        "stop sign":    {"label":"Stop",          "icon":"🛑","severity":"info","alert":False,"category":"object"},
        "traffic light":{"label":"Feu circulation","icon":"🚦","severity":"info","alert":False,"category":"object"},
    },
    "defense": {
        "person":     {"label":"INTRUS 🚨",          "icon":"🚨","severity":"critical","alert":True,"category":"human"},
        "car":        {"label":"Véhicule suspect",   "icon":"🚗","severity":"critical","alert":True,"category":"vehicle"},
        "truck":      {"label":"Véhicule lourd",     "icon":"🚛","severity":"critical","alert":True,"category":"vehicle"},
        "motorcycle": {"label":"Deux-roues rapide",  "icon":"🏍️","severity":"warning","alert":True,"category":"vehicle"},
        "backpack":   {"label":"Colis suspect",      "icon":"🎒","severity":"critical","alert":True,"category":"human"},
    },
    "home_security": {
        "person":     {"label":"Personne détectée",  "icon":"🚨","severity":"warning","alert":True, "category":"human"},
        "car":        {"label":"Véhicule",           "icon":"🚗","severity":"info",   "alert":False,"category":"vehicle"},
        "truck":      {"label":"Camion / Livraison", "icon":"🚛","severity":"info",   "alert":False,"category":"vehicle"},
        "motorcycle": {"label":"Moto suspecte",      "icon":"🏍️","severity":"warning","alert":True,"category":"vehicle"},
        "dog":        {"label":"Chien",              "icon":"🐕","severity":"info",   "alert":False,"category":"animal"},
        "cat":        {"label":"Chat",               "icon":"🐈","severity":"info",   "alert":False,"category":"animal"},
        "backpack":   {"label":"Sac à dos",          "icon":"🎒","severity":"warning","alert":True, "category":"human"},
    },
    "agriculture": {
        "person":  {"label":"Intrus / Braconnage","icon":"🚨","severity":"critical","alert":True, "category":"human"},
        "dog":     {"label":"Chien de ferme",     "icon":"🐕","severity":"info",    "alert":False,"category":"animal"},
        "horse":   {"label":"Cheval",             "icon":"🐎","severity":"info",    "alert":False,"category":"animal"},
        "cow":     {"label":"Vache / Bovin",      "icon":"🐄","severity":"info",    "alert":False,"category":"animal"},
        "sheep":   {"label":"Mouton",             "icon":"🐑","severity":"info",    "alert":False,"category":"animal"},
        "bird":    {"label":"Oiseau nuisible",    "icon":"🐦","severity":"info",    "alert":False,"category":"animal"},
        "car":     {"label":"Véhicule suspect",   "icon":"🚗","severity":"warning", "alert":True, "category":"vehicle"},
        "truck":   {"label":"Camion / Tracteur",  "icon":"🚛","severity":"info",    "alert":False,"category":"vehicle"},
    },
    "smart_city": {
        "person":  {"label":"Piéton",     "icon":"🚶","severity":"info","alert":False,"category":"human"},
        "car":     {"label":"Véhicule",   "icon":"🚗","severity":"info","alert":False,"category":"vehicle"},
        "bicycle": {"label":"Vélo",       "icon":"🚲","severity":"info","alert":False,"category":"vehicle"},
        "bus":     {"label":"Bus",        "icon":"🚌","severity":"info","alert":False,"category":"vehicle"},
        "backpack":{"label":"Colis suspect","icon":"📦","severity":"warning","alert":True,"category":"security"},
    },
}

class YOLOOnnxDetector:
    """Détecteur YOLO via ONNX Runtime — léger, sans torch"""

    def __init__(self):
        self.session = None
        self.loaded  = False
        self.input_name = None
        self._load()

    def _download_model(self):
        os.makedirs("models", exist_ok=True)
        if not os.path.exists(YOLO_ONNX_PATH):
            logger.info(f"📥 Téléchargement yolo11n.onnx (~12MB)...")
            urllib.request.urlretrieve(YOLO_ONNX_URL, YOLO_ONNX_PATH)
            logger.success("✅ Modèle téléchargé")

    def _load(self):
        try:
            import onnxruntime as ort
            self._download_model()
            opts = ort.SessionOptions()
            opts.inter_op_num_threads = 2
            opts.intra_op_num_threads = 2
            self.session = ort.InferenceSession(
                YOLO_ONNX_PATH,
                sess_options=opts,
                providers=["CPUExecutionProvider"],
            )
            self.input_name = self.session.get_inputs()[0].name
            self.loaded = True
            logger.success("✅ YOLO11n ONNX chargé")
        except Exception as e:
            logger.error(f"❌ ONNX load error: {e}")

    def _preprocess(self, img: np.ndarray, size=640):
        """Resize + normalize pour YOLO"""
        h, w = img.shape[:2]
        scale = min(size/w, size/h)
        nw, nh = int(w*scale), int(h*scale)
        resized = cv2.resize(img, (nw, nh))
        padded  = np.full((size, size, 3), 114, dtype=np.uint8)
        padded[:nh, :nw] = resized
        blob = padded.astype(np.float32) / 255.0
        blob = np.transpose(blob, (2,0,1))[np.newaxis]  # NCHW
        return blob, scale, (0, 0)

    def _postprocess(self, output, scale, orig_shape, conf_thresh=0.45):
        """Parser la sortie YOLO ONNX"""
        predictions = output[0]  # (1, 84, 8400)
        if predictions.ndim == 3:
            predictions = predictions[0]  # (84, 8400)
        predictions = predictions.T        # (8400, 84)

        detections = []
        h_orig, w_orig = orig_shape[:2]

        for pred in predictions:
            cx, cy, pw, ph = pred[0], pred[1], pred[2], pred[3]
            class_scores = pred[4:]
            class_id     = int(np.argmax(class_scores))
            confidence   = float(class_scores[class_id])

            if confidence < conf_thresh:
                continue

            # Convertir de espace normalisé à pixels originaux
            x1 = int((cx - pw/2) / scale)
            y1 = int((cy - ph/2) / scale)
            x2 = int((cx + pw/2) / scale)
            y2 = int((cy + ph/2) / scale)

            x1 = max(0, min(x1, w_orig))
            y1 = max(0, min(y1, h_orig))
            x2 = max(0, min(x2, w_orig))
            y2 = max(0, min(y2, h_orig))

            if x2 <= x1 or y2 <= y1:
                continue

            cls_name = COCO_CLASSES[class_id] if class_id < len(COCO_CLASSES) else f"class_{class_id}"
            detections.append({
                "class_id": class_id, "class": cls_name,
                "score":    round(confidence, 3),
                "bbox":     [x1, y1, x2, y2],
            })

        # NMS
        if not detections:
            return []
        boxes  = [[d["bbox"][0],d["bbox"][1],d["bbox"][2]-d["bbox"][0],d["bbox"][3]-d["bbox"][1]] for d in detections]
        scores = [d["score"] for d in detections]
        indices= cv2.dnn.NMSBoxes(boxes, scores, conf_thresh, 0.45)
        return [detections[i] for i in (indices.flatten() if len(indices) else [])]

    def detect(self, image_data, module_id:str="general", confidence:Optional[float]=None) -> List[Dict]:
        if not self.loaded: return []
        conf = confidence or settings.YOLO_CONFIDENCE
        img  = self._decode_image(image_data)
        if img is None: return []

        blob, scale, _ = self._preprocess(img)

        try:
            outputs = self.session.run(None, {self.input_name: blob})
        except Exception as e:
            logger.error(f"ONNX run error: {e}"); return []

        raw_dets  = self._postprocess(outputs, scale, img.shape, conf)
        class_map = MODULE_CLASS_MAPS.get(module_id, {})

        results = []
        for d in raw_dets:
            cls_name = d["class"]
            enriched = class_map.get(cls_name)
            label    = enriched["label"]    if enriched else cls_name
            severity = enriched["severity"] if enriched else "info"
            category = enriched["category"] if enriched else "object"
            icon     = enriched["icon"]     if enriched else "📦"
            alert    = enriched["alert"]    if enriched else False

            results.append({
                "class":cls_name, "label":label, "icon":icon,
                "category":category, "severity":severity,
                "score":d["score"], "confidence":round(d["score"]*100,1),
                "bbox":d["bbox"],
                "center":[int((d["bbox"][0]+d["bbox"][2])/2), int((d["bbox"][1]+d["bbox"][3])/2)],
                "alert":alert, "module":module_id,
            })

        results.sort(key=lambda x: x["score"], reverse=True)
        return results

    def _decode_image(self, data) -> Optional[np.ndarray]:
        try:
            if isinstance(data, np.ndarray): return data
            if isinstance(data, str):
                if "," in data: data = data.split(",")[1]
                data = base64.b64decode(data)
            arr = np.frombuffer(data, np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            return cv2.cvtColor(img, cv2.COLOR_BGR2RGB) if img is not None else None
        except: return None

    @property
    def models(self): return {"general": "yolo11n.onnx"}


_detector: Optional[YOLOOnnxDetector] = None
def get_detector() -> YOLOOnnxDetector:
    global _detector
    if _detector is None: _detector = YOLOOnnxDetector()
    return _detector
