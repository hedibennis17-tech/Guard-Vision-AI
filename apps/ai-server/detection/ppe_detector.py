"""
PPE Professional Detector — Vision Guard AI
Spec: YOLOv11 PPE Bundle (Construction + Industrial + Warehouse + Mining)

Modèles spécialisés par secteur:
  ppe_construction.pt → chantiers
  ppe_industry.pt     → usines  
  ppe_warehouse.pt    → entrepôts
  ppe_mining.pt       → mines
  ppe_refinery.pt     → raffineries
  ppe.pt              → modèle universel (fallback)
"""
import os
from typing import Optional, List, Dict
import numpy as np
from loguru import logger

# Classes PPE avec niveaux de sévérité
PPE_CLASSES = {
    # ✅ EPI présents
    "helmet":         {"label":"Casque ✅",               "severity":"info",    "alert":False,"icon":"⛑️", "required":True},
    "safety_vest":    {"label":"Gilet haute-vis ✅",       "severity":"info",    "alert":False,"icon":"🦺", "required":True},
    "uniform":        {"label":"Uniforme ✅",              "severity":"info",    "alert":False,"icon":"👔", "required":True},
    "fall_harness":   {"label":"Harnais ✅",               "severity":"info",    "alert":False,"icon":"🪝", "required":False},
    "safety_boots":   {"label":"Bottes sécurité ✅",       "severity":"info",    "alert":False,"icon":"👢", "required":True},
    "gloves":         {"label":"Gants ✅",                 "severity":"info",    "alert":False,"icon":"🧤", "required":True},
    "safety_glasses": {"label":"Lunettes sécurité ✅",     "severity":"info",    "alert":False,"icon":"🥽", "required":True},
    "ear_protection": {"label":"Protection auriculaire ✅","severity":"info",    "alert":False,"icon":"🎧", "required":False},
    "respirator":     {"label":"Respirateur ✅",           "severity":"info",    "alert":False,"icon":"😷", "required":False},
    "face_shield":    {"label":"Écran facial ✅",          "severity":"info",    "alert":False,"icon":"🛡️", "required":False},
    # ❌ EPI manquants — ALERTES
    "no_helmet":      {"label":"SANS CASQUE 🚨",           "severity":"critical","alert":True, "icon":"🚫","required":False},
    "no_vest":        {"label":"SANS GILET 🚨",            "severity":"critical","alert":True, "icon":"🚫","required":False},
    "no_uniform":     {"label":"SANS UNIFORME ⚠️",         "severity":"warning", "alert":True, "icon":"⚠️","required":False},
    "no_harness":     {"label":"SANS HARNAIS 🚨",          "severity":"critical","alert":True, "icon":"🚫","required":False},
    "no_boots":       {"label":"SANS BOTTES ⚠️",           "severity":"warning", "alert":True, "icon":"⚠️","required":False},
    "no_gloves":      {"label":"SANS GANTS ⚠️",            "severity":"warning", "alert":True, "icon":"⚠️","required":False},
    "no_glasses":     {"label":"SANS LUNETTES ⚠️",         "severity":"warning", "alert":True, "icon":"⚠️","required":False},
    # Personnes
    "worker":         {"label":"Travailleur",              "severity":"info",    "alert":False,"icon":"👷","required":False},
    "visitor":        {"label":"Visiteur",                 "severity":"info",    "alert":False,"icon":"🚶","required":False},
    "contractor":     {"label":"Contracteur",              "severity":"info",    "alert":False,"icon":"🔧","required":False},
    "supervisor":     {"label":"Superviseur",              "severity":"info",    "alert":False,"icon":"👔","required":False},
    "intruder":       {"label":"INTRUS 🚨",                "severity":"critical","alert":True, "icon":"🚨","required":False},
}

# Modèles par secteur (selon spec ChatGPT)
SECTOR_MODELS = {
    "construction": ["models/ppe_construction.pt", "models/ppe.pt"],
    "industrial":   ["models/ppe_industry.pt",     "models/ppe.pt"],
    "warehouse":    ["models/ppe_warehouse.pt",    "models/ppe.pt"],
    "mining":       ["models/ppe_mining.pt",       "models/ppe.pt"],
    "refinery":     ["models/ppe_refinery.pt",     "models/ppe.pt"],
    "energy":       ["models/ppe_energy.pt",       "models/ppe.pt"],
    "general":      ["models/ppe.pt"],
}


class PPEDetector:
    """
    Détecteur PPE professionnel avec modèles spécialisés par secteur.
    Sélectionne automatiquement le meilleur modèle disponible.
    """

    def __init__(self):
        self.models: Dict[str, any] = {}
        self.loaded = False
        self._load_available_models()

    def _load_available_models(self):
        """Charge tous les modèles PPE disponibles dans models/"""
        try:
            from ultralytics import YOLO
        except ImportError:
            logger.warning("ultralytics non disponible — PPE detector désactivé")
            return

        loaded_count = 0
        for sector, paths in SECTOR_MODELS.items():
            for path in paths:
                if os.path.exists(path) and path not in [m.get("path") for m in self.models.values()]:
                    try:
                        model_key = os.path.basename(path).replace(".pt","")
                        if model_key not in self.models:
                            self.models[model_key] = {"model": YOLO(path), "path": path}
                            logger.success(f"✅ PPE model: {path}")
                            loaded_count += 1
                    except Exception as e:
                        logger.warning(f"⚠️ {path}: {e}")

        self.loaded = loaded_count > 0

        if not self.loaded:
            logger.warning(
                "⚠️ Aucun modèle PPE trouvé dans models/\n"
                "   Disponibles: ppe.pt, ppe_construction.pt, ppe_industry.pt, etc.\n"
                "   → Exécuter: python ppe_training/train_ppe.py\n"
                "   → OU fournir une clé Roboflow: python ppe_training/download_dataset.py CLE"
            )

    def _get_best_model(self, sector: str):
        """Retourne le modèle le plus adapté au secteur"""
        preferred_keys = [
            f"ppe_{sector}",
            "ppe",
        ]
        for key in preferred_keys:
            if key in self.models:
                return self.models[key]["model"], key
        
        # Premier modèle disponible
        if self.models:
            key = list(self.models.keys())[0]
            return self.models[key]["model"], key
        
        return None, None

    def detect(
        self,
        image: np.ndarray,
        sector:     str   = "general",
        confidence: float = 0.45,
    ) -> List[Dict]:
        """
        Détecte les EPI sur une image.
        
        Args:
            image:      Image RGB numpy
            sector:     construction | industrial | warehouse | mining | general
            confidence: Seuil minimum
        """
        if not self.loaded:
            return []

        model, model_key = self._get_best_model(sector)
        if model is None:
            return []

        try:
            results = model.predict(image, conf=confidence, verbose=False)
        except Exception as e:
            logger.error(f"PPE predict error: {e}")
            return []

        detections = []
        for result in results:
            if result.boxes is None:
                continue
            for box in result.boxes:
                cls_id   = int(box.cls[0])
                cls_name = result.names[cls_id]
                score    = float(box.conf[0])
                x1,y1,x2,y2 = [int(v) for v in box.xyxy[0].tolist()]

                info = PPE_CLASSES.get(cls_name, {
                    "label":cls_name,"severity":"info","alert":False,"icon":"📦","required":False
                })

                detections.append({
                    "class":    cls_name,
                    "label":    info["label"],
                    "icon":     info["icon"],
                    "category": "ppe" if "no_" in cls_name or cls_name in ["helmet","safety_vest","uniform","gloves","safety_glasses","safety_boots","fall_harness"] else "human",
                    "severity": info["severity"],
                    "score":    round(score, 3),
                    "confidence":round(score*100,1),
                    "bbox":     [x1,y1,x2,y2],
                    "center":   [int((x1+x2)/2),int((y1+y2)/2)],
                    "alert":    info["alert"],
                    "required": info.get("required", False),
                    "sector":   sector,
                    "model":    model_key,
                    "module":   "ppe",
                })

        # Trier: alertes critiques en premier
        detections.sort(key=lambda d: (
            d["severity"]=="critical",
            d["severity"]=="warning",
            d["score"]
        ), reverse=True)

        return detections

    def get_compliance_score(self, detections: List[Dict]) -> Dict:
        """Calcule le score de conformité EPI"""
        if not detections:
            return {"score": 100, "violations": [], "compliant": True}

        critical = [d for d in detections if d["severity"]=="critical" and d["alert"]]
        warnings = [d for d in detections if d["severity"]=="warning"  and d["alert"]]

        score = max(0, 100 - len(critical)*25 - len(warnings)*10)

        return {
            "score":     score,
            "critical":  len(critical),
            "warnings":  len(warnings),
            "violations":[d["label"] for d in critical + warnings],
            "compliant": score >= 80,
        }

    @property
    def status(self) -> Dict:
        return {
            "loaded":          self.loaded,
            "models_available":list(self.models.keys()),
            "sectors_covered": list(SECTOR_MODELS.keys()),
            "classes":         list(PPE_CLASSES.keys()),
            "total_classes":   len(PPE_CLASSES),
        }


_ppe: Optional[PPEDetector] = None

def get_ppe_detector() -> PPEDetector:
    global _ppe
    if _ppe is None:
        _ppe = PPEDetector()
    return _ppe
