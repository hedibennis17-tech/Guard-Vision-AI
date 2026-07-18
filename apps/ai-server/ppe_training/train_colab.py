# ═══════════════════════════════════════════════════════════════════════════════
# Vision Guard AI — Entraînement PPE sur Google Colab
# ═══════════════════════════════════════════════════════════════════════════════
# INSTRUCTIONS:
# 1. Ouvre Google Colab: https://colab.research.google.com
# 2. New Notebook → colle ce code
# 3. Runtime → Change runtime type → GPU (T4 gratuit)
# 4. Run All (Ctrl+F9)
# 5. Télécharge ppe_construction.pt et ppe_industry.pt
# 6. Upload ces fichiers dans Railway → models/
# ═══════════════════════════════════════════════════════════════════════════════

# ── Étape 1: Installation ──────────────────────────────────────────────────────
# !pip install ultralytics roboflow -q

# ── Étape 2: Download dataset PPE ─────────────────────────────────────────────
ROBOFLOW_API_KEY = "9H5LTv4r2ToBc0cb0rh5"  # Ta clé API

from roboflow import Roboflow
rf = Roboflow(api_key=ROBOFLOW_API_KEY)

print("📥 Téléchargement datasets PPE...")

# Dataset 1 — Construction Safety (casque, gilet, personne)
try:
    proj1    = rf.workspace("roboflow-universe-datasets").project("hard-hat-workers-cghgq")
    dataset1 = proj1.version(2).download("yolov8", location="datasets/construction")
    print(f"✅ Construction: {dataset1.location}")
except Exception as e:
    print(f"❌ Construction dataset 1: {e}")
    try:
        proj1    = rf.workspace("roboflow-universe-datasets").project("ppe-detection-nf06a")
        dataset1 = proj1.version(4).download("yolov8", location="datasets/construction")
        print(f"✅ Construction alt: {dataset1.location}")
    except Exception as e2:
        print(f"❌ Tous les datasets construction: {e2}")

# Dataset 2 — Industrial PPE (uniforme, gants, lunettes, bottes)
try:
    proj2    = rf.workspace("roboflow-universe-datasets").project("safety-equipment-detection-6cnhb")
    dataset2 = proj2.version(1).download("yolov8", location="datasets/industrial")
    print(f"✅ Industrial: {dataset2.location}")
except Exception as e:
    print(f"❌ Industrial dataset: {e}")
    try:
        proj2    = rf.workspace("roboflow-universe-datasets").project("workers-ppe-detection")
        dataset2 = proj2.version(1).download("yolov8", location="datasets/industrial")
        print(f"✅ Industrial alt: {dataset2.location}")
    except Exception as e2:
        print(f"❌ Tous les datasets industrial: {e2}")

# ── Étape 3: Entraînement ──────────────────────────────────────────────────────
from ultralytics import YOLO
import os, shutil

def train(data_yaml, model_name, epochs=50):
    if not os.path.exists(data_yaml):
        print(f"⚠️ Dataset non trouvé: {data_yaml}")
        return None

    print(f"\n🏋️ Entraînement {model_name} ({epochs} epochs)...")
    model   = YOLO("yolo11n.pt")  # nano = rapide sur Colab T4
    results = model.train(
        data    = data_yaml,
        epochs  = epochs,
        imgsz   = 640,
        batch   = 32,
        device  = 0,        # GPU Colab
        name    = model_name,
        # Augmentation spec ChatGPT
        flipud  = 0.5,
        fliplr  = 0.5,
        degrees = 15,
        mosaic  = 1.0,
        mixup   = 0.1,
    )
    best = f"runs/detect/{model_name}/weights/best.pt"
    if os.path.exists(best):
        dest = f"{model_name}.pt"
        shutil.copy2(best, dest)
        print(f"✅ Poids sauvegardés: {dest}")
        return dest
    return None

# Entraîner Construction
construction_yaml = "datasets/construction/data.yaml"
train(construction_yaml, "ppe_construction", epochs=50)

# Entraîner Industrial
industrial_yaml = "datasets/industrial/data.yaml"
train(industrial_yaml, "ppe_industry", epochs=50)

# ── Étape 4: Télécharger les poids ────────────────────────────────────────────
from google.colab import files
import os

for f in ["ppe_construction.pt", "ppe_industry.pt"]:
    if os.path.exists(f):
        files.download(f)
        print(f"📥 Téléchargement: {f}")
    else:
        print(f"⚠️ Fichier non trouvé: {f}")

print("\n✅ TERMINÉ!")
print("Prochaine étape: uploader ces .pt dans Railway → apps/ai-server/models/")
