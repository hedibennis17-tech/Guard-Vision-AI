# ═══════════════════════════════════════════════════════════════════════════════
# Vision Guard AI — PPE Training v2 — Multi-classes
# Google Colab — GPU T4 Gratuit — ~45 minutes
#
# Classes entraînées:
#   helmet, no-helmet, vest, no-vest, gloves, no-gloves,
#   boots, no-boots, glasses, no-glasses, harness, no-harness,
#   mask, person, worker, visitor, supervisor, intruder
#
# INSTRUCTIONS:
# 1. colab.research.google.com → Nouveau notebook
# 2. Runtime → Changer le type → T4 GPU
# 3. Copie tout ce code dans une cellule
# 4. Run (Ctrl+Enter) → attends ~45 min
# 5. ppe_v2.onnx se télécharge automatiquement
# ═══════════════════════════════════════════════════════════════════════════════

# ── Étape 1: Installation ──────────────────────────────────────────────────────
import subprocess
subprocess.run(["pip", "install", "ultralytics", "roboflow", "-q"], check=True)
print("✅ Packages installés")

# ── Étape 2: Téléchargement des datasets ──────────────────────────────────────
import os, shutil, yaml
from roboflow import Roboflow

API_KEY = "9H5LTv4r2ToBc0cb0rh5"
rf = Roboflow(api_key=API_KEY)

os.makedirs("datasets", exist_ok=True)

# Datasets PPE publics (du plus complet au moins complet)
DATASETS = [
    # Dataset 1 — PPE complet: helmet, vest, gloves, boots, glasses, mask
    {"ws":"roboflow-universe-datasets", "proj":"ppe-detection-nf06a",           "ver":4, "name":"ppe_full"},
    # Dataset 2 — Construction: helmet, no-helmet, vest, no-vest, person
    {"ws":"roboflow-100",               "proj":"construction-safety-gsnvb",       "ver":2, "name":"construction"},
    # Dataset 3 — Safety equipment: gloves, boots, glasses, harness
    {"ws":"roboflow-universe-datasets", "proj":"safety-equipment-detection-6cnhb","ver":1, "name":"safety_equip"},
    # Dataset 4 — Workers: worker, visitor, supervisor
    {"ws":"roboflow-universe-datasets", "proj":"workers-ppe-detection",           "ver":1, "name":"workers"},
    # Dataset 5 — Hard hat workers
    {"ws":"roboflow-universe-datasets", "proj":"hard-hat-workers-cghgq",          "ver":2, "name":"hardhat"},
    # Dataset 6 — Industrial safety
    {"ws":"roboflow-universe-datasets", "proj":"construction-site-safety-iabkl",  "ver":1, "name":"industrial"},
]

downloaded = []
for ds in DATASETS:
    try:
        print(f"📥 {ds['proj']}...")
        proj    = rf.workspace(ds["ws"]).project(ds["proj"])
        dataset = proj.version(ds["ver"]).download("yolov8", location=f"datasets/{ds['name']}")
        downloaded.append(dataset.location)
        print(f"✅ {ds['name']}: {dataset.location}")
    except Exception as e:
        print(f"❌ {ds['proj']}: {e}")

print(f"\n📊 {len(downloaded)}/{len(DATASETS)} datasets téléchargés: {downloaded}")

# ── Étape 3: Merger les datasets ───────────────────────────────────────────────
print("\n🔀 Fusion des datasets...")

all_classes = set()
merged_dir  = "datasets/merged"
os.makedirs(f"{merged_dir}/train/images", exist_ok=True)
os.makedirs(f"{merged_dir}/train/labels", exist_ok=True)
os.makedirs(f"{merged_dir}/valid/images", exist_ok=True)
os.makedirs(f"{merged_dir}/valid/labels", exist_ok=True)

# Collecter toutes les classes
class_to_id = {}
datasets_info = []

for loc in downloaded:
    yaml_path = os.path.join(loc, "data.yaml")
    if not os.path.exists(yaml_path):
        continue
    with open(yaml_path) as f:
        info = yaml.safe_load(f)
    names = info.get("names", [])
    if isinstance(names, dict):
        names = [names[i] for i in sorted(names.keys())]
    datasets_info.append({"loc":loc, "names":names})
    for n in names:
        if n not in class_to_id:
            class_to_id[n] = len(class_to_id)

print(f"✅ {len(class_to_id)} classes uniques: {list(class_to_id.keys())}")

# Copier les images + remapper les labels
file_counter = 0
for ds_info in datasets_info:
    loc      = ds_info["loc"]
    ds_names = ds_info["names"]
    
    for split in ["train", "valid", "val"]:
        split_out = "valid" if split in ["valid","val"] else "train"
        img_dir   = os.path.join(loc, split, "images")
        lbl_dir   = os.path.join(loc, split, "labels")
        
        if not os.path.exists(img_dir):
            continue
            
        for img_file in os.listdir(img_dir):
            if not img_file.lower().endswith((".jpg",".jpeg",".png")):
                continue
            
            base     = os.path.splitext(img_file)[0]
            lbl_file = f"{base}.txt"
            lbl_src  = os.path.join(lbl_dir, lbl_file)
            
            if not os.path.exists(lbl_src):
                continue
            
            # Lire et remapper les labels
            new_lines = []
            with open(lbl_src) as f:
                for line in f:
                    parts = line.strip().split()
                    if len(parts) < 5: continue
                    old_id = int(parts[0])
                    if old_id < len(ds_names):
                        cls_name = ds_names[old_id]
                        new_id   = class_to_id[cls_name]
                        new_lines.append(f"{new_id} " + " ".join(parts[1:]))
            
            if not new_lines:
                continue
            
            # Copier image
            new_name = f"img_{file_counter:06d}{os.path.splitext(img_file)[1]}"
            shutil.copy2(
                os.path.join(img_dir, img_file),
                f"{merged_dir}/{split_out}/images/{new_name}"
            )
            # Écrire labels remappés
            with open(f"{merged_dir}/{split_out}/labels/{os.path.splitext(new_name)[0]}.txt", "w") as f:
                f.write("\n".join(new_lines))
            
            file_counter += 1

n_train = len(os.listdir(f"{merged_dir}/train/images"))
n_valid = len(os.listdir(f"{merged_dir}/valid/images"))
print(f"✅ Dataset fusionné: {n_train} train | {n_valid} valid")

# Écrire data.yaml
names_list = [k for k,v in sorted(class_to_id.items(), key=lambda x:x[1])]
data_yaml  = {
    "path":  os.path.abspath(merged_dir),
    "train": "train/images",
    "val":   "valid/images",
    "nc":    len(names_list),
    "names": names_list,
}
with open(f"{merged_dir}/data.yaml", "w") as f:
    yaml.dump(data_yaml, f, default_flow_style=False)

print(f"✅ data.yaml: {len(names_list)} classes")
print(f"   Classes: {names_list}")

# ── Étape 4: Entraînement ──────────────────────────────────────────────────────
print("\n🏋️ Entraînement YOLOv11n sur GPU T4...")
from ultralytics import YOLO

model = YOLO("yolo11n.pt")
results = model.train(
    data    = f"{merged_dir}/data.yaml",
    epochs  = 80,
    imgsz   = 640,
    batch   = 32,
    device  = 0,
    name    = "ppe_v2_multiclass",
    # Augmentation
    flipud  = 0.5,
    fliplr  = 0.5,
    degrees = 15,
    mosaic  = 1.0,
    mixup   = 0.15,
    hsv_h   = 0.015,
    hsv_s   = 0.7,
    hsv_v   = 0.4,
)

best = "runs/detect/ppe_v2_multiclass/weights/best.pt"
print(f"\n✅ Entraînement terminé!")
print(f"   mAP50: {results.results_dict.get('metrics/mAP50(B)',0):.3f}")
print(f"   mAP50-95: {results.results_dict.get('metrics/mAP50-95(B)',0):.3f}")

# ── Étape 5: Export ONNX ──────────────────────────────────────────────────────
print("\n📦 Export ONNX...")
model_best = YOLO(best)
model_best.export(format="onnx", imgsz=640, simplify=True)

onnx_src  = best.replace(".pt", ".onnx")
shutil.copy2(onnx_src,  "ppe_v2.onnx")
shutil.copy2(best,      "ppe_v2.pt")

print(f"✅ ppe_v2.onnx: {os.path.getsize('ppe_v2.onnx')/1024/1024:.1f}MB")
print(f"✅ ppe_v2.pt:   {os.path.getsize('ppe_v2.pt')/1024/1024:.1f}MB")
print(f"\n📋 Classes finales ({len(names_list)}): {names_list}")

# ── Étape 6: Téléchargement ────────────────────────────────────────────────────
from google.colab import files
files.download("ppe_v2.onnx")
files.download("ppe_v2.pt")
print("\n🎉 Terminé! Upload ppe_v2.onnx sur GitHub → apps/ai-server/ppe.onnx")
