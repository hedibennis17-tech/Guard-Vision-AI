"""
Shoplifting Detector — Vision Guard AI
Source: github.com/pyresearch/Shoplifting-Detection

STATUT:
- Si models/shoplifting_wights.pt présent → modèle PyResearch précis
- Sinon → détection comportementale (personnes + sacs suspects)
"""
import os, base64
from typing import Optional, List, Dict, Any
import numpy as np
from datetime import datetime
from loguru import logger


class ShopliftingDetector:
    def __init__(self, weights_path: str = "models/shoplifting_wights.pt"):
        self.weights_path = weights_path
        self.model        = None
        self.loaded       = False
        self.mode         = "not_loaded"
        self._load()

    def _load(self):
        if os.path.exists(self.weights_path):
            try:
                from ultralytics import YOLO
                self.model  = YOLO(self.weights_path)
                self.loaded = True
                self.mode   = "pyresearch_model"
                logger.success(f"✅ Shoplifting model PyResearch chargé: {self.weights_path}")
            except Exception as e:
                logger.error(f"❌ Erreur chargement shoplifting: {e}")
        else:
            # Mode fallback comportemental
            self.loaded = True
            self.mode   = "behavioral_fallback"
            logger.warning(
                f"⚠️ {self.weights_path} non trouvé.\n"
                f"   Mode fallback: détection comportementale (backpack + person)\n"
                f"   Pour activer le modèle PyResearch:\n"
                f"   → Contacter https://github.com/pyresearch\n"
                f"   → OU entraîner avec train_shoplifting.py\n"
                f"   → Placer les poids dans {self.weights_path}"
            )

    def detect(self, image: np.ndarray, confidence: float = 0.50) -> List[Dict]:
        if self.mode == "pyresearch_model" and self.model:
            return self._detect_pyresearch(image, confidence)
        elif self.mode == "behavioral_fallback":
            return self._detect_behavioral(image, confidence)
        return []

    def _detect_pyresearch(self, image: np.ndarray, confidence: float) -> List[Dict]:
        """Détection précise via modèle PyResearch"""
        try:
            results = self.model.predict(image, conf=confidence, verbose=False)
            detections = []
            for r in results:
                if r.boxes is None: continue
                for box, conf, cls in zip(
                    r.boxes.xyxy.cpu().numpy().astype(int),
                    r.boxes.conf.cpu().numpy(),
                    r.boxes.cls.cpu().numpy().astype(int)
                ):
                    x1,y1,x2,y2 = box.tolist()
                    is_theft = (cls == 1)
                    detections.append({
                        "class":      "shoplifting" if is_theft else "customer_normal",
                        "label":      "🚨 VOL DÉTECTÉ" if is_theft else "Client normal",
                        "icon":       "🚨" if is_theft else "✅",
                        "category":   "shoplifting" if is_theft else "human",
                        "severity":   "critical" if is_theft else "info",
                        "score":      round(float(conf), 3),
                        "confidence": round(float(conf)*100, 1),
                        "bbox":       [x1,y1,x2,y2],
                        "center":     [int((x1+x2)/2), int((y1+y2)/2)],
                        "alert":      is_theft,
                        "module":     "retail",
                        "source":     "pyresearch_model",
                        "timestamp":  datetime.now().isoformat(),
                    })
            return detections
        except Exception as e:
            logger.error(f"PyResearch detect error: {e}")
            return []

    def _detect_behavioral(self, image: np.ndarray, confidence: float) -> List[Dict]:
        """
        Fallback: utilise YOLO général + heuristiques comportementales
        Détecte personnes + sacs suspects en zone de vente
        """
        try:
            import onnxruntime as ort
            import urllib.request

            model_path = "models/yolo11n.onnx"
            if not os.path.exists(model_path):
                os.makedirs("models", exist_ok=True)
                urllib.request.urlretrieve(
                    "https://github.com/ultralytics/assets/releases/download/v8.3.0/yolo11n.onnx",
                    model_path
                )

            # Utiliser le modèle ONNX général
            from PIL import Image as PILImage
            import io

            if not hasattr(self, '_onnx_session'):
                opts = ort.SessionOptions()
                opts.inter_op_num_threads = 1
                opts.intra_op_num_threads = 1
                self._onnx_session = ort.InferenceSession(
                    model_path, sess_options=opts,
                    providers=["CPUExecutionProvider"]
                )

            # Détection classes retail
            RETAIL_ALERT_CLASSES = {"backpack","suitcase","handbag"}
            RETAIL_INFO_CLASSES  = {"person","cell phone","bottle"}

            h, w = image.shape[:2]
            SIZE  = 640
            scale = min(SIZE/w, SIZE/h)
            nw, nh = int(w*scale), int(h*scale)

            pil_img = PILImage.fromarray(image).resize((nw, nh))
            padded  = PILImage.new("RGB", (SIZE,SIZE), (114,114,114))
            padded.paste(pil_img, (0,0))
            blob = np.array(padded, dtype=np.float32)/255.0
            blob = np.transpose(blob,(2,0,1))[np.newaxis]

            input_name = self._onnx_session.get_inputs()[0].name
            outputs    = self._onnx_session.run(None, {input_name: blob})
            preds      = outputs[0][0].T

            COCO = ["person","bicycle","car","motorcycle","airplane","bus","train","truck",
                    "boat","traffic light","fire hydrant","stop sign","parking meter","bench",
                    "bird","cat","dog","horse","sheep","cow","elephant","bear","zebra","giraffe",
                    "backpack","umbrella","handbag","tie","suitcase","frisbee"]

            detections = []
            for pred in preds:
                scores = pred[4:]
                cls_id = int(np.argmax(scores))
                conf   = float(scores[cls_id])
                if conf < confidence: continue
                if cls_id >= len(COCO): continue

                cls_name = COCO[cls_id]
                if cls_name not in RETAIL_ALERT_CLASSES and cls_name not in RETAIL_INFO_CLASSES:
                    continue

                cx,cy,pw,ph = pred[0],pred[1],pred[2],pred[3]
                x1 = int(max(0,(cx-pw/2)/scale))
                y1 = int(max(0,(cy-ph/2)/scale))
                x2 = int(min(w,(cx+pw/2)/scale))
                y2 = int(min(h,(cy+ph/2)/scale))
                if x2<=x1 or y2<=y1: continue

                is_alert = cls_name in RETAIL_ALERT_CLASSES
                detections.append({
                    "class":      cls_name,
                    "label":      f"⚠️ {cls_name.title()} suspect (comportement)" if is_alert else f"Client ({cls_name})",
                    "icon":       "⚠️" if is_alert else "🛍️",
                    "category":   "behavior" if is_alert else "human",
                    "severity":   "warning" if is_alert else "info",
                    "score":      round(conf, 3),
                    "confidence": round(conf*100, 1),
                    "bbox":       [x1,y1,x2,y2],
                    "center":     [int((x1+x2)/2), int((y1+y2)/2)],
                    "alert":      is_alert,
                    "module":     "retail",
                    "source":     "behavioral_fallback",
                    "note":       "Modèle PyResearch non disponible — détection comportementale",
                    "timestamp":  datetime.now().isoformat(),
                })

            return detections

        except Exception as e:
            logger.error(f"Behavioral detect error: {e}")
            return []

    def detect_b64(self, b64: str, confidence: float = 0.50) -> List[Dict]:
        try:
            if "," in b64: b64 = b64.split(",")[1]
            import cv2
            arr = np.frombuffer(base64.b64decode(b64), np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if img is None: return []
            return self.detect(cv2.cvtColor(img, cv2.COLOR_BGR2RGB), confidence)
        except: return []

    @property
    def status(self):
        return {
            "loaded":   self.loaded,
            "mode":     self.mode,
            "path":     self.weights_path,
            "model_available": os.path.exists(self.weights_path),
            "source":   "github.com/pyresearch/Shoplifting-Detection",
            "instructions": "Pour activer le modèle précis: placer shoplifting_wights.pt dans models/",
        }


_inst: Optional[ShopliftingDetector] = None
def get_shoplifting_detector() -> ShopliftingDetector:
    global _inst
    if _inst is None: _inst = ShopliftingDetector()
    return _inst
