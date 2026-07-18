"""
ByteTrack — Multi-Object Tracking
Suit les personnes et véhicules à travers les frames
Intégré via ultralytics (BYTETracker)
"""
from ultralytics.trackers.byte_tracker import BYTETracker
from typing import List, Dict, Any, Optional
import numpy as np
from loguru import logger
from config.settings import settings


class ByteTrackManager:
    """
    Gestionnaire de tracking par caméra.
    Chaque caméra a sa propre instance de tracker.
    """
    def __init__(self):
        self._trackers: Dict[str, BYTETracker] = {}

    def _get_tracker(self, camera_id: str) -> BYTETracker:
        if camera_id not in self._trackers:
            self._trackers[camera_id] = BYTETracker(
                track_high_thresh=settings.TRACK_HIGH_THRESH,
                track_low_thresh=settings.TRACK_LOW_THRESH,
                new_track_thresh=settings.TRACK_NEW_THRESH,
                track_buffer=settings.TRACK_BUFFER,
                match_thresh=settings.TRACK_MATCH_THRESH,
            )
            logger.info(f"🔵 Tracker ByteTrack créé pour caméra: {camera_id}")
        return self._trackers[camera_id]

    def update(
        self,
        camera_id:  str,
        detections: List[Dict[str, Any]],
        img_shape:  tuple = (720, 1280),  # (height, width)
    ) -> List[Dict[str, Any]]:
        """
        Met à jour le tracker avec les nouvelles détections.

        Args:
            camera_id:  ID de la caméra
            detections: Liste de détections YOLO
            img_shape:  Dimensions de l'image (h, w)

        Returns:
            Détections enrichies avec track_id et trajectoire
        """
        if not detections:
            return []

        tracker = self._get_tracker(camera_id)

        # Convertir en format ByteTrack: [x1, y1, x2, y2, score, class_id]
        det_array = np.array([
            [*d["bbox"], d["score"], 0]  # class_id = 0 (on track tout)
            for d in detections
            if d.get("bbox")
        ], dtype=np.float32)

        if len(det_array) == 0:
            return detections

        try:
            tracks = tracker.update(det_array, img_shape)
        except Exception as e:
            logger.warning(f"⚠️ ByteTrack update error: {e}")
            return detections

        # Associer les tracks aux détections originales
        tracked = list(detections)
        for track in tracks:
            track_id  = int(track[4])
            bbox      = track[:4].tolist()

            # Trouver la détection correspondante (overlap IoU)
            best_idx  = -1
            best_iou  = 0.3  # seuil minimum

            for i, det in enumerate(detections):
                if not det.get("bbox"):
                    continue
                iou = self._compute_iou(bbox, det["bbox"])
                if iou > best_iou:
                    best_iou = iou
                    best_idx = i

            if best_idx >= 0:
                tracked[best_idx] = {
                    **tracked[best_idx],
                    "track_id":  track_id,
                    "tracked":   True,
                    "track_bbox":bbox,
                }

        return tracked

    def reset(self, camera_id: str):
        """Réinitialise le tracker d'une caméra"""
        if camera_id in self._trackers:
            del self._trackers[camera_id]
            logger.info(f"🔄 Tracker réinitialisé: {camera_id}")

    @staticmethod
    def _compute_iou(box1: list, box2: list) -> float:
        """Calcule l'Intersection over Union"""
        x1 = max(box1[0], box2[0])
        y1 = max(box1[1], box2[1])
        x2 = min(box1[2], box2[2])
        y2 = min(box1[3], box2[3])

        inter = max(0, x2-x1) * max(0, y2-y1)
        if inter == 0:
            return 0.0

        area1 = (box1[2]-box1[0]) * (box1[3]-box1[1])
        area2 = (box2[2]-box2[0]) * (box2[3]-box2[1])
        union = area1 + area2 - inter
        return inter / union if union > 0 else 0.0


# Singleton
_tracker_manager: Optional[ByteTrackManager] = None

def get_tracker() -> ByteTrackManager:
    global _tracker_manager
    if _tracker_manager is None:
        _tracker_manager = ByteTrackManager()
    return _tracker_manager
