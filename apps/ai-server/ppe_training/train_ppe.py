"""
Entraînement YOLOv11 PPE Professional
Selon spec: Construction + Industrial + Warehouse + Mining

Classes: helmet, no_helmet, safety_vest, no_vest, uniform, no_uniform,
         fall_harness, no_harness, safety_boots, no_boots, gloves, no_gloves,
         safety_glasses, no_glasses, ear_protection, respirator, face_shield,
         worker, visitor, contractor, supervisor, intruder
"""
import os, yaml
from ultralytics import YOLO

# ── Config entraînement ────────────────────────────────────────────────────────
TRAINING_CONFIGS = {
    "ppe_construction": {
        "data":    "ppe_dataset/construction/data.yaml",
        "epochs":  150,
        "imgsz":   1280,
        "batch":   16,
        "name":    "ppe_construction_v1",
        "desc":    "Chantiers — casque, gilet, harnais, bottes",
    },
    "ppe_industry": {
        "data":    "ppe_dataset/industrial/data.yaml",
        "epochs":  150,
        "imgsz":   1280,
        "batch":   16,
        "name":    "ppe_industry_v1",
        "desc":    "Usines — uniforme, lunettes, gants, bottes",
    },
}

def train_model(config_name: str, device: str = "cpu"):
    """Entraîne un modèle PPE spécialisé"""
    cfg = TRAINING_CONFIGS[config_name]
    
    print(f"\n🏋️ Entraînement {config_name}")
    print(f"   {cfg['desc']}")
    print(f"   Epochs: {cfg['epochs']} | ImgSize: {cfg['imgsz']} | Device: {device}")
    
    # Partir du modèle YOLOv11x (le plus précis) si GPU, nano si CPU
    base_model = "yolo11x.pt" if device != "cpu" else "yolo11n.pt"
    model      = YOLO(base_model)
    
    results = model.train(
        data    = cfg["data"],
        epochs  = cfg["epochs"],
        imgsz   = cfg["imgsz"],
        batch   = cfg["batch"],
        device  = device,
        name    = cfg["name"],
        # Augmentation selon spec ChatGPT
        flipud  = 0.5,
        fliplr  = 0.5,
        degrees = 15,
        blur    = 0.01,
        hsv_h   = 0.015,
        hsv_s   = 0.7,
        hsv_v   = 0.4,
        mosaic  = 1.0,
        mixup   = 0.15,
    )
    
    # Copier les meilleurs poids dans models/
    best_weights = f"runs/detect/{cfg['name']}/weights/best.pt"
    dest         = f"models/{config_name}.pt"
    os.makedirs("models", exist_ok=True)
    
    if os.path.exists(best_weights):
        import shutil
        shutil.copy2(best_weights, dest)
        print(f"✅ Poids sauvegardés: {dest}")
        
        # Exporter en ONNX aussi
        model_best = YOLO(best_weights)
        model_best.export(format="onnx", imgsz=cfg["imgsz"])
        onnx_src  = best_weights.replace(".pt", ".onnx")
        onnx_dest = dest.replace(".pt", ".onnx")
        if os.path.exists(onnx_src):
            shutil.copy2(onnx_src, onnx_dest)
            print(f"✅ ONNX exporté: {onnx_dest}")
    
    return results


def train_all(device: str = "cpu"):
    """Entraîne tous les modèles PPE"""
    print("🚀 Entraînement PPE Bundle complet")
    print(f"   Device: {device}")
    
    for config_name in TRAINING_CONFIGS:
        if not os.path.exists(TRAINING_CONFIGS[config_name]["data"]):
            print(f"⚠️ Dataset manquant pour {config_name} — exécutez download_dataset.py d'abord")
            continue
        train_model(config_name, device)
    
    print("\n✅ Tous les modèles entraînés!")
    print("   → models/ppe_construction.pt")
    print("   → models/ppe_industry.pt")
    print("   → Uploader ces fichiers dans apps/ai-server/models/ sur Railway")


if __name__ == "__main__":
    import sys
    device = sys.argv[1] if len(sys.argv) > 1 else "cpu"
    
    # Vérification GPU
    try:
        import torch
        if torch.cuda.is_available():
            device = "0"
            print(f"🎮 GPU détecté: {torch.cuda.get_device_name(0)}")
        else:
            print("💻 CPU uniquement (entraînement lent ~3h par modèle)")
    except: pass
    
    train_all(device)
