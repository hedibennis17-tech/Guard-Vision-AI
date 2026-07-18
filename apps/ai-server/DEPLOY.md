# Déploiement Railway — Vision Guard AI Server

## Étapes exactes (5 minutes)

### 1. Service Account Firebase
Va sur: https://console.firebase.google.com/project/ai-guard-vision-8ef41/settings/serviceaccounts/adminsdk
→ "Générer une nouvelle clé privée" → télécharge le JSON

### 2. Railway
- railway.app → New Project → Deploy from GitHub → Guard-Vision-AI
- Root Directory: `apps/ai-server`
- Railway détecte automatiquement le Dockerfile

### 3. Variables d'environnement Railway (exactement comme ça)

```
FIREBASE_PROJECT_ID=ai-guard-vision-8ef41
FIREBASE_CREDENTIALS_JSON={"type":"service_account","project_id":"ai-guard-vision-8ef41","private_key_id":"xxx","private_key":"-----BEGIN PRIVATE KEY-----\nxxx\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxx@ai-guard-vision-8ef41.iam.gserviceaccount.com","client_id":"xxx","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token"}
YOLO_MODEL=yolo11n.pt
YOLO_DEVICE=cpu
```

⚠️ IMPORTANT pour FIREBASE_CREDENTIALS_JSON:
- Copiez le CONTENU COMPLET du fichier JSON téléchargé
- Collez-le EN UNE SEULE LIGNE dans Railway
- Pas de sauts de ligne dans la variable

### 4. URL Railway → Vercel
Après déploiement, copiez l'URL Railway (ex: https://vision-guard-ai-xxx.railway.app)
→ Vercel → Settings → Environment Variables:
```
NEXT_PUBLIC_AI_SERVER_URL=https://vision-guard-ai-xxx.railway.app
```

### Résultat
- YOLOv11 nano (6MB) → auto-téléchargé au 1er démarrage
- ByteTrack → actif immédiatement
- /health → {"status":"ok"}
- /detect → détection temps réel

### Pour activer la détection EPI (casque/gilet/uniforme)
Après déploiement de base, uploadez des modèles dans models/:
- models/ppe.pt → Détection EPI précise
- models/shoplifting_wights.pt → Vol (PyResearch)
Ces modèles custom remplacent automatiquement le modèle général.
