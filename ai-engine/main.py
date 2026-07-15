"""
Vision Guard AI Engine — Point d'entrée principal.

Lance le serveur FastAPI qui héberge :
  - Le DetectionEngine (YOLOv11 + StreamReader + FirebaseClient)
  - L'API REST pour le Dashboard et les Cloud Functions

Démarrage :
  python main.py
  # ou
  uvicorn main:app --host 0.0.0.0 --port 8000

Variables d'environnement requises (voir .env.example) :
  FIREBASE_PROJECT_ID
  FIREBASE_STORAGE_BUCKET
  FIREBASE_SERVICE_ACCOUNT_KEY  (chemin vers le JSON)
  YOLO_MODEL                    (défaut: yolo11m.pt)
  YOLO_DEVICE                   (défaut: cpu | cuda | mps)
"""

import uvicorn
from loguru import logger
from api.server import app
from config import API_HOST, API_PORT, YOLO_MODEL_NAME, YOLO_DEVICE

logger.info(f"""
╔══════════════════════════════════════════╗
║   Vision Guard AI Engine — Phase 5      ║
║   YOLOv11 + OpenCV + Firebase            ║
╠══════════════════════════════════════════╣
║  Model  : {YOLO_MODEL_NAME:<30} ║
║  Device : {YOLO_DEVICE:<30} ║
║  API    : http://{API_HOST}:{API_PORT:<20} ║
╚══════════════════════════════════════════╝
""")

if __name__ == "__main__":
    uvicorn.run(
        "api.server:app",
        host=API_HOST,
        port=API_PORT,
        reload=False,
        log_level="info",
    )
