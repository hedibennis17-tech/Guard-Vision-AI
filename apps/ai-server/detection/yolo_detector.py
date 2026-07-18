"""
YOLOv11 Detector — Vision Guard AI
Modèle auto-téléchargé par ultralytics au premier démarrage
"""
from ultralytics import YOLO
from typing import List, Dict, Any, Optional
import numpy as np, cv2, base64, time
from loguru import logger
from config.settings import settings

# Classes custom par module
CONSTRUCTION_CLASSES = {
    "helmet":      {"label":"Casque ✅",              "severity":"info",    "category":"ppe",      "icon":"⛑️","alert":False},
    "no_helmet":   {"label":"SANS CASQUE 🚨",         "severity":"critical","category":"ppe",      "icon":"🚫","alert":True},
    "safety_vest": {"label":"Gilet haute-vis ✅",      "severity":"info",    "category":"ppe",      "icon":"🦺","alert":False},
    "no_vest":     {"label":"SANS GILET 🚨",           "severity":"critical","category":"ppe",      "icon":"🚫","alert":True},
    "fall_harness":{"label":"Harnais ✅",              "severity":"info",    "category":"ppe",      "icon":"🪝","alert":False},
    "no_harness":  {"label":"SANS HARNAIS 🚨",         "severity":"critical","category":"ppe",      "icon":"🚫","alert":True},
    "worker":      {"label":"Travailleur",             "severity":"info",    "category":"human",    "icon":"👷","alert":False},
    "person":      {"label":"Travailleur (vérif EPI)", "severity":"warning", "category":"human",    "icon":"👷","alert":True},
    "truck":       {"label":"Engin lourd — zone 5m",  "severity":"warning", "category":"vehicle",  "icon":"🚛","alert":True},
    "car":         {"label":"Véhicule chantier",       "severity":"warning", "category":"vehicle",  "icon":"🚗","alert":True},
    "fire":        {"label":"INCENDIE 🔥",             "severity":"critical","category":"fire",     "icon":"🔥","alert":True},
}

INDUSTRIAL_CLASSES = {
    "person":      {"label":"Travailleur (vérif EPI & Uniforme)","severity":"warning","category":"human","icon":"👷","alert":True},
    "uniform":     {"label":"Uniforme ✅",             "severity":"info",    "category":"ppe",      "icon":"👔","alert":False},
    "no_uniform":  {"label":"SANS UNIFORME ⚠️",        "severity":"warning", "category":"ppe",      "icon":"🚫","alert":True},
    "helmet":      {"label":"Casque ✅",               "severity":"info",    "category":"ppe",      "icon":"⛑️","alert":False},
    "no_helmet":   {"label":"SANS CASQUE 🚨",          "severity":"critical","category":"ppe",      "icon":"🚫","alert":True},
    "truck":       {"label":"Chariot élévateur",       "severity":"warning", "category":"vehicle",  "icon":"🏭","alert":True},
    "fire":        {"label":"INCENDIE 🔥",             "severity":"critical","category":"fire",     "icon":"🔥","alert":True},
    "gas_leak":    {"label":"FUITE GAZ 🚨",            "severity":"critical","category":"hazard",   "icon":"💨","alert":True},
}

RETAIL_CLASSES = {
    "person":      {"label":"Client",                  "severity":"info",    "category":"human",    "icon":"🛍️","alert":False},
    "shoplifting": {"label":"VOL DÉTECTÉ 🚨",           "severity":"critical","category":"behavior", "icon":"🚨","alert":True},
    "backpack":    {"label":"Sac suspect",             "severity":"warning", "category":"human",    "icon":"🎒","alert":True},
}

TRAFFIC_CLASSES = {
    "car":         {"label":"Voiture",                 "severity":"info",    "category":"vehicle",  "icon":"🚗","alert":False},
    "truck":       {"label":"Camion",                  "severity":"info",    "category":"vehicle",  "icon":"🚛","alert":False},
    "bus":         {"label":"Bus",                     "severity":"info",    "category":"vehicle",  "icon":"🚌","alert":False},
    "person":      {"label":"Piéton",                  "severity":"info",    "category":"human",    "icon":"🚶","alert":False},
    "license_plate":{"label":"Plaque immatriculation", "severity":"info",    "category":"ocr",      "icon":"🔤","alert":False},
    "accident":    {"label":"ACCIDENT 🚨",              "severity":"critical","category":"incident", "icon":"💥","alert":True},
}

DEFENSE_CLASSES = {
    "person":      {"label":"INTRUS 🚨",               "severity":"critical","category":"human",    "icon":"🚨","alert":True},
    "car":         {"label":"Véhicule suspect",        "severity":"critical","category":"vehicle",  "icon":"🚗","alert":True},
    "truck":       {"label":"Véhicule lourd",          "severity":"critical","category":"vehicle",  "icon":"🚛","alert":True},
    "drone":       {"label":"DRONE ennemi 🚨",          "severity":"critical","category":"aerial",   "icon":"🚁","alert":True},
}

MODULE_CLASS_MAPS: Dict[str, Dict] = {
    "construction": CONSTRUCTION_CLASSES,
    "industrial":   INDUSTRIAL_CLASSES,
    "retail":       RETAIL_CLASSES,
    "transportation":TRAFFIC_CLASSES,
    "defense":      DEFENSE_CLASSES,
}

class YOLODetector:
    def __init__(self):
        self.models: Dict[str, YOLO] = {}
        self.loaded = False
        self._load()

    def _load(self):
        try:
            # YOLOv11 nano — auto-téléchargé ~6MB
            model_name = settings.YOLO_MODEL
            logger.info(f"📥 Chargement {model_name} (auto-download si nécessaire)...")
            self.models["general"] = YOLO(model_name)
            self.loaded = True
            logger.success(f"✅ YOLOv11 chargé: {model_name}")
        except Exception as e:
            logger.error(f"❌ YOLOv11 erreur: {e}")

        # Modèles custom si disponibles
        import os
        for name, path in [
            ("ppe", "models/ppe.pt"),
            ("construction","models/construction.pt"),
            ("shoplifting","models/shoplifting_wights.pt"),
        ]:
            if os.path.exists(path):
                try:
                    self.models[name] = YOLO(path)
                    logger.success(f"✅ Modèle custom: {name}")
                except Exception as e:
                    logger.warning(f"⚠️ {name}: {e}")

    def detect(self, image_data, module_id:str="general", confidence:Optional[float]=None) -> List[Dict]:
        if not self.loaded: return []
        conf  = confidence or settings.YOLO_CONFIDENCE
        model = self.models.get("ppe" if module_id in ["construction","industrial"] else module_id,
                                self.models.get("general"))
        if not model: return []

        img = self._decode_image(image_data)
        if img is None: return []

        class_map = MODULE_CLASS_MAPS.get(module_id, {})

        try:
            results = model.predict(img, conf=conf, iou=settings.YOLO_IOU,
                                    imgsz=settings.YOLO_IMG_SIZE, device=settings.YOLO_DEVICE,
                                    verbose=False, max_det=50)
        except Exception as e:
            logger.error(f"Predict error: {e}"); return []

        detections = []
        for result in results:
            if result.boxes is None: continue
            for box in result.boxes:
                cls_id   = int(box.cls[0])
                cls_name = result.names[cls_id]
                score    = float(box.conf[0])
                x1,y1,x2,y2 = [int(v) for v in box.xyxy[0].tolist()]

                enriched = class_map.get(cls_name)
                label    = enriched["label"]    if enriched else cls_name
                severity = enriched["severity"] if enriched else "info"
                category = enriched["category"] if enriched else "object"
                icon     = enriched["icon"]     if enriched else "📦"
                alert    = enriched["alert"]    if enriched else False

                detections.append({
                    "class":cls_name,"label":label,"icon":icon,
                    "category":category,"severity":severity,
                    "score":round(score,3),"confidence":round(score*100,1),
                    "bbox":[x1,y1,x2,y2],"center":[int((x1+x2)/2),int((y1+y2)/2)],
                    "area":(x2-x1)*(y2-y1),"module":module_id,"alert":alert,
                })

        detections.sort(key=lambda d: d["score"], reverse=True)
        return detections

    def _decode_image(self, data) -> Optional[np.ndarray]:
        try:
            if isinstance(data, np.ndarray): return data
            if isinstance(data, str):
                if "," in data: data = data.split(",")[1]
                data = base64.b64decode(data)
            arr = np.frombuffer(data, np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            return cv2.cvtColor(img, cv2.COLOR_BGR2RGB) if img is not None else None
        except Exception as e:
            logger.error(f"Decode error: {e}"); return None

_detector: Optional[YOLODetector] = None
def get_detector() -> YOLODetector:
    global _detector
    if _detector is None: _detector = YOLODetector()
    return _detector
