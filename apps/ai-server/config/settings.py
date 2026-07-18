"""
Vision Guard AI Server — Configuration
"""
from pydantic_settings import BaseSettings
from typing import Optional
import os

class Settings(BaseSettings):
    # ── Serveur ──────────────────────────────────────────────────────────────
    HOST:            str   = "0.0.0.0"
    PORT:            int   = 8000
    WORKERS:         int   = 1
    LOG_LEVEL:       str   = "info"
    ENVIRONMENT:     str   = "production"   # development | production

    # ── Firebase ─────────────────────────────────────────────────────────────
    FIREBASE_PROJECT_ID:          str  = "ai-guard-vision-8ef41"
    FIREBASE_CREDENTIALS_PATH:    Optional[str] = None   # chemin vers service account JSON
    FIREBASE_CREDENTIALS_JSON:    Optional[str] = None   # JSON inline (Railway env var)

    # ── YOLOv11 ──────────────────────────────────────────────────────────────
    YOLO_MODEL:          str   = "yolov11n.pt"   # nano=rapide, s/m/l/x=précis
    YOLO_CONFIDENCE:     float = 0.45
    YOLO_IOU:            float = 0.45
    YOLO_IMG_SIZE:       int   = 640
    YOLO_DEVICE:         str   = "cpu"           # cpu | cuda | mps (M1 Mac)
    YOLO_HALF:           bool  = False           # FP16 si GPU

    # ── ByteTrack ────────────────────────────────────────────────────────────
    TRACK_HIGH_THRESH:   float = 0.5
    TRACK_LOW_THRESH:    float = 0.1
    TRACK_NEW_THRESH:    float = 0.6
    TRACK_MATCH_THRESH:  float = 0.8
    TRACK_BUFFER:        int   = 30             # frames de buffer

    # ── PaddleOCR ────────────────────────────────────────────────────────────
    OCR_LANGUAGE:        str   = "fr"            # fr | en | ch
    OCR_USE_GPU:         bool  = False
    OCR_USE_ANGLE_CLS:   bool  = True

    # ── CLIP ─────────────────────────────────────────────────────────────────
    CLIP_MODEL:          str   = "ViT-B/32"

    # ── Pipeline ─────────────────────────────────────────────────────────────
    SNAPSHOT_QUALITY:    int   = 80             # JPEG quality
    MAX_DETECTIONS:      int   = 50             # par frame
    DEBOUNCE_SECONDS:    int   = 6              # anti-doublon

    # ── Modules actifs ────────────────────────────────────────────────────────
    ENABLE_YOLO:         bool  = True
    ENABLE_BYTETRACK:    bool  = True
    ENABLE_OCR:          bool  = True
    ENABLE_CLIP:         bool  = False          # désactivé par défaut (GPU recommandé)
    ENABLE_SAM:          bool  = False          # désactivé par défaut (GPU requis)

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
