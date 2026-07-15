"""
FirebaseClient — écriture des détections dans Firestore et des snapshots dans Storage.

Seul module du AI Engine qui connaît Firebase.
Le Detector et le StreamReader n'ont aucune dépendance Firebase.
"""

from __future__ import annotations
import io
import uuid
from datetime import datetime, timezone
from typing import Optional
import numpy as np
from loguru import logger

try:
    import firebase_admin
    from firebase_admin import credentials, firestore, storage
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False
    logger.warning("firebase-admin non installé — FirebaseClient en mode stub.")

from config import FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET, FIREBASE_SERVICE_ACCOUNT_KEY
from yolo.detector import DetectionResult, FrameAnalysis
from stream.stream_reader import StreamInfo


class FirebaseClient:
    """
    Interface unique entre le AI Engine et Firebase.
    Écrit les DetectionDoc dans Firestore et les snapshots dans Storage.
    """

    def __init__(self):
        self._db = None
        self._bucket = None
        self._initialized = False

    def initialize(self) -> None:
        if self._initialized or not FIREBASE_AVAILABLE:
            return

        try:
            if not firebase_admin._apps:
                cred = credentials.Certificate(FIREBASE_SERVICE_ACCOUNT_KEY)
                firebase_admin.initialize_app(cred, {
                    "storageBucket": FIREBASE_STORAGE_BUCKET,
                })
            self._db = firestore.client()
            self._bucket = storage.bucket()
            self._initialized = True
            logger.success("Firebase Admin SDK initialisé ✅")
        except Exception as e:
            logger.error(f"Erreur initialisation Firebase : {e}")

    def save_detection(
        self,
        stream_info: StreamInfo,
        detection: DetectionResult,
        frame: Optional[np.ndarray] = None,
    ) -> str:
        """
        Enregistre une détection dans Firestore.
        Structure : organizations/{orgId}/detections/{detectionId}

        Returns:
            detectionId créé.
        """
        detection_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        snapshot_url: Optional[str] = None
        if frame is not None and self._bucket is not None:
            snapshot_url = self._upload_snapshot(
                frame, stream_info.organization_id, stream_info.camera_id, detection_id
            )

        doc = {
            "id":             detection_id,
            "organizationId": stream_info.organization_id,
            "siteId":         "",   # rempli par le DetectionEngine si disponible
            "cameraId":       stream_info.camera_id,
            "type":           detection.class_name,
            "confidence":     detection.confidence,
            "boundingBox": {
                "x":      detection.bounding_box.x,
                "y":      detection.bounding_box.y,
                "width":  detection.bounding_box.width,
                "height": detection.bounding_box.height,
            },
            "snapshotUrl": snapshot_url,
            "videoClipUrl": None,
            "detectedAt": now,
        }

        if self._db:
            self._db \
                .collection("organizations") \
                .document(stream_info.organization_id) \
                .collection("detections") \
                .document(detection_id) \
                .set(doc)
        else:
            logger.debug(f"[STUB] Detection sauvegardée : {detection.class_name} @ {detection.confidence:.2%}")

        return detection_id

    def _upload_snapshot(
        self,
        frame: np.ndarray,
        organization_id: str,
        camera_id: str,
        detection_id: str,
    ) -> Optional[str]:
        """Upload un snapshot JPEG dans Firebase Storage et retourne son URL publique."""
        try:
            import cv2
            _, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            blob_path = (
                f"organizations/{organization_id}/snapshots/"
                f"{camera_id}/{detection_id}.jpg"
            )
            blob = self._bucket.blob(blob_path)
            blob.upload_from_string(buffer.tobytes(), content_type="image/jpeg")
            blob.make_public()
            return blob.public_url
        except Exception as e:
            logger.error(f"Erreur upload snapshot : {e}")
            return None

    def update_camera_status(
        self, organization_id: str, camera_id: str, status: str
    ) -> None:
        """Met à jour le statut d'une caméra dans Firestore."""
        if not self._db:
            return
        try:
            self._db \
                .collection("organizations").document(organization_id) \
                .collection("cameras").document(camera_id) \
                .update({
                    "status": status,
                    "updatedAt": datetime.now(timezone.utc).isoformat(),
                })
        except Exception as e:
            logger.error(f"Erreur update camera status : {e}")

    def listen_active_cameras(self, on_camera_change: callable) -> None:
        """
        S'abonne aux changements de caméras actives dans Firestore (snapshot listener).
        Quand une caméra passe à status='online', le DetectionEngine démarre son stream.
        """
        if not self._db:
            logger.warning("[STUB] Pas de listener Firestore — mode démo.")
            return

        # NOTE : en production, le listener tourne sur TOUTES les organisations.
        # Pour Phase 5, on écoute la collection globale via collectionGroup.
        def on_snapshot(col_snapshot, changes, read_time):
            for change in changes:
                cam_data = change.document.to_dict()
                on_camera_change(change.type.name, cam_data)

        self._db.collection_group("cameras") \
            .where("status", "in", ["online", "offline"]) \
            .on_snapshot(on_snapshot)
