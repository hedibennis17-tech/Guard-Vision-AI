from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    HOST:          str   = "0.0.0.0"
    PORT:          int   = 8000
    LOG_LEVEL:     str   = "info"
    ENVIRONMENT:   str   = "production"

    FIREBASE_PROJECT_ID:       str            = "ai-guard-vision-8ef41"
    FIREBASE_CREDENTIALS_PATH: Optional[str]  = None
    FIREBASE_CREDENTIALS_JSON: Optional[str]  = None

    YOLO_MODEL:    str   = "yolo11n.pt"   # auto-téléchargé par ultralytics
    YOLO_CONFIDENCE: float = 0.45
    YOLO_IOU:      float = 0.45
    YOLO_IMG_SIZE: int   = 640
    YOLO_DEVICE:   str   = "cpu"
    YOLO_HALF:     bool  = False

    TRACK_HIGH_THRESH: float = 0.5
    TRACK_LOW_THRESH:  float = 0.1
    TRACK_NEW_THRESH:  float = 0.6
    TRACK_MATCH_THRESH:float = 0.8
    TRACK_BUFFER:      int   = 30

    OCR_LANGUAGE:  str   = "fr"
    OCR_USE_GPU:   bool  = False

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
