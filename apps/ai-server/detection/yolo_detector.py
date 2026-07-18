"""
YOLOv11 Detector — Vision Guard AI
Détection multi-classes avec modèles spécifiques par secteur

Modèles disponibles :
  - yolov11n.pt      : General (COCO 80 classes) — léger, CPU
  - yolov11s.pt      : General — équilibré
  - yolov11m.pt      : General — précis
  - models/ppe.pt    : Construction EPI (casque, gilet, harnais...)
  - models/traffic.pt: Trafic + plaques
  - models/retail.pt : Retail + comportements
"""

from ultralytics import YOLO
from typing import List, Dict, Any, Optional
import numpy as np
import cv2
import base64
import time
from loguru import logger
from config.settings import settings

# ── Labels par secteur ────────────────────────────────────────────────────────

CONSTRUCTION_CLASSES = {
    # EPI — casque, gilet, harnais
    "helmet":           {"label":"Casque de protection",      "severity":"info",    "category":"ppe",       "icon":"⛑️"},
    "no_helmet":        {"label":"Sans casque ⚠️",            "severity":"critical","category":"ppe",       "icon":"🚫"},
    "safety_vest":      {"label":"Gilet de sécurité",         "severity":"info",    "category":"ppe",       "icon":"🦺"},
    "no_vest":          {"label":"Sans gilet ⚠️",             "severity":"critical","category":"ppe",       "icon":"🚫"},
    "safety_glasses":   {"label":"Lunettes sécurité",         "severity":"info",    "category":"ppe",       "icon":"🥽"},
    "fall_harness":     {"label":"Harnais antichute",         "severity":"info",    "category":"ppe",       "icon":"🪝"},
    "no_harness":       {"label":"Sans harnais ⚠️",           "severity":"critical","category":"ppe",       "icon":"🚫"},
    "safety_boots":     {"label":"Bottes sécurité",           "severity":"info",    "category":"ppe",       "icon":"👢"},
    # Personnes
    "worker":           {"label":"Travailleur",                "severity":"info",    "category":"human",     "icon":"👷"},
    "supervisor":       {"label":"Superviseur",                "severity":"info",    "category":"human",     "icon":"👔"},
    "visitor":          {"label":"Visiteur non autorisé",      "severity":"warning", "category":"human",     "icon":"🚷"},
    # Engins
    "excavator":        {"label":"Excavatrice",                "severity":"warning", "category":"vehicle",   "icon":"🏗️"},
    "crane":            {"label":"Grue",                       "severity":"warning", "category":"vehicle",   "icon":"🏗️"},
    "forklift":         {"label":"Chariot élévateur",          "severity":"warning", "category":"vehicle",   "icon":"🏭"},
    "dump_truck":       {"label":"Camion benne",               "severity":"warning", "category":"vehicle",   "icon":"🚛"},
    # Risques
    "open_hole":        {"label":"Trou ouvert ⚠️",             "severity":"critical","category":"hazard",    "icon":"⚠️"},
    "unprotected_edge": {"label":"Bord non protégé ⚠️",        "severity":"critical","category":"hazard",    "icon":"🚫"},
    "fire":             {"label":"INCENDIE 🔥",                "severity":"critical","category":"fire",      "icon":"🔥"},
    "smoke":            {"label":"Fumée détectée",             "severity":"critical","category":"fire",      "icon":"💨"},
    # Comportements dangereux
    "fall_detected":    {"label":"CHUTE DÉTECTÉE 🚨",          "severity":"critical","category":"behavior",  "icon":"⬇️"},
    "phone_use":        {"label":"Téléphone sur chantier",     "severity":"warning", "category":"behavior",  "icon":"📵"},
    "worker_running":   {"label":"Travailleur qui court",      "severity":"warning", "category":"behavior",  "icon":"🏃"},
}

INDUSTRIAL_CLASSES = {
    "worker":           {"label":"Travailleur — Vérif. EPI",   "severity":"warning", "category":"human",     "icon":"👷"},
    "helmet":           {"label":"Casque présent ✅",           "severity":"info",    "category":"ppe",       "icon":"⛑️"},
    "no_helmet":        {"label":"SANS CASQUE 🚨",             "severity":"critical","category":"ppe",       "icon":"🚫"},
    "safety_vest":      {"label":"Gilet haute-vis ✅",          "severity":"info",    "category":"ppe",       "icon":"🦺"},
    "no_vest":          {"label":"SANS GILET 🚨",              "severity":"critical","category":"ppe",       "icon":"🚫"},
    "uniform":          {"label":"Uniforme de travail ✅",      "severity":"info",    "category":"ppe",       "icon":"👔"},
    "no_uniform":       {"label":"SANS UNIFORME ⚠️",           "severity":"warning", "category":"ppe",       "icon":"🚫"},
    "fire":             {"label":"INCENDIE 🔥",                "severity":"critical","category":"fire",      "icon":"🔥"},
    "smoke":            {"label":"Fumée",                      "severity":"critical","category":"fire",      "icon":"💨"},
    "gas_leak":         {"label":"FUITE DE GAZ 🚨",            "severity":"critical","category":"hazard",    "icon":"💨"},
    "forklift":         {"label":"Chariot élévateur",          "severity":"warning", "category":"vehicle",   "icon":"🏭"},
    "agv":              {"label":"AGV Robot autonome",         "severity":"info",    "category":"vehicle",   "icon":"🤖"},
    "machine_active":   {"label":"Machine active",             "severity":"info",    "category":"machine",   "icon":"⚙️"},
    "machine_estop":    {"label":"ARRÊT URGENCE MACHINE",      "severity":"critical","category":"machine",   "icon":"🛑"},
    "door_open":        {"label":"Porte machine ouverte",      "severity":"critical","category":"machine",   "icon":"🚪"},
    "person_danger":    {"label":"Personne en zone danger",    "severity":"critical","category":"behavior",  "icon":"🚷"},
}

RETAIL_CLASSES = {
    "person":           {"label":"Client",                     "severity":"info",    "category":"human",     "icon":"🛍️"},
    "shoplifting":      {"label":"VOL DÉTECTÉ 🚨",             "severity":"critical","category":"behavior",  "icon":"🚨"},
    "concealment":      {"label":"Dissimulation article",      "severity":"critical","category":"behavior",  "icon":"🙈"},
    "tag_removal":      {"label":"Retrait étiquette",          "severity":"critical","category":"behavior",  "icon":"🏷️"},
    "empty_shelf":      {"label":"Rayon vide",                 "severity":"warning", "category":"retail",    "icon":"📦"},
    "barcode":          {"label":"Code-barres",                "severity":"info",    "category":"retail",    "icon":"📊"},
    "cashier":          {"label":"Caissier",                   "severity":"info",    "category":"human",     "icon":"💁"},
    "skip_checkout":    {"label":"Passage sans payer",         "severity":"critical","category":"behavior",  "icon":"🚪"},
}

TRAFFIC_CLASSES = {
    "car":              {"label":"Voiture",                    "severity":"info",    "category":"vehicle",   "icon":"🚗"},
    "truck":            {"label":"Camion",                     "severity":"info",    "category":"vehicle",   "icon":"🚛"},
    "bus":              {"label":"Bus",                        "severity":"info",    "category":"vehicle",   "icon":"🚌"},
    "motorcycle":       {"label":"Moto",                       "severity":"info",    "category":"vehicle",   "icon":"🏍️"},
    "bicycle":          {"label":"Vélo",                       "severity":"info",    "category":"vehicle",   "icon":"🚲"},
    "pedestrian":       {"label":"Piéton",                     "severity":"info",    "category":"human",     "icon":"🚶"},
    "license_plate":    {"label":"Plaque d'immatriculation",   "severity":"info",    "category":"ocr",       "icon":"🔤"},
    "red_light":        {"label":"Feu rouge brûlé ⚠️",         "severity":"warning", "category":"violation", "icon":"🚦"},
    "speeding":         {"label":"Excès de vitesse",           "severity":"warning", "category":"violation", "icon":"💨"},
    "accident":         {"label":"ACCIDENT DÉTECTÉ 🚨",        "severity":"critical","category":"incident",  "icon":"💥"},
}

# Mapping secteur → classes custom
MODULE_CLASS_MAPS = {
    "construction": CONSTRUCTION_CLASSES,
    "industrial":   INDUSTRIAL_CLASSES,
    "retail":       RETAIL_CLASSES,
    "transportation":TRAFFIC_CLASSES,
}

# ── Détecteur principal ───────────────────────────────────────────────────────

class YOLODetector:
    def __init__(self):
        self.models: Dict[str, YOLO] = {}
        self.loaded  = False
        self._load_models()

    def _load_models(self):
        """Charge les modèles YOLO disponibles"""
        logger.info("🎯 Chargement YOLOv11...")

        # Modèle général (COCO 80 classes)
        try:
            self.models["general"] = YOLO(settings.YOLO_MODEL)
            logger.success(f"✅ YOLOv11 général chargé: {settings.YOLO_MODEL}")
        except Exception as e:
            logger.error(f"❌ Erreur chargement YOLOv11 général: {e}")

        # Modèles spécifiques (si disponibles)
        custom_models = {
            "ppe":          "models/ppe.pt",
            "construction": "models/construction.pt",
            "industrial":   "models/industrial.pt",
            "retail":       "models/retail.pt",
            "traffic":      "models/traffic.pt",
        }
        for name, path in custom_models.items():
            import os
            if os.path.exists(path):
                try:
                    self.models[name] = YOLO(path)
                    logger.success(f"✅ Modèle custom chargé: {name}")
                except Exception as e:
                    logger.warning(f"⚠️ Modèle {name} non chargé: {e}")
            else:
                logger.info(f"📋 Modèle {name} non trouvé ({path}) — utilise le modèle général")

        self.loaded = len(self.models) > 0

    def _select_model(self, module_id: str) -> YOLO:
        """Sélectionne le meilleur modèle pour le module donné"""
        # Priorité: modèle custom > général
        if module_id in self.models:
            return self.models[module_id]
        if "ppe" in self.models and module_id in ["construction","industrial"]:
            return self.models["ppe"]
        return self.models.get("general", list(self.models.values())[0])

    def detect(
        self,
        image_data: bytes | str | np.ndarray,
        module_id:  str = "general",
        confidence: float = None,
    ) -> List[Dict[str, Any]]:
        """
        Détecte les objets dans une image.

        Args:
            image_data: bytes (image), base64 str, ou numpy array
            module_id:  secteur actif pour enrichir les labels
            confidence: seuil de confiance (défaut: settings.YOLO_CONFIDENCE)

        Returns:
            Liste de détections avec label, severity, bbox, score, etc.
        """
        if not self.loaded:
            return []

        conf = confidence or settings.YOLO_CONFIDENCE

        # Décoder l'image
        img = self._decode_image(image_data)
        if img is None:
            return []

        model = self._select_model(module_id)
        class_map = MODULE_CLASS_MAPS.get(module_id, {})

        try:
            results = model.predict(
                img,
                conf=conf,
                iou=settings.YOLO_IOU,
                imgsz=settings.YOLO_IMG_SIZE,
                device=settings.YOLO_DEVICE,
                half=settings.YOLO_HALF,
                verbose=False,
                max_det=settings.MAX_DETECTIONS,
            )
        except Exception as e:
            logger.error(f"❌ Erreur inférence YOLO: {e}")
            return []

        detections = []
        for result in results:
            if result.boxes is None:
                continue

            for box in result.boxes:
                cls_id    = int(box.cls[0])
                cls_name  = result.names[cls_id]
                score     = float(box.conf[0])
                x1,y1,x2,y2 = box.xyxy[0].tolist()

                # Enrichir avec le mapping module
                enriched = class_map.get(cls_name, None)

                # Fallback vers COCO labels
                label    = enriched["label"]    if enriched else cls_name
                severity = enriched["severity"] if enriched else "info"
                category = enriched["category"] if enriched else "object"
                icon     = enriched["icon"]     if enriched else "📦"

                detections.append({
                    "class":    cls_name,
                    "label":    label,
                    "icon":     icon,
                    "category": category,
                    "severity": severity,
                    "score":    round(score, 3),
                    "confidence": round(score * 100, 1),
                    "bbox":     [round(x1), round(y1), round(x2), round(y2)],
                    "center":   [round((x1+x2)/2), round((y1+y2)/2)],
                    "area":     round((x2-x1)*(y2-y1)),
                    "module":   module_id,
                    "alert":    severity in ["warning","critical"],
                })

        # Trier par score décroissant
        detections.sort(key=lambda d: d["score"], reverse=True)
        return detections

    def _decode_image(self, image_data) -> Optional[np.ndarray]:
        """Décode image depuis bytes, base64 ou array"""
        try:
            if isinstance(image_data, np.ndarray):
                return image_data

            if isinstance(image_data, str):
                # Base64
                if "," in image_data:
                    image_data = image_data.split(",")[1]
                image_bytes = base64.b64decode(image_data)
            else:
                image_bytes = image_data

            nparr = np.frombuffer(image_bytes, np.uint8)
            img   = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            return cv2.cvtColor(img, cv2.COLOR_BGR2RGB) if img is not None else None

        except Exception as e:
            logger.error(f"❌ Erreur décodage image: {e}")
            return None


# Singleton
_detector: Optional[YOLODetector] = None

def get_detector() -> YOLODetector:
    global _detector
    if _detector is None:
        _detector = YOLODetector()
    return _detector
