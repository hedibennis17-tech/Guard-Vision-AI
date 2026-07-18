# PPE Professional Training — Vision Guard AI

## Étapes pour entraîner les modèles PPE

### 1. Clé API Roboflow (gratuite)
1. Créer un compte sur https://app.roboflow.com
2. Settings → API Keys → copier la clé

### 2. Télécharger les datasets
```bash
cd apps/ai-server
python ppe_training/download_dataset.py VOTRE_CLE_ROBOFLOW
```

### 3. Entraîner les modèles
```bash
# Sur CPU (lent mais fonctionne)
python ppe_training/train_ppe.py cpu

# Sur GPU (recommandé)
python ppe_training/train_ppe.py cuda
```

### 4. Les poids seront dans models/
```
models/ppe_construction.pt  → Construction Safety
models/ppe_industry.pt      → Industrial Safety
models/ppe.pt               → Universel (fallback)
```

### 5. Uploader sur Railway
Les fichiers .pt sont détectés automatiquement au démarrage.
Placer dans le volume Railway ou passer par les variables d'environnement.

## Modèles à entraîner (selon spec)
- ppe_construction.pt → chantiers
- ppe_industry.pt     → usines
- ppe_warehouse.pt    → entrepôts
- ppe_mining.pt       → mines
- ppe_refinery.pt     → raffineries
- ppe_energy.pt       → centrales
- ppe_food.pt         → agroalimentaire
- ppe_hospital.pt     → hôpitaux
- ppe_laboratory.pt   → laboratoires

## Classes détectées (22 classes)
helmet, no_helmet, safety_vest, no_vest, uniform, no_uniform,
fall_harness, no_harness, safety_boots, no_boots, gloves, no_gloves,
safety_glasses, no_glasses, ear_protection, respirator, face_shield,
worker, visitor, contractor, supervisor, intruder
