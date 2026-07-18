"""
Entraîner le modèle shoplifting avec le dataset public Roboflow
Dataset: FYP-Shoplift (même que PyResearch)
Durée: ~30 minutes sur GPU, ~3h sur CPU
"""
from ultralytics import YOLO

# 1. Télécharger le dataset depuis Roboflow
# pip install roboflow
# from roboflow import Roboflow
# rf = Roboflow(api_key="VOTRE_CLE_ROBOFLOW")
# project = rf.workspace("shoplifting-detection").project("fyp-shoplift")
# dataset = project.version(1).download("yolov8")

# 2. Entraîner YOLOv11 sur le dataset shoplifting
model = YOLO("yolo11n.pt")  # partir du modèle de base

results = model.train(
    data="FYP-Shoplift-1/data.yaml",  # chemin vers le dataset téléchargé
    epochs=50,
    imgsz=640,
    batch=16,
    name="shoplifting_v1",
    device="cpu",  # ou "cuda" si GPU disponible
)

# 3. Sauvegarder les poids
model.export(format="pt")
print("✅ Poids sauvegardés dans runs/detect/shoplifting_v1/weights/best.pt")
print("   Copier ce fichier dans models/shoplifting_wights.pt")
