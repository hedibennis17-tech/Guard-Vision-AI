"""
ModuleLoader — Phase 10
Charge dynamiquement les classes de détection YOLO selon les modules
activés pour une organisation.

Principe fondamental :
  Le même moteur YOLOv11 tourne pour tous les modules.
  Seules les classes de détection et les seuils changent.
  Un module = un set de classes + un modèle fine-tuné (optionnel).
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
from loguru import logger


@dataclass
class ModuleConfig:
    """Configuration d'un module pour le moteur YOLO."""
    slug:            str
    name:            str
    # Classes YOLO actives (subset de DETECTION_CLASSES ou classes custom)
    detection_classes: dict[int, str]
    # Modèle spécifique si fine-tuné (None = modèle général yolo11m.pt)
    model_override:  Optional[str]    = None
    # Seuils spécifiques (None = valeurs globales de config.py)
    conf_threshold:  Optional[float]  = None
    iou_threshold:   Optional[float]  = None


# ─── Configurations par module ────────────────────────────────────────────────

MODULE_CONFIGS: dict[str, ModuleConfig] = {

  "home": ModuleConfig(
    slug="home",
    name="Vision Guard Home",
    detection_classes={
      0: "person",
      2: "car",
      15: "cat",
      16: "dog",
    },
  ),

  "retail": ModuleConfig(
    slug="retail",
    name="Vision Guard Retail",
    detection_classes={
      0:   "person",
      # Classes custom (modèle fine-tuné sur dataset retail)
      100: "shoplifting_gesture",
      101: "empty_shelf",
      102: "queue",
    },
    model_override="yolo11m-retail.pt",
    conf_threshold=0.50,
  ),

  "industry": ModuleConfig(
    slug="industry",
    name="Vision Guard Industry",
    detection_classes={
      0:   "person",
      200: "no_helmet",
      201: "no_vest",
      202: "no_glasses",
      203: "danger_zone_intrusion",
    },
    model_override="yolo11m-ppe.pt",
    conf_threshold=0.55,
  ),

  "construction": ModuleConfig(
    slug="construction",
    name="Vision Guard Construction",
    detection_classes={
      0:   "person",
      7:   "truck",        # engins → repurposed class
      200: "no_helmet",
      300: "fall_detection",
      301: "restricted_zone",
    },
    model_override="yolo11m-construction.pt",
    conf_threshold=0.50,
  ),

  "smart_city": ModuleConfig(
    slug="smart_city",
    name="Vision Guard Smart City",
    detection_classes={
      0: "person",
      2: "car",
      3: "motorcycle",
      5: "bus",
      7: "truck",
      400: "traffic_violation",
      401: "illegal_parking",
    },
    conf_threshold=0.40,
  ),

  "agriculture": ModuleConfig(
    slug="agriculture",
    name="Vision Guard Agriculture",
    detection_classes={
      0:  "person",
      15: "cat",
      16: "dog",
      17: "horse",
      18: "sheep",
      19: "cow",
      20: "elephant",
    },
    conf_threshold=0.45,
  ),

  "defense": ModuleConfig(
    slug="defense",
    name="Vision Guard Defense",
    detection_classes={
      0:   "person",
      2:   "car",
      500: "drone",
      501: "weapon",
      502: "intrusion",
    },
    model_override="yolo11m-defense.pt",
    conf_threshold=0.60,  # Précision maximale pour sécurité critique
  ),
}


class ModuleLoader:
    """
    Détermine la configuration YOLO à utiliser pour une organisation,
    en fonction de ses modules activés dans Firestore.
    """

    def get_config(self, active_slugs: list[str]) -> ModuleConfig:
        """
        Fusionne les configurations des modules actifs.
        Si plusieurs modules sont actifs, leurs classes de détection sont combinées.
        Le modèle du module le plus "spécialisé" (non-Home) prend la priorité.
        """
        if not active_slugs:
            return MODULE_CONFIGS["home"]  # Fallback

        # Priorité : defense > industry > construction > retail > smart_city > agriculture > home
        priority = ["defense","industry","construction","retail","smart_city","agriculture","home"]
        primary_slug = next((s for s in priority if s in active_slugs), "home")
        primary = MODULE_CONFIGS.get(primary_slug, MODULE_CONFIGS["home"])

        # Fusionner les classes de tous les modules actifs
        merged_classes: dict[int, str] = {}
        for slug in active_slugs:
            cfg = MODULE_CONFIGS.get(slug)
            if cfg:
                merged_classes.update(cfg.detection_classes)

        logger.info(
            f"ModuleLoader | modules={active_slugs} primary={primary_slug} "
            f"classes={len(merged_classes)} model={primary.model_override or 'default'}"
        )

        return ModuleConfig(
            slug=primary_slug,
            name=primary.name,
            detection_classes=merged_classes,
            model_override=primary.model_override,
            conf_threshold=primary.conf_threshold,
            iou_threshold=primary.iou_threshold,
        )
