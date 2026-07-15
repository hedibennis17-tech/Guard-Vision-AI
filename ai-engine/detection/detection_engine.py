"""
DetectionEngine — orchestrateur principal du AI Engine (Phase 5).

C'est ici que tout se connecte :
  StreamReader  →  frame numpy
  YOLOv11Detector  →  DetectionResult
  FirebaseClient  →  DetectionDoc (Firestore) + snapshot (Storage)

Flow complet :
  Firestore cameras/{camId} status=online
      ↓  (listener)
  DetectionEngine.start_camera(cam)
      ↓
  StreamReader(rtspUrl)
      ↓  (frame numpy, chaque N frames)
  YOLOv11Detector.analyze(frame)
      ↓  (DetectionResult[])
  FirebaseClient.save_detection()
      ↓
  Firestore detections/{id}  → déclenche Event Engine (Phase 6)
"""

from __future__ import annotations
import asyncio
from dataclasses import dataclass
from typing import Dict, Optional
import numpy as np
from loguru import logger

from yolo.detector import YOLOv11Detector, FrameAnalysis
from stream.stream_reader import StreamReader, StreamInfo
from firebase.firestore_client import FirebaseClient
from config import SNAPSHOT_ON_DETECT, MAX_STREAMS


@dataclass
class ActiveCamera:
    camera_id: str
    organization_id: str
    site_id: str
    rtsp_url: str
    reader: StreamReader
    detection_count: int = 0


class DetectionEngine:
    """
    Orchestre la détection IA sur tous les flux actifs.

    Usage :
        engine = DetectionEngine()
        engine.start()       # charge YOLO, écoute Firestore
        # ...
        engine.shutdown()
    """

    def __init__(self):
        self.detector   = YOLOv11Detector()
        self.firebase   = FirebaseClient()
        self._cameras: Dict[str, ActiveCamera] = {}
        self._running   = False

    def start(self) -> None:
        """Charge YOLO, initialise Firebase, démarre le listener Firestore."""
        logger.info("Démarrage du Detection Engine...")
        self.detector.load()
        self.firebase.initialize()

        # S'abonner aux changements de caméras dans Firestore
        self.firebase.listen_active_cameras(self._on_camera_change)

        self._running = True
        logger.success(
            f"Detection Engine prêt ✅  "
            f"(model={__import__('config').YOLO_MODEL_NAME}, "
            f"device={__import__('config').YOLO_DEVICE})"
        )

    def shutdown(self) -> None:
        """Arrête proprement tous les streams actifs."""
        logger.info("Arrêt du Detection Engine...")
        self._running = False
        for cam_id in list(self._cameras.keys()):
            self._stop_camera(cam_id)
        logger.info("Detection Engine arrêté.")

    # ─── Gestion des caméras ────────────────────────────────────────────────

    def _on_camera_change(self, change_type: str, cam_data: dict) -> None:
        """
        Callback appelé par le listener Firestore quand une caméra change d'état.
        change_type : "ADDED" | "MODIFIED" | "REMOVED"
        """
        cam_id  = cam_data.get("id", "")
        org_id  = cam_data.get("organizationId", "")
        status  = cam_data.get("status", "")
        rtsp    = cam_data.get("streamUrl", "")
        site_id = cam_data.get("siteId", "")

        if not cam_id or not org_id:
            return

        if status == "online" and rtsp and cam_id not in self._cameras:
            self._start_camera(cam_id, org_id, site_id, rtsp)
        elif status == "offline" and cam_id in self._cameras:
            self._stop_camera(cam_id)

    def _start_camera(
        self, camera_id: str, organization_id: str, site_id: str, rtsp_url: str
    ) -> None:
        """Démarre le stream et la détection pour une caméra."""
        if len(self._cameras) >= MAX_STREAMS:
            logger.warning(f"Limite MAX_STREAMS={MAX_STREAMS} atteinte, caméra {camera_id} ignorée.")
            return

        reader = StreamReader(
            camera_id=camera_id,
            organization_id=organization_id,
            rtsp_url=rtsp_url,
            on_frame=self._on_frame,
        )
        reader.start()

        self._cameras[camera_id] = ActiveCamera(
            camera_id=camera_id,
            organization_id=organization_id,
            site_id=site_id,
            rtsp_url=rtsp_url,
            reader=reader,
        )
        logger.info(f"Caméra démarrée | cam={camera_id} | org={organization_id}")

    def _stop_camera(self, camera_id: str) -> None:
        """Arrête le stream d'une caméra."""
        cam = self._cameras.pop(camera_id, None)
        if cam:
            cam.reader.stop()
            self.firebase.update_camera_status(cam.organization_id, camera_id, "offline")
            logger.info(f"Caméra arrêtée | cam={camera_id}")

    # ─── Traitement des frames ───────────────────────────────────────────────

    def _on_frame(self, frame: np.ndarray, stream_info: StreamInfo) -> None:
        """
        Appelé par StreamReader pour chaque frame à analyser.
        Passe la frame à YOLO, puis enregistre les détections dans Firestore.
        """
        if not self._running:
            return

        analysis: FrameAnalysis = self.detector.analyze(frame)
        if not analysis.has_detections:
            return

        cam = self._cameras.get(stream_info.camera_id)
        if not cam:
            return

        for detection in analysis.detections:
            snapshot_frame = frame if SNAPSHOT_ON_DETECT else None
            detection_id = self.firebase.save_detection(
                stream_info=stream_info,
                detection=detection,
                frame=snapshot_frame,
            )
            cam.detection_count += 1
            logger.debug(
                f"Détection | cam={stream_info.camera_id} "
                f"type={detection.class_name} "
                f"conf={detection.confidence:.2%} "
                f"id={detection_id[:8]}..."
            )

    # ─── API publique (utilisée par FastAPI) ────────────────────────────────

    def get_status(self) -> dict:
        """Retourne l'état de l'engine (pour le endpoint /status de l'API)."""
        return {
            "running": self._running,
            "model_loaded": self.detector.is_loaded,
            "active_streams": len(self._cameras),
            "cameras": [
                {
                    "camera_id":       cam.camera_id,
                    "organization_id": cam.organization_id,
                    "is_active":       cam.reader.info.is_active,
                    "detection_count": cam.detection_count,
                    "fps":             cam.reader.info.fps,
                    "resolution":      f"{cam.reader.info.width}×{cam.reader.info.height}",
                }
                for cam in self._cameras.values()
            ],
        }

    def add_camera_manual(
        self, camera_id: str, organization_id: str, site_id: str, rtsp_url: str
    ) -> dict:
        """Démarre manuellement un stream (endpoint POST /cameras/start)."""
        self._start_camera(camera_id, organization_id, site_id, rtsp_url)
        return {"success": True, "camera_id": camera_id}

    def remove_camera_manual(self, camera_id: str) -> dict:
        """Arrête manuellement un stream (endpoint DELETE /cameras/{id})."""
        self._stop_camera(camera_id)
        return {"success": True, "camera_id": camera_id}
