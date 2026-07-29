"""
TrafficGuard Detector — Vision Guard AI
Architecture identique au projet Muhammad-Zeerak-Khan:
1. YOLOv8n → détection véhicules (image complète)
2. license_plate_detector.onnx → détection plaques (image complète)
3. OCR → lecture texte plaque (crop + THRESH_BINARY_INV)
"""
import os, time, numpy as np, base64, io
from typing import List, Dict, Optional
from collections import defaultdict
from loguru import logger

VEHICLE_CLASSES  = {1:"bicycle", 2:"car", 3:"motorcycle", 5:"bus", 7:"truck"}
VEHICLE_COLORS   = {"car":"#3B82F6","truck":"#8B5CF6","bus":"#F59E0B","motorcycle":"#10B981","bicycle":"#06B6D4"}
VEHICLE_ICONS    = {"car":"🚗","truck":"🚛","bus":"🚌","motorcycle":"🏍️","bicycle":"🚲"}

class TrafficDetector:
    def __init__(self):
        self.vehicle_session = None
        self.plate_session   = None
        self.loaded          = False
        self.total_vehicles  = 0
        self.plates_detected: List[Dict] = []
        self._load()

    def _load(self):
        try:
            import onnxruntime as ort
            opts = ort.SessionOptions()
            opts.inter_op_num_threads = 2
            opts.intra_op_num_threads = 2
            pv = ["CPUExecutionProvider"]

            for path in ["models/vehicle_detector.onnx","/app/vehicle_detector.onnx"]:
                if os.path.exists(path):
                    self.vehicle_session = ort.InferenceSession(path, sess_options=opts, providers=pv)
                    logger.success(f"✅ Vehicle ONNX: {path}")
                    break

            for path in ["models/license_plate_detector.onnx","/app/license_plate_detector.onnx"]:
                if os.path.exists(path):
                    self.plate_session = ort.InferenceSession(path, sess_options=opts, providers=pv)
                    logger.success(f"✅ Plate ONNX: {path}")
                    break

            self.loaded = self.vehicle_session is not None
        except Exception as e:
            logger.error(f"❌ TrafficDetector load: {e}")

    def _preprocess(self, img: np.ndarray, size=640):
        """Préprocessing standard YOLOv8 avec letterbox"""
        from PIL import Image as PILImage
        h, w = img.shape[:2]
        scale = min(size/w, size/h)
        nw, nh = int(w*scale), int(h*scale)
        pil = PILImage.fromarray(img).resize((nw, nh), PILImage.BILINEAR)
        pad = PILImage.new("RGB", (size, size), (114, 114, 114))
        pad.paste(pil, (0, 0))
        blob = np.array(pad, dtype=np.float32) / 255.0
        return np.transpose(blob, (2, 0, 1))[np.newaxis], scale, w, h

    def _nms(self, boxes, scores, iou_thresh=0.45):
        """Non-Maximum Suppression"""
        if not boxes: return []
        b = np.array(boxes, dtype=float)
        s = np.array(scores, dtype=float)
        x1,y1,x2,y2 = b[:,0],b[:,1],b[:,2],b[:,3]
        areas = (x2-x1)*(y2-y1)
        order = s.argsort()[::-1]
        keep = []
        while order.size:
            i = order[0]; keep.append(i)
            xx1=np.maximum(x1[i],x1[order[1:]]); yy1=np.maximum(y1[i],y1[order[1:]])
            xx2=np.minimum(x2[i],x2[order[1:]]); yy2=np.minimum(y2[i],y2[order[1:]])
            inter=np.maximum(0,xx2-xx1)*np.maximum(0,yy2-yy1)
            iou=inter/(areas[i]+areas[order[1:]]-inter+1e-6)
            order=order[np.where(iou<=iou_thresh)[0]+1]
        return keep

    def detect_vehicles(self, img: np.ndarray, conf=0.25) -> List[Dict]:
        if not self.vehicle_session: return []
        blob, scale, W, H = self._preprocess(img)
        inp = self.vehicle_session.get_inputs()[0].name
        out = self.vehicle_session.run(None, {inp: blob})[0][0].T

        boxes, scores, classes = [], [], []
        for pred in out:
            cls_scores = pred[4:]
            ci = int(np.argmax(cls_scores))
            sc = float(cls_scores[ci])
            if sc < conf or ci not in VEHICLE_CLASSES: continue
            cx,cy,pw,ph = pred[0],pred[1],pred[2],pred[3]
            x1=max(0,int((cx-pw/2)/scale)); y1=max(0,int((cy-ph/2)/scale))
            x2=min(W,int((cx+pw/2)/scale)); y2=min(H,int((cy+ph/2)/scale))
            if x2<=x1 or y2<=y1: continue
            boxes.append([x1,y1,x2,y2]); scores.append(sc); classes.append(ci)

        keep = self._nms(boxes, scores)
        dets = []
        for i in keep:
            vtype = VEHICLE_CLASSES[classes[i]]
            x1,y1,x2,y2 = boxes[i]
            dets.append({
                "class":    vtype,
                "label":    f"{VEHICLE_ICONS.get(vtype,'🚗')} {vtype.capitalize()}",
                "icon":     VEHICLE_ICONS.get(vtype,"🚗"),
                "score":    round(scores[i],3),
                "bbox":     [x1,y1,x2,y2],
                "color":    VEHICLE_COLORS.get(vtype,"#3B82F6"),
                "severity": "info",
                "category": "traffic",
            })
        return dets

    def detect_plates_full(self, img: np.ndarray, conf=0.15) -> List[Dict]:
        """Détecte plaques sur IMAGE COMPLÈTE (pas de crop par véhicule)"""
        if not self.plate_session: return []
        blob, scale, W, H = self._preprocess(img)
        inp = self.plate_session.get_inputs()[0].name
        try:
            raw = self.plate_session.run(None, {inp: blob})[0][0].T
        except Exception as e:
            logger.error(f"Plate session error: {e}"); return []

        plates = []
        for pred in raw:
            # Support YOLOv8 output format (cx,cy,w,h,conf) ou (cx,cy,w,h,conf,cls)
            if len(pred) >= 5:
                score = float(pred[4]) if len(pred)==5 else float(max(pred[4:]))
            else: continue
            if score < conf: continue

            cx,cy,pw,ph = pred[0],pred[1],pred[2],pred[3]
            x1=max(0,int((cx-pw/2)/scale)); y1=max(0,int((cy-ph/2)/scale))
            x2=min(W,int((cx+pw/2)/scale)); y2=min(H,int((cy+ph/2)/scale))
            if x2-x1 < 15 or y2-y1 < 8: continue

            # Crop plaque et OCR
            plate_crop = img[y1:y2, x1:x2]
            plate_text = self._ocr_plate(plate_crop)
            plate_b64  = self._encode_plate(plate_crop)

            label = f"🔢 {plate_text}" if plate_text else "🔢 Plaque détectée"
            plates.append({
                "class":       "license_plate",
                "label":       label,
                "icon":        "🔢",
                "text":        plate_text,
                "has_text":    bool(plate_text),
                "plate_image": plate_b64,
                "score":       round(score,3),
                "bbox":        [x1,y1,x2,y2],
                "color":       "#FBBF24",
                "severity":    "warning",
                "category":    "traffic",
                "time":        time.strftime("%H:%M:%S"),
            })
            logger.info(f"🔢 Plaque: '{plate_text or 'NO_TEXT'}' score={score:.2f}")

        return plates

    def _ocr_plate(self, plate_img: np.ndarray) -> str:
        """OCR identique au projet original: THRESH_BINARY_INV + Tesseract"""
        try:
            import pytesseract, cv2
            if plate_img is None or plate_img.size == 0: return ""
            if plate_img.shape[0] < 5 or plate_img.shape[1] < 5: return ""

            gray = cv2.cvtColor(plate_img, cv2.COLOR_RGB2GRAY)
            # Upscale pour meilleur OCR
            h, w = gray.shape
            scale = max(3.0, 80.0/h)
            gray = cv2.resize(gray, (int(w*scale), int(h*scale)), interpolation=cv2.INTER_CUBIC)

            # THRESH_BINARY_INV comme dans le projet original
            _, thresh = cv2.threshold(gray, 64, 255, cv2.THRESH_BINARY_INV)

            cfg = "--psm 7 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
            text = pytesseract.image_to_string(thresh, config=cfg).strip()
            text = "".join(c for c in text if c.isalnum())

            if len(text) >= 4:
                return text[:10]

            # Fallback PSM 8
            cfg2 = "--psm 8 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
            text2 = pytesseract.image_to_string(thresh, config=cfg2).strip()
            text2 = "".join(c for c in text2 if c.isalnum())
            return text2[:10] if len(text2) >= 3 else ""

        except Exception as e:
            logger.debug(f"OCR: {e}")
            return ""

    def _encode_plate(self, img: np.ndarray) -> str:
        """Encode la plaque en base64 JPEG pour Firebase"""
        try:
            from PIL import Image as PILImage
            pil = PILImage.fromarray(img).resize((240, 80), PILImage.BILINEAR)
            buf = io.BytesIO()
            pil.save(buf, format="JPEG", quality=90)
            return base64.b64encode(buf.getvalue()).decode()
        except Exception:
            return ""

    def _tile_detect(self, img: np.ndarray, conf=0.20) -> List[Dict]:
        """Multi-échelle: image complète + 4 quadrants pour objets distants (50-100m)"""
        H, W = img.shape[:2]
        all_dets: List[Dict] = []

        # 1. Image complète
        all_dets.extend(self.detect_vehicles(img, conf))

        # 2. Quadrants avec 10% overlap
        overlap_x, overlap_y = W//10, H//10
        tiles = [
            (0,              0,              W//2+overlap_x, H//2+overlap_y),
            (W//2-overlap_x, 0,              W,              H//2+overlap_y),
            (0,              H//2-overlap_y, W//2+overlap_x, H),
            (W//2-overlap_x, H//2-overlap_y,W,              H),
        ]
        for (tx1,ty1,tx2,ty2) in tiles:
            crop = img[ty1:ty2, tx1:tx2]
            if crop.size == 0: continue
            for d in self.detect_vehicles(crop, conf):
                bx1,by1,bx2,by2 = d["bbox"]
                d["bbox"] = [bx1+tx1, by1+ty1, bx2+tx1, by2+ty1]
                all_dets.append(d)

        # NMS global
        if not all_dets: return []
        boxes  = [d["bbox"] for d in all_dets]
        scores = [d["score"] for d in all_dets]
        keep   = self._nms(boxes, scores, iou_thresh=0.40)
        return [all_dets[i] for i in keep]

    def analyze(self, img: np.ndarray, conf_vehicle=0.20, conf_plate=0.15) -> Dict:
        vehicles = self._tile_detect(img, conf_vehicle)
        # Plaques sur IMAGE COMPLÈTE
        plates   = self.detect_plates_full(img, conf_plate)

        counts = defaultdict(int)
        for v in vehicles:
            counts[v["class"]] += 1
            self.total_vehicles += 1

        # Sauvegarder toutes les plaques
        for p in plates:
            self.plates_detected.append({
                "plate":       p["text"] or "?",
                "has_text":    p["has_text"],
                "time":        p["time"],
                "score":       p["score"],
                "bbox":        p["bbox"],
                "plate_image": p["plate_image"],
            })
        self.plates_detected = self.plates_detected[-50:]

        total = sum(counts.values())
        density = "🔴 Dense" if total>5 else "🟡 Modéré" if total>2 else "🟢 Fluide"

        return {
            "detections":     vehicles + plates,
            "vehicle_count":  dict(counts),
            "total_session":  self.total_vehicles,
            "plates":         self.plates_detected[-10:],
            "traffic_density":density,
            "timestamp":      time.strftime("%H:%M:%S"),
        }

    @property
    def status(self):
        return {
            "loaded":          self.loaded,
            "vehicle_model":   "vehicle_detector.onnx (YOLOv8n COCO)",
            "plate_model":     "license_plate_detector.onnx (YOLOv8n fine-tuned)",
            "ocr":             "Tesseract THRESH_BINARY_INV PSM7",
            "vehicle_classes": list(VEHICLE_CLASSES.values()),
            "total_detected":  self.total_vehicles,
            "plates_detected": len(self.plates_detected),
        }

_detector: Optional[TrafficDetector] = None
def get_traffic_detector() -> TrafficDetector:
    global _detector
    if _detector is None:
        _detector = TrafficDetector()
    return _detector
