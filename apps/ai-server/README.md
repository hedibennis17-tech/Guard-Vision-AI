# Vision Guard AI Server

FastAPI + YOLOv11 + ByteTrack + PaddleOCR

## Déploiement Railway (recommandé — 5min)

1. Aller sur https://railway.app
2. New Project → Deploy from GitHub → choisir `Guard-Vision-AI`
3. Sélectionner le dossier `apps/ai-server`
4. Ajouter les variables d'environnement (voir `.env.example`)
5. Le serveur est live sur `https://votre-projet.railway.app`

## Variables d'environnement Railway

```
FIREBASE_PROJECT_ID=ai-guard-vision-8ef41
FIREBASE_CREDENTIALS_JSON=<votre service account JSON>
YOLO_MODEL=yolov11n.pt
YOLO_DEVICE=cpu
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | / | Status + modèles |
| GET | /health | Health check |
| POST | /detect | Détection image base64 |
| POST | /pipeline/run | Pipeline complet → Firebase |
| WS | /ws/{camera_id} | Stream temps réel |
| POST | /detect/upload | Upload image |

## Test local

```bash
pip install -r requirements.txt
uvicorn main:app --reload
# API disponible sur http://localhost:8000
```

## Connecter au Dashboard

Dans `.env.local` du dashboard:
```
NEXT_PUBLIC_AI_SERVER_URL=https://votre-projet.railway.app
```
