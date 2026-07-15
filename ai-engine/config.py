"""
Vision Guard AI Engine — Configuration
Toutes les valeurs sont chargées depuis les variables d'environnement (.env).
"""

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# ─── Chemins ────────────────────────────────────────────────────────────────
BASE_DIR   = Path(__file__).parent
MODELS_DIR = BASE_DIR / "models"
MODELS_DIR.mkdir(exist_ok=True)

# ─── YOLOv11 ────────────────────────────────────────────────────────────────
# Modèles disponibles (du plus rapide au plus précis) :
#   yolo11n.pt → nano     (rapide, embarqué)
#   yolo11s.pt → small
#   yolo11m.pt → medium   ← recommandé pour serveur GPU
#   yolo11l.pt → large
#   yolo11x.pt → xlarge   (meilleure précision)
YOLO_MODEL_NAME  = os.getenv("YOLO_MODEL", "yolo11m.pt")
YOLO_MODEL_PATH  = MODELS_DIR / YOLO_MODEL_NAME
YOLO_CONF        = float(os.getenv("YOLO_CONF", "0.45"))   # seuil de confiance
YOLO_IOU         = float(os.getenv("YOLO_IOU",  "0.50"))   # seuil NMS IoU
YOLO_IMG_SIZE    = int(os.getenv("YOLO_IMG_SIZE", "640"))
YOLO_DEVICE      = os.getenv("YOLO_DEVICE", "cpu")         # "cpu" | "cuda" | "mps"

# ─── Traitement vidéo ───────────────────────────────────────────────────────
FRAME_SKIP         = int(os.getenv("FRAME_SKIP", "3"))       # analyser 1 frame / N
SNAPSHOT_ON_DETECT = os.getenv("SNAPSHOT_ON_DETECT", "true").lower() == "true"
MAX_STREAMS        = int(os.getenv("MAX_STREAMS", "16"))     # limité par le plan

# ─── Firebase ───────────────────────────────────────────────────────────────
FIREBASE_PROJECT_ID          = os.getenv("FIREBASE_PROJECT_ID", "")
FIREBASE_STORAGE_BUCKET      = os.getenv("FIREBASE_STORAGE_BUCKET", "")
FIREBASE_SERVICE_ACCOUNT_KEY = os.getenv(
    "FIREBASE_SERVICE_ACCOUNT_KEY",
    str(BASE_DIR / "firebase-service-account.json"),
)

# ─── API HTTP ────────────────────────────────────────────────────────────────
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))

# ─── Types de détection activés par défaut ──────────────────────────────────
# Classes COCO (YOLOv11 natif) filtrées pour la surveillance :
DETECTION_CLASSES = {
    0:  "person",
    2:  "car",
    3:  "motorcycle",
    5:  "bus",
    7:  "truck",
    14: "bird",
    15: "cat",
    16: "dog",
    # Classes custom (modules Marketplace — chargées dynamiquement) :
    # "fire", "smoke", "license_plate", "ppe_violation" → via fine-tuning
}
