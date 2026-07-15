"""
YOLOv11Detector — wrapper autour d'Ultralytics YOLOv11.

PRINCIPE CLÉ (Phase 5) :
Ce module ne connaît JAMAIS le type de connecteur (Ring, Hikvision, RTSP...).
Il reçoit uniquement des frames numpy (images) et retourne des détections.
C'est le StreamReader (stream/stream_reader.py) qui lit le flux RTSP.

Le Detector ne sait donc rien du réseau, des caméras, ni de Firebase.
Il fait une seule chose : analyser une image → retourner des DetectionResult.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional
import numpy as np
from loguru import logger

try:
    from ultralytics import YOLO
    ULTRALYTICS_AVAILABLE = True
except ImportError:
    ULTRALYTICS_AVAILABLE = False
    logger.warning("ultralytics non installé — Detector en mode stub.")

from config import (
    YOLO_MODEL_NAME, YOLO_MODEL_PATH, YOLO_CONF,
    YOLO_IOU, YOLO_IMG_SIZE, YOLO_DEVICE, DETECTION_CLASSES,
)


@dataclass
class BoundingBox:
    x: float      # centre X (0-1)
    y: float      # centre Y (0-1)
    width: float  # largeur (0-1)
    height: float # hauteur (0-1)


@dataclass
class DetectionResult:
    """Résultat d'une détection sur une frame."""
    class_id: int
    class_name: str
    confidence: float
    bounding_box: BoundingBox
    frame_index: int = 0


@dataclass
class FrameAnalysis:
    """Résultat de l'analyse complète d'une frame."""
    detections: list[DetectionResult] = field(default_factory=list)
    inference_ms: float = 0.0
    frame_index: int = 0
    has_detections: bool = False


class YOLOv11Detector:
    """
    Wrapper YOLOv11 pour Vision Guard.

    Usage :
        detector = YOLOv11Detector()
        detector.load()
        analysis = detector.analyze(frame_numpy)
        for det in analysis.detections:
            print(det.class_name, det.confidence)
    """

    def __init__(self):
        self.model = None
        self._loaded = False
        self._frame_count = 0

    def load(self) -> None:
        """Charge le modèle YOLOv11. Télécharge automatiquement si absent."""
        if self._loaded:
            return

        if not ULTRALYTICS_AVAILABLE:
            logger.warning("ultralytics absent — détecteur en mode stub.")
            self._loaded = True
            return

        model_path = str(YOLO_MODEL_PATH) if YOLO_MODEL_PATH.exists() else YOLO_MODEL_NAME
        logger.info(f"Chargement YOLOv11 : {model_path} sur {YOLO_DEVICE}")

        self.model = YOLO(model_path)
        self.model.to(YOLO_DEVICE)
        self._loaded = True
        logger.success(f"YOLOv11 chargé ✅  (conf={YOLO_CONF}, iou={YOLO_IOU}, device={YOLO_DEVICE})")

    def analyze(self, frame: np.ndarray, frame_index: int = 0) -> FrameAnalysis:
        """
        Analyse une frame et retourne les détections.

        Args:
            frame: Image numpy BGR (format OpenCV standard).
            frame_index: Index de la frame dans le flux (pour la traçabilité).

        Returns:
            FrameAnalysis avec la liste des DetectionResult.
        """
        if not self._loaded:
            self.load()

        # Mode stub si ultralytics absent
        if not ULTRALYTICS_AVAILABLE or self.model is None:
            return self._stub_analysis(frame_index)

        import time
        start = time.perf_counter()

        results = self.model.predict(
            source=frame,
            conf=YOLO_CONF,
            iou=YOLO_IOU,
            imgsz=YOLO_IMG_SIZE,
            verbose=False,
            classes=list(DETECTION_CLASSES.keys()),
        )

        inference_ms = (time.perf_counter() - start) * 1000
        detections: list[DetectionResult] = []

        for result in results:
            if result.boxes is None:
                continue
            h, w = frame.shape[:2]
            for box in result.boxes:
                class_id  = int(box.cls[0].item())
                class_name = DETECTION_CLASSES.get(class_id, result.names.get(class_id, "unknown"))
                confidence = float(box.conf[0].item())

                # Conversion xyxy → xywh normalisé (0-1)
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                bx = ((x1 + x2) / 2) / w
                by = ((y1 + y2) / 2) / h
                bw = (x2 - x1) / w
                bh = (y2 - y1) / h

                detections.append(DetectionResult(
                    class_id=class_id,
                    class_name=class_name,
                    confidence=round(confidence, 4),
                    bounding_box=BoundingBox(x=bx, y=by, width=bw, height=bh),
                    frame_index=frame_index,
                ))

        return FrameAnalysis(
            detections=detections,
            inference_ms=round(inference_ms, 2),
            frame_index=frame_index,
            has_detections=len(detections) > 0,
        )

    def _stub_analysis(self, frame_index: int) -> FrameAnalysis:
        """Retourne une détection simulée quand ultralytics n'est pas disponible."""
        import random
        if random.random() > 0.7:
            return FrameAnalysis(detections=[
                DetectionResult(
                    class_id=0, class_name="person",
                    confidence=round(random.uniform(0.7, 0.98), 4),
                    bounding_box=BoundingBox(x=0.5, y=0.5, width=0.2, height=0.4),
                    frame_index=frame_index,
                )
            ], inference_ms=12.0, frame_index=frame_index, has_detections=True)
        return FrameAnalysis(frame_index=frame_index)

    @property
    def is_loaded(self) -> bool:
        return self._loaded
