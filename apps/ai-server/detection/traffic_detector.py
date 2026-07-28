"""
TrafficGuard Detector — Vision Guard AI
- Détection véhicules (YOLOv8n COCO)
- Détection plaques (YOLOv8n fine-tuned)
- OCR plaques (Tesseract)
- Comptage + tracking par ligne virtuelle
"""
import os, time, numpy as np
from typing import List, Dict, Optional
from loguru import logger
from collections import defaultdict

VEHICLE_CLASSES = {1:"bicycle", 2:"car", 3:"motorcycle", 5:"bus", 7:"truck"}
VEHICLE_COLORS  = {"car":"#3B82F6","truck":"#8B5CF6","bus":"#F59E0B","motorcycle":"#10B981","bicycle":"#06B6D4"}

class TrafficDetector:
    def __init__(self):
        self.vehicle_session   = None
        self.plate_session     = None
        self.loaded            = False
        self.vehicle_count     = defaultdict(int)   # {type: count}
        self.tracked_ids       = set()
        self.total_vehicles    = 0
        self.plates_detected   = []
        self._load()

    def _load(self):
        try:
            import onnxruntime as ort
            opts = ort.SessionOptions()
            opts.inter_op_num_threads = 2
            opts.intra_op_num_threads = 2
            providers = ["CPUExecutionProvider"]

            # Modèle véhicules
            for path in ["models/vehicle_detector.onnx", "/app/vehicle_detector.onnx"]:
                if os.path.exists(path):
                    self.vehicle_session = ort.InferenceSession(path, sess_options=opts, providers=providers)
                    logger.success(f"✅ Vehicle detector: {path}")
                    break

            # Modèle plaques
            for path in ["models/license_plate_detector.onnx", "/app/license_plate_detector.onnx"]:
                if os.path.exists(path):
                    self.plate_session = ort.InferenceSession(path, sess_options=opts, providers=providers)
                    logger.success(f"✅ License plate detector: {path}")
                    break

            self.loaded = self.vehicle_session is not None
        except Exception as e:
            logger.error(f"❌ TrafficDetector: {e}")

    def _preprocess(self, img: np.ndarray, size=640):
        from PIL import Image
        h, w = img.shape[:2]
        scale = min(size/w, size/h)
        nw, nh = int(w*scale), int(h*scale)
        pil = Image.fromarray(img).resize((nw,nh), Image.BILINEAR)
        pad = Image.new("RGB",(size,size),(114,114,114))
        pad.paste(pil,(0,0))
        blob = np.array(pad,dtype=np.float32)/255.0
        return np.transpose(blob,(2,0,1))[np.newaxis], scale, w, h

    def detect_vehicles(self, img: np.ndarray, conf=0.20) -> List[Dict]:
        if not self.vehicle_session: return []
        blob, scale, w, h = self._preprocess(img)
        inp = self.vehicle_session.get_inputs()[0].name
        out = self.vehicle_session.run(None, {inp: blob})[0][0].T
        dets = []
        for pred in out:
            scores = pred[4:]
            ci = int(np.argmax(scores))
            score = float(scores[ci])
            if score < conf or ci not in VEHICLE_CLASSES: continue
            cx,cy,pw,ph = pred[0],pred[1],pred[2],pred[3]
            x1=int(max(0,(cx-pw/2)/scale)); y1=int(max(0,(cy-ph/2)/scale))
            x2=int(min(w,(cx+pw/2)/scale)); y2=int(min(h,(cy+ph/2)/scale))
            vtype = VEHICLE_CLASSES[ci]
            dets.append({
                "class": vtype, "label": f"{vtype} 🚗", "icon": "🚗" if vtype=="car" else "🚛" if vtype=="truck" else "🚌" if vtype=="bus" else "🏍️",
                "score": round(score,3), "bbox": [x1,y1,x2,y2],
                "color": VEHICLE_COLORS.get(vtype,"#3B82F6"),
                "severity": "info", "category": "traffic",
            })
        return sorted(dets, key=lambda d: d["score"], reverse=True)

    def detect_plates(self, img: np.ndarray, vehicle_bbox=None, conf=0.30) -> List[Dict]:
        if not self.plate_session: return []
        # Crop sur la voiture si bbox fournie
        if vehicle_bbox:
            x1,y1,x2,y2 = vehicle_bbox
            margin = 10
            x1=max(0,x1-margin); y1=max(0,y1-margin)
            x2=min(img.shape[1],x2+margin); y2=min(img.shape[0],y2+margin)
            crop = img[y1:y2,x1:x2]
            if crop.size == 0: return []
        else:
            crop = img

        blob, scale, w, h = self._preprocess(crop, size=320)
        inp = self.plate_session.get_inputs()[0].name
        out = self.plate_session.run(None, {inp: blob})[0][0].T
        plates = []
        for pred in out:
            score = float(pred[4])
            if score < conf: continue
            cx,cy,pw,ph = pred[0],pred[1],pred[2],pred[3]
            x1p=int(max(0,(cx-pw/2)/scale)); y1p=int(max(0,(cy-ph/2)/scale))
            x2p=int(min(w,(cx+pw/2)/scale)); y2p=int(min(h,(cy+ph/2)/scale))
            # OCR sur la plaque
            plate_text = self._ocr_plate(crop[y1p:y2p, x1p:x2p])
            offset_x = vehicle_bbox[0] if vehicle_bbox else 0
            offset_y = vehicle_bbox[1] if vehicle_bbox else 0
            plates.append({
                "class": "license_plate", "label": f"🔢 {plate_text or 'Plaque'}",
                "score": round(score,3), "text": plate_text,
                "bbox": [x1p+offset_x, y1p+offset_y, x2p+offset_x, y2p+offset_y],
                "color": "#FBBF24", "icon": "🔢", "severity": "info",
            })
        return plates

    def _ocr_plate(self, plate_img: np.ndarray) -> str:
        try:
            import pytesseract, cv2
            if plate_img.size == 0: return ""
            gray = cv2.cvtColor(plate_img, cv2.COLOR_RGB2GRAY)
            gray = cv2.resize(gray, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
            _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY+cv2.THRESH_OTSU)
            text = pytesseract.image_to_string(thresh, config="--psm 8 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
            return text.strip().replace(" ","").replace("\n","")[:10]
        except Exception:
            return ""

    def analyze(self, img: np.ndarray, conf_vehicle=0.20, conf_plate=0.30) -> Dict:
        vehicles = self.detect_vehicles(img, conf_vehicle)
        # Compter par type
        counts = defaultdict(int)
        all_dets = []
        for v in vehicles:
            counts[v["class"]] += 1
            self.total_vehicles += 1
            all_dets.append(v)
            # Détecter plaque sur chaque véhicule
            plates = self.detect_plates(img, v["bbox"], conf_plate)
            for p in plates:
                all_dets.append(p)
                if p["text"]:
                    self.plates_detected.append({"plate": p["text"], "time": time.strftime("%H:%M:%S"), "vehicle": v["class"]})
                    self.plates_detected = self.plates_detected[-50:]

        return {
            "detections": all_dets,
            "vehicle_count": dict(counts),
            "total_session": self.total_vehicles,
            "plates": self.plates_detected[-10:],
            "traffic_density": "🔴 Dense" if sum(counts.values())>5 else "🟡 Modéré" if sum(counts.values())>2 else "🟢 Fluide",
            "timestamp": time.strftime("%H:%M:%S"),
        }

    @property
    def status(self):
        return {
            "loaded": self.loaded,
            "vehicle_model": "vehicle_detector.onnx (YOLOv8n COCO)",
            "plate_model":   "license_plate_detector.onnx (YOLOv8n fine-tuned)",
            "ocr": "Tesseract",
            "vehicle_classes": list(VEHICLE_CLASSES.values()),
            "total_detected": self.total_vehicles,
        }

_detector: Optional[TrafficDetector] = None
def get_traffic_detector() -> TrafficDetector:
    global _detector
    if _detector is None:
        _detector = TrafficDetector()
    return _detector
