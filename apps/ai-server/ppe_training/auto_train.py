"""
Auto-train PPE — s'exécute au démarrage Railway si models/ppe.pt absent
Télécharge le dataset + entraîne + sauvegarde automatiquement
"""
import os, sys, shutil, time
from loguru import logger

ROBOFLOW_API_KEY = os.environ.get("ROBOFLOW_API_KEY", "9H5LTv4r2ToBc0cb0rh5")

DATASETS = [
    # Construction — casque, gilet, personne
    ("roboflow-universe-datasets", "hard-hat-workers-cghgq",        2, "construction"),
    ("roboflow-universe-datasets", "ppe-detection-nf06a",            4, "construction"),
    ("roboflow-universe-datasets", "construction-site-safety-iabkl", 1, "construction"),
    ("roboflow-100",               "construction-safety-gsnvb",      2, "construction"),
    # Industrial — uniforme, gants, lunettes, bottes
    ("roboflow-universe-datasets", "safety-equipment-detection-6cnhb",1, "industrial"),
    ("roboflow-universe-datasets", "workers-ppe-detection",           1, "industrial"),
    ("riotu-lab",                  "ppe-detection-dataset",           1, "industrial"),
]

def download_dataset(workspace, project, version, sector):
    try:
        from roboflow import Roboflow
        rf      = Roboflow(api_key=ROBOFLOW_API_KEY)
        proj    = rf.workspace(workspace).project(project)
        dataset = proj.version(version).download("yolov8", location=f"ppe_datasets/{sector}")
        logger.success(f"✅ Dataset téléchargé: {workspace}/{project} → ppe_datasets/{sector}")
        return dataset.location
    except Exception as e:
        logger.warning(f"❌ {workspace}/{project}: {e}")
        return None

def train_model(data_yaml, model_name):
    if not os.path.exists(data_yaml):
        return None
    try:
        from ultralytics import YOLO
        logger.info(f"🏋️ Entraînement {model_name}...")
        model = YOLO("yolo11n.pt")
        model.train(
            data=data_yaml, epochs=30, imgsz=640,
            batch=16, device="cpu", name=model_name,
            flipud=0.5, fliplr=0.5, degrees=10, mosaic=0.5,
            verbose=False,
        )
        best = f"runs/detect/{model_name}/weights/best.pt"
        dest = f"models/{model_name}.pt"
        os.makedirs("models", exist_ok=True)
        if os.path.exists(best):
            shutil.copy2(best, dest)
            logger.success(f"✅ Poids sauvegardés: {dest}")
            return dest
    except Exception as e:
        logger.error(f"❌ Entraînement {model_name}: {e}")
    return None

def run():
    # Vérifier si déjà entraîné
    if os.path.exists("models/ppe.pt"):
        logger.info("✅ models/ppe.pt déjà présent — skip entraînement")
        return

    logger.info("🚀 Démarrage auto-train PPE...")
    os.makedirs("ppe_datasets", exist_ok=True)
    os.makedirs("models", exist_ok=True)

    trained = {}

    for workspace, project, version, sector in DATASETS:
        if sector in trained:
            continue
        location = download_dataset(workspace, project, version, sector)
        if location:
            yaml = os.path.join(location, "data.yaml")
            result = train_model(yaml, f"ppe_{sector}")
            if result:
                trained[sector] = result
                # Copier aussi comme ppe.pt universel si c'est le premier
                if not os.path.exists("models/ppe.pt"):
                    shutil.copy2(result, "models/ppe.pt")
                    logger.success("✅ models/ppe.pt (universel) créé")

    if trained:
        logger.success(f"✅ Auto-train terminé: {list(trained.values())}")
    else:
        logger.error("❌ Aucun dataset téléchargé — vérifier ROBOFLOW_API_KEY et accès réseau")

if __name__ == "__main__":
    run()
