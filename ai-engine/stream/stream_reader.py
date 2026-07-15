"""
StreamReader — lit un flux RTSP via OpenCV et produit des frames numpy.

Ce module est totalement indépendant de YOLO.
Il reçoit une rtspUrl (normalisée par le ConnectorEngine — Phase 3)
et émet des frames pour le DetectionEngine.

Il ne sait pas si la source est Ring, Hikvision, ONVIF, etc.
"""

from __future__ import annotations
import asyncio
import threading
import time
from dataclasses import dataclass
from typing import Optional, Callable
import numpy as np
from loguru import logger

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False
    logger.warning("opencv non installé — StreamReader en mode stub.")

from config import FRAME_SKIP, MAX_STREAMS


@dataclass
class StreamInfo:
    camera_id: str
    organization_id: str
    rtsp_url: str           # jamais le nom du connecteur, juste l'URL
    width: int = 0
    height: int = 0
    fps: float = 0.0
    is_active: bool = False
    reconnect_attempts: int = 0
    last_frame_at: Optional[float] = None


class StreamReader:
    """
    Lit un flux RTSP et appelle `on_frame` pour chaque frame analysable.

    Usage :
        reader = StreamReader(
            camera_id="cam1",
            organization_id="org1",
            rtsp_url="rtsp://admin:pass@192.168.1.100:554/stream1",
            on_frame=lambda frame, info: detection_engine.process(frame, info),
        )
        reader.start()
        # ...
        reader.stop()
    """

    MAX_RECONNECT = 5
    RECONNECT_DELAY = 5  # secondes

    def __init__(
        self,
        camera_id: str,
        organization_id: str,
        rtsp_url: str,
        on_frame: Callable[[np.ndarray, StreamInfo], None],
        frame_skip: int = FRAME_SKIP,
    ):
        self.info = StreamInfo(
            camera_id=camera_id,
            organization_id=organization_id,
            rtsp_url=rtsp_url,
        )
        self.on_frame = on_frame
        self.frame_skip = frame_skip
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None

    def start(self) -> None:
        """Démarre la lecture du flux dans un thread dédié."""
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._read_loop,
            name=f"stream-{self.info.camera_id}",
            daemon=True,
        )
        self._thread.start()
        logger.info(f"StreamReader démarré | cam={self.info.camera_id}")

    def stop(self) -> None:
        """Arrête proprement la lecture."""
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=5)
        self.info.is_active = False
        logger.info(f"StreamReader arrêté | cam={self.info.camera_id}")

    def _read_loop(self) -> None:
        """Boucle principale de lecture du flux RTSP."""
        while not self._stop_event.is_set():
            try:
                self._connect_and_read()
            except Exception as e:
                logger.error(f"Erreur stream {self.info.camera_id}: {e}")

            if self._stop_event.is_set():
                break

            self.info.reconnect_attempts += 1
            if self.info.reconnect_attempts > self.MAX_RECONNECT:
                logger.error(f"Trop de tentatives pour {self.info.camera_id} — abandon.")
                self.info.is_active = False
                break

            logger.warning(
                f"Reconnexion {self.info.reconnect_attempts}/{self.MAX_RECONNECT} "
                f"dans {self.RECONNECT_DELAY}s | cam={self.info.camera_id}"
            )
            time.sleep(self.RECONNECT_DELAY)

    def _connect_and_read(self) -> None:
        if not CV2_AVAILABLE:
            self._stub_loop()
            return

        # Options RTSP pour minimiser la latence
        cap = cv2.VideoCapture(self.info.rtsp_url, cv2.CAP_FFMPEG)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 5000)
        cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 5000)

        if not cap.isOpened():
            raise ConnectionError(f"Impossible d'ouvrir le flux : {self.info.rtsp_url[:50]}...")

        self.info.width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        self.info.height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        self.info.fps    = cap.get(cv2.CAP_PROP_FPS) or 25.0
        self.info.is_active = True
        self.info.reconnect_attempts = 0

        logger.success(
            f"Flux ouvert | cam={self.info.camera_id} "
            f"{self.info.width}×{self.info.height} @ {self.info.fps:.1f}fps"
        )

        frame_index = 0
        while not self._stop_event.is_set():
            ret, frame = cap.read()
            if not ret:
                raise IOError("Flux interrompu (ret=False)")

            self.info.last_frame_at = time.time()
            frame_index += 1

            # Analyser 1 frame sur N pour ne pas saturer le GPU
            if frame_index % self.frame_skip == 0:
                self.on_frame(frame, self.info)

        cap.release()

    def _stub_loop(self) -> None:
        """Simulation quand OpenCV n'est pas disponible."""
        self.info.is_active = True
        self.info.width, self.info.height, self.info.fps = 1280, 720, 25.0
        frame_index = 0
        while not self._stop_event.is_set():
            time.sleep(1.0 / 25)
            frame_index += 1
            if frame_index % self.frame_skip == 0:
                stub_frame = np.zeros((720, 1280, 3), dtype=np.uint8)
                self.on_frame(stub_frame, self.info)
