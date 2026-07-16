"""
DetectionEngine — orchestrateur principal du AI Engine (Phase 5 + 6).
"""

from __future__ import annotations
import threading
import time
from dataclasses import dataclass
from typing import Dict, Optional
import numpy as np
from loguru import logger

from yolo.detector import YOLOv11Detector, FrameAnalysis
from stream.stream_reader import StreamReader, StreamInfo
from firebase.firestore_client import FirebaseClient
from events.event_aggregator import EventAggregator
from config import SNAPSHOT_ON_DETECT, MAX_STREAMS


@dataclass
class ActiveCamera:
    camera_id: str
    organization_id: str
    site_id: str
    rtsp_url: str
    reader: StreamReader
    aggregator: EventAggregator
    detection_count: int = 0


class DetectionEngine:
    def __init__(self):
        self.detector  = YOLOv11Detector()
        self.firebase  = FirebaseClient()
        self._cameras: Dict[str, ActiveCamera] = {}
        self._running  = False
        self._flush_thread: Optional[threading.Thread] = None

    def start(self) -> None:
        self.detector.load()
        self.firebase.initialize()
        self.firebase.listen_active_cameras(self._on_camera_change)

        # Flush périodique des buffers de clips vidéo (Phase 6)
        self._running = True
        self._flush_thread = threading.Thread(
            target=self._flush_loop, daemon=True, name="event-flush"
        )
        self._flush_thread.start()

        logger.success(
            f"Detection Engine prêt ✅  "
            f"(model={__import__('config').YOLO_MODEL_NAME}, "
            f"device={__import__('config').YOLO_DEVICE})"
        )

    def shutdown(self) -> None:
        self._running = False
        for cam_id in list(self._cameras.keys()):
            self._stop_camera(cam_id)
        logger.info("Detection Engine arrêté.")

    # ─── Caméras ──────────────────────────────────────────────────────────

    def _on_camera_change(self, change_type: str, cam_data: dict) -> None:
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

    def _start_camera(self, camera_id: str, organization_id: str, site_id: str, rtsp_url: str) -> None:
        if len(self._cameras) >= MAX_STREAMS:
            logger.warning(f"Limite MAX_STREAMS atteinte, caméra {camera_id} ignorée.")
            return

        aggregator = EventAggregator(organization_id)
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
            aggregator=aggregator,
        )
        logger.info(f"Caméra démarrée | cam={camera_id}")

    def _stop_camera(self, camera_id: str) -> None:
        cam = self._cameras.pop(camera_id, None)
        if cam:
            # Flush final pour générer les clips en cours
            cam.aggregator.flush_stale_buffers()
            cam.reader.stop()
            self.firebase.update_camera_status(cam.organization_id, camera_id, "offline")
            logger.info(f"Caméra arrêtée | cam={camera_id}")

    # ─── Traitement des frames ───────────────────────────────────────────

    def _on_frame(self, frame: np.ndarray, stream_info: StreamInfo) -> None:
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
            # Alimenter l'EventAggregator avec la frame (Phase 6 — clip vidéo)
            cam.aggregator.on_frame_with_detection(
                camera_id=stream_info.camera_id,
                frame=frame,
                detection_type=detection.class_name,
                confidence=detection.confidence,
                event_id=None,  # sera rempli par le listener Firestore si nécessaire
            )
            cam.detection_count += 1
            logger.debug(
                f"Détection | cam={stream_info.camera_id} "
                f"type={detection.class_name} "
                f"conf={detection.confidence:.2%} "
                f"id={detection_id[:8]}..."
            )

    # ─── Flush périodique (clips vidéo) ─────────────────────────────────

    def _flush_loop(self) -> None:
        """Flush les buffers d'événements toutes les 5 secondes."""
        while self._running:
            time.sleep(5)
            for cam in list(self._cameras.values()):
                try:
                    cam.aggregator.flush_stale_buffers()
                except Exception as e:
                    logger.error(f"Erreur flush aggregator : {e}")

    # ─── API publique ────────────────────────────────────────────────────

    def get_status(self) -> dict:
        return {
            "running":        self._running,
            "model_loaded":   self.detector.is_loaded,
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

    def add_camera_manual(self, camera_id: str, organization_id: str, site_id: str, rtsp_url: str) -> dict:
        self._start_camera(camera_id, organization_id, site_id, rtsp_url)
        return {"success": True, "camera_id": camera_id}

    def remove_camera_manual(self, camera_id: str) -> dict:
        self._stop_camera(camera_id)
        return {"success": True, "camera_id": camera_id}
