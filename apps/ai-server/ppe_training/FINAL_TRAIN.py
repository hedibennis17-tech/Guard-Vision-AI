# ═══════════════════════════════════════════════════════════════════════════════
# VISION GUARD AI — FINAL PPE TRAINING — UNE SEULE FOIS POUR TOUJOURS
# Classes: helmet, no_helmet, vest, no_vest, gloves, boots, glasses, harness, person
# GPU T4 Gratuit — ~1 heure
# ═══════════════════════════════════════════════════════════════════════════════

!pip install ultralytics roboflow pyyaml -q

import os, shutil, yaml
from roboflow import Roboflow
from google.colab import userdata, files
from ultralytics import YOLO
import torch

# ── Clé API ───────────────────────────────────────────────────────────────────
try:
    API_KEY = userdata.get('ROBOFLOW_KEY')
except:
    API_KEY = "9H5LTv4r2ToBc0cb0rh5"

rf = Roboflow(api_key=API_KEY)
os.makedirs("ds", exist_ok=True)

# ── Datasets TESTÉS ET FONCTIONNELS ───────────────────────────────────────────
# Seulement ceux qui ont fonctionné dans nos tests précédents
DATASETS = [
    # ✅ Dataset 1 — helmet/no-helmet/vest/no-vest/person (997 images)
    ("roboflow-100", "construction-safety-gsnvb", 2),
    # ✅ Dataset 2 — uniform detection
    ("roboflow-universe-datasets", "uniform-detection", 1),
]

# Datasets supplémentaires à essayer
EXTRA_DATASETS = [
    ("roboflow-universe-datasets", "ppe-detection-nf06a", 4),
    ("roboflow-universe-datasets", "hard-hat-workers-cghgq", 2),
    ("roboflow-universe-datasets", "safety-glasses-detection", 1),
    ("roboflow-universe-datasets", "gloves-detection", 1),
    ("roboflow-universe-datasets", "safety-boots-detection", 1),
    ("roboflow-universe-datasets", "construction-ppe", 3),
]

downloaded = []

# Télécharger les datasets garantis
for ws, proj, ver in DATASETS:
    try:
        print(f"📥 {proj}...")
        d = rf.workspace(ws).project(proj).version(ver).download("yolov8", location=f"ds/{proj}")
        downloaded.append(d.location)
        print(f"   ✅ {d.location}")
    except Exception as e:
        print(f"   ❌ {proj}: {str(e)[:50]}")

# Essayer les datasets supplémentaires
for ws, proj, ver in EXTRA_DATASETS:
    try:
        print(f"📥 {proj}...")
        d = rf.workspace(ws).project(proj).version(ver).download("yolov8", location=f"ds/{proj}")
        downloaded.append(d.location)
        print(f"   ✅ {d.location}")
    except Exception as e:
        print(f"   ⚠️ {proj}: non disponible")

print(f"\n📊 {len(downloaded)} datasets téléchargés")

# ── Normalisation des classes ──────────────────────────────────────────────────
NORMALIZE = {
    # Casque
    "helmet":"helmet", "hard hat":"helmet", "hardhat":"helmet",
    "Head":"helmet", "no hard hat":"no_helmet", "no-helmet":"no_helmet",
    "NO-Hardhat":"no_helmet", "without helmet":"no_helmet",
    # Gilet
    "safety vest":"vest", "vest":"vest", "Safety Vest":"vest",
    "no vest":"no_vest", "no-vest":"no_vest", "NO-Safety Vest":"no_vest",
    # Gants
    "gloves":"gloves", "Gloves":"gloves", "safety gloves":"gloves",
    "no gloves":"no_gloves",
    # Bottes
    "boots":"boots", "safety boots":"boots", "safety shoes":"boots",
    "no boots":"no_boots",
    # Lunettes
    "glasses":"glasses", "safety glasses":"glasses", "goggles":"glasses",
    "no glasses":"no_glasses",
    # Harnais
    "harness":"harness", "fall harness":"harness",
    "no harness":"no_harness",
    # Uniforme
    "uniform":"uniform", "no uniform":"no_uniform",
    # Masque
    "mask":"mask", "face mask":"mask",
    # Personne
    "person":"person", "Person":"person", "worker":"person",
    "Worker":"person", "human":"person",
}

FINAL_CLASSES = [
    "helmet", "no_helmet",
    "vest", "no_vest",
    "gloves", "no_gloves",
    "boots", "no_boots",
    "glasses", "no_glasses",
    "harness", "no_harness",
    "uniform", "no_uniform",
    "mask", "person",
]
CLS2ID = {c:i for i,c in enumerate(FINAL_CLASSES)}

# ── Merger ────────────────────────────────────────────────────────────────────
MERGED = "merged"
for s in ["train","valid"]:
    os.makedirs(f"{MERGED}/{s}/images", exist_ok=True)
    os.makedirs(f"{MERGED}/{s}/labels", exist_ok=True)

counter = 0
stats = {c:0 for c in FINAL_CLASSES}

for loc in downloaded:
    yaml_path = f"{loc}/data.yaml"
    if not os.path.exists(yaml_path): continue
    with open(yaml_path) as f:
        info = yaml.safe_load(f)
    names = info.get("names", [])
    if isinstance(names, dict):
        names = [names[i] for i in sorted(names.keys())]

    for split in ["train", "valid", "val"]:
        split_out = "valid" if split in ["valid","val"] else "train"
        img_dir = f"{loc}/{split}/images"
        lbl_dir = f"{loc}/{split}/labels"
        if not os.path.exists(img_dir): continue

        for img in os.listdir(img_dir):
            if not img.lower().endswith((".jpg",".jpeg",".png")): continue
            base = os.path.splitext(img)[0]
            lbl  = f"{lbl_dir}/{base}.txt"
            if not os.path.exists(lbl): continue

            new_lines = []
            with open(lbl) as f:
                for line in f:
                    p = line.strip().split()
                    if len(p) < 5: continue
                    old_cls = names[int(p[0])] if int(p[0]) < len(names) else None
                    if not old_cls: continue
                    norm = NORMALIZE.get(old_cls, NORMALIZE.get(old_cls.lower()))
                    if not norm or norm not in CLS2ID: continue
                    new_lines.append(f"{CLS2ID[norm]} {' '.join(p[1:])}")
                    stats[norm] += 1

            if not new_lines: continue
            ext  = os.path.splitext(img)[1]
            name = f"vg_{counter:07d}{ext}"
            shutil.copy2(f"{img_dir}/{img}", f"{MERGED}/{split_out}/images/{name}")
            with open(f"{MERGED}/{split_out}/labels/{os.path.splitext(name)[0]}.txt","w") as f:
                f.write("\n".join(new_lines))
            counter += 1

n_tr = len(os.listdir(f"{MERGED}/train/images"))
n_vl = len(os.listdir(f"{MERGED}/valid/images"))
print(f"\n✅ {n_tr} train | {n_vl} valid | {counter} total")
print("\nDistribution:")
for cls, cnt in stats.items():
    if cnt > 0:
        print(f"  {cls:<20} {cnt:>5}")

# data.yaml
with open(f"{MERGED}/data.yaml","w") as f:
    yaml.dump({
        "path":  os.path.abspath(MERGED),
        "train": "train/images",
        "val":   "valid/images",
        "nc":    len(FINAL_CLASSES),
        "names": FINAL_CLASSES,
    }, f, default_flow_style=False)

# ── Entraînement ──────────────────────────────────────────────────────────────
device = 0 if torch.cuda.is_available() else "cpu"
batch  = 32 if torch.cuda.is_available() else 8
print(f"\n🏋️ YOLOv11s — {device} — {batch} batch")

model = YOLO("yolo11s.pt")
model.train(
    data    = f"{MERGED}/data.yaml",
    epochs  = 100,
    imgsz   = 640,
    batch   = batch,
    device  = device,
    name    = "ppe_final",
    flipud=0.5, fliplr=0.5, degrees=15, mosaic=1.0, mixup=0.2,
)

# ── Export ONNX ───────────────────────────────────────────────────────────────
best = "runs/detect/ppe_final/weights/best.pt"
YOLO(best).export(format="onnx", imgsz=640, simplify=True, opset=12)

onnx = best.replace(".pt",".onnx")
shutil.copy2(onnx, "ppe_final.onnx")
shutil.copy2(best, "ppe_final.pt")

print(f"\n✅ ppe_final.onnx: {os.path.getsize('ppe_final.onnx')/1024/1024:.1f}MB")

# ── Sauvegarder dans Drive ────────────────────────────────────────────────────
from google.colab import drive
drive.mount('/content/drive', force_remount=True)
shutil.copy2("ppe_final.onnx", "/content/drive/MyDrive/ppe_final.onnx")
shutil.copy2("ppe_final.pt",   "/content/drive/MyDrive/ppe_final.pt")
print("✅ Sauvegardé dans Google Drive")
files.download("ppe_final.onnx")
files.download("ppe_final.pt")

print(f"""
╔══════════════════════════════════════╗
║  🎉 TERMINÉ — {len(FINAL_CLASSES)} classes détectées  ║
║                                      ║
║  Upload sur GitHub:                  ║
║  apps/ai-server/ppe.onnx             ║
║  apps/ai-server/ppe.pt               ║
╚══════════════════════════════════════╝
""")
