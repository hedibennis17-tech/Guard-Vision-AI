"""
EventAggregator (Python — AI Engine) — Phase 6.

Complément Python de la Cloud Function onDetectionCreated.
Responsable de :
  - Assembler les frames d'une fenêtre de détection en clip vidéo MP4
  - Uploader le clip dans Firebase Storage
  - Mettre à jour l'EventDoc avec videoClipUrl

La logique d'agrégation Firestore (création/update d'EventDoc) est gérée
par la Cloud Function JavaScript onDetectionCreated (plus réactif, serverless).
Ce module Python s'occupe uniquement des tâches lourdes (encodage vidéo).
"""

from __future__ import annotations
import io
import uuid
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional, Deque
import numpy as np
from loguru import logger

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False

try:
    from firebase_admin import firestore, storage
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False


@dataclass
class FrameRecord:
    """Frame capturée autour d'une détection, pour le clip vidéo."""
    frame: np.ndarray
    timestamp: float
    detection_type: str
    confidence: float


@dataclass
class EventBuffer:
    """Buffer de frames pour une fenêtre d'événement (caméra + type)."""
    camera_id: str
    organization_id: str
    detection_type: str
    frames: Deque[FrameRecord] = field(default_factory=lambda: deque(maxlen=150))  # ~5s @ 30fps
    event_id: Optional[str] = None
    started_at: float = field(default_factory=lambda: __import__("time").time())


class EventAggregator:
    """
    Maintient des buffers de frames par (camera_id, detection_type).
    Quand un événement se termine (plus de détection pendant > 5s),
    génère un clip MP4 et l'upload dans Firebase Storage.
    """

    CLIP_SILENCE_SEC = 5   # pas de détection pendant 5s → fin de l'épisode

    def __init__(self, organization_id: str):
        self.organization_id = organization_id
        self._buffers: dict[str, EventBuffer] = {}

    def on_frame_with_detection(
        self,
        camera_id: str,
        frame: np.ndarray,
        detection_type: str,
        confidence: float,
        event_id: Optional[str] = None,
    ) -> None:
        """
        Appelé par le DetectionEngine pour chaque frame avec au moins une détection.
        Accumule les frames dans le buffer correspondant.
        """
        key = f"{camera_id}:{detection_type}"

        if key not in self._buffers:
            self._buffers[key] = EventBuffer(
                camera_id=camera_id,
                organization_id=self.organization_id,
                detection_type=detection_type,
            )

        buf = self._buffers[key]
        if event_id:
            buf.event_id = event_id

        buf.frames.append(FrameRecord(
            frame=frame.copy(),
            timestamp=__import__("time").time(),
            detection_type=detection_type,
            confidence=confidence,
        ))

    def flush_stale_buffers(self) -> None:
        """
        À appeler périodiquement (ex: toutes les 5s).
        Génère les clips pour les buffers qui n'ont plus reçu de frame récente.
        """
        import time
        now = time.time()
        to_flush = []

        for key, buf in self._buffers.items():
            if not buf.frames:
                to_flush.append(key)
                continue
            last_frame_ts = buf.frames[-1].timestamp
            if now - last_frame_ts > self.CLIP_SILENCE_SEC:
                to_flush.append(key)

        for key in to_flush:
            buf = self._buffers.pop(key)
            if buf.frames and buf.event_id:
                self._generate_and_upload_clip(buf)

    def _generate_and_upload_clip(self, buf: EventBuffer) -> None:
        """Encode les frames en MP4 et upload dans Firebase Storage."""
        if not CV2_AVAILABLE or not buf.frames:
            logger.debug(f"[STUB] Clip vidéo simulé pour event={buf.event_id}")
            return

        try:
            first_frame = buf.frames[0].frame
            h, w = first_frame.shape[:2]
            clip_id = str(uuid.uuid4())

            # Encoder en MP4 en mémoire
            fourcc    = cv2.VideoWriter_fourcc(*"mp4v")
            tmp_path  = f"/tmp/visionguard/clips/{clip_id}.mp4"
            __import__("os").makedirs("/tmp/visionguard/clips", exist_ok=True)

            writer = cv2.VideoWriter(tmp_path, fourcc, 15.0, (w, h))
            for record in buf.frames:
                writer.write(record.frame)
            writer.release()

            # Upload Firebase Storage
            video_url = self._upload_clip(
                tmp_path,
                buf.organization_id,
                buf.camera_id,
                clip_id,
            )

            # Mettre à jour l'EventDoc avec videoClipUrl
            if video_url and FIREBASE_AVAILABLE:
                db = firestore.client()
                db.collection("organizations").document(buf.organization_id) \
                  .collection("events").document(buf.event_id) \
                  .update({
                    "videoClipUrl": video_url,
                    "updatedAt": datetime.now(timezone.utc).isoformat(),
                  })

            logger.success(
                f"Clip généré | event={buf.event_id} "
                f"frames={len(buf.frames)} url={video_url}"
            )
            __import__("os").remove(tmp_path)

        except Exception as e:
            logger.error(f"Erreur génération clip : {e}")

    def _upload_clip(
        self,
        local_path: str,
        organization_id: str,
        camera_id: str,
        clip_id: str,
    ) -> Optional[str]:
        if not FIREBASE_AVAILABLE:
            return None
        try:
            bucket     = storage.bucket()
            blob_path  = f"organizations/{organization_id}/videos/{camera_id}/{clip_id}.mp4"
            blob       = bucket.blob(blob_path)
            blob.upload_from_filename(local_path, content_type="video/mp4")
            blob.make_public()
            return blob.public_url
        except Exception as e:
            logger.error(f"Erreur upload clip : {e}")
            return None
