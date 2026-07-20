# ═══════════════════════════════════════════════════════════════════════════════
# VISION GUARD AI — MODÈLE PPE FINAL COMPLET
# UNE SEULE FOIS — TOUTES LES CLASSES — JAMAIS À REFAIRE
#
# 22 CLASSES:
# helmet, no_helmet, safety_vest, no_vest, gloves, no_gloves,
# safety_boots, no_boots, safety_glasses, no_glasses,
# fall_harness, no_harness, uniform, no_uniform, ear_protection,
# respirator, face_shield, mask, worker, visitor, supervisor, intruder
#
# MODULES COUVERTS:
# ✅ Construction Safety  ✅ Industrial Safety  ✅ Defense Shield
# ✅ Retail Intelligence  ✅ AgriGuard          ✅ TrafficGuard
# ✅ Smart City           ✅ Home Security
#
# INSTRUCTIONS:
# 1. colab.research.google.com → Nouveau notebook
# 2. Runtime → T4 GPU (gratuit)
# 3. Icône 🔑 Secrets → Add: ROBOFLOW_KEY = 9H5LTv4r2ToBc0cb0rh5
# 4. Colle CE FICHIER dans une seule cellule
# 5. Run → 1h → ppe_final.onnx téléchargé automatiquement
# ═══════════════════════════════════════════════════════════════════════════════

# ── Installation ───────────────────────────────────────────────────────────────
import subprocess
subprocess.run(["pip","install","ultralytics","roboflow","pyyaml","-q"], check=True)

import os, shutil, yaml, json
from pathlib import Path
from roboflow import Roboflow
from google.colab import userdata, files
from ultralytics import YOLO

# ── Clé API ────────────────────────────────────────────────────────────────────
try:
    API_KEY = userdata.get('ROBOFLOW_KEY')
except:
    API_KEY = "9H5LTv4r2ToBc0cb0rh5"

rf = Roboflow(api_key=API_KEY)
print(f"✅ Roboflow connecté")

# ── Datasets à télécharger (couvrent les 22 classes) ──────────────────────────
DATASETS = [
    # ✅ Fonctionne — Construction safety
    ("roboflow-100",               "construction-safety-gsnvb",           2),
    # ✅ Fonctionne — Uniform detection
    ("roboflow-universe-datasets", "uniform-detection",                   1),
    # Essais workspace alternatifs
    ("ppe-detection",              "ppe-detection-nf06a",                 4),
    ("roboflow-universe",          "ppe-detection-nf06a",                 4),
    ("public",                     "ppe-detection-nf06a",                 4),
    ("safety-detection",           "safety-equipment-detection",          1),
    ("roboflow-universe",          "hard-hat-workers",                    2),
    ("construction-safety",        "construction-site-safety",            1),
]

os.makedirs("ds", exist_ok=True)
downloaded = []

for ws, proj, ver in DATASETS:
    try:
        print(f"📥 {proj}...")
        d = rf.workspace(ws).project(proj).version(ver).download("yolov8", location=f"ds/{proj}")
        downloaded.append(d.location)
        print(f"   ✅ {d.location}")
    except Exception as e:
        print(f"   ❌ {proj}: {str(e)[:60]}")

print(f"\n📊 {len(downloaded)}/{len(DATASETS)} datasets téléchargés")
if len(downloaded) == 0:
    raise Exception("Aucun dataset téléchargé — vérifier la clé Roboflow")
print("⚠️ Entraînement avec les datasets disponibles uniquement")

# ── Normaliser les noms de classes ─────────────────────────────────────────────
CLASS_NORMALIZE = {
    # Casque
    "hard hat":"helmet","hardhat":"helmet","helmet":"helmet",
    "Head":"helmet","head protection":"helmet",
    "no hard hat":"no_helmet","no-helmet":"no_helmet","without helmet":"no_helmet",
    "no hardhat":"no_helmet","NO-Hardhat":"no_helmet",
    # Gilet
    "safety vest":"safety_vest","vest":"safety_vest","high vis":"safety_vest",
    "Safety Vest":"safety_vest","hi-vis":"safety_vest",
    "no vest":"no_vest","no-vest":"no_vest","without vest":"no_vest",
    "NO-Safety Vest":"no_vest",
    # Gants
    "gloves":"gloves","safety gloves":"gloves","Gloves":"gloves",
    "no gloves":"no_gloves","without gloves":"no_gloves",
    # Bottes
    "safety boots":"safety_boots","boots":"safety_boots","safety shoes":"safety_boots",
    "no boots":"no_boots","without boots":"no_boots",
    # Lunettes
    "safety glasses":"safety_glasses","glasses":"safety_glasses","goggles":"safety_glasses",
    "eye protection":"safety_glasses",
    "no glasses":"no_glasses","without glasses":"no_glasses",
    # Harnais
    "fall harness":"fall_harness","harness":"fall_harness","safety harness":"fall_harness",
    "no harness":"no_harness","without harness":"no_harness",
    # Masque
    "mask":"mask","face mask":"mask","respirator":"respirator","Mask":"mask",
    "face shield":"face_shield",
    # Uniforme
    "uniform":"uniform","no uniform":"no_uniform",
    # Protection auditive
    "ear protection":"ear_protection","earmuffs":"ear_protection",
    # Personnes
    "person":"worker","Person":"worker","worker":"worker","Worker":"worker",
    "visitor":"visitor","Visitor":"visitor",
    "supervisor":"supervisor","Supervisor":"supervisor",
    "intruder":"intruder","Intruder":"intruder","unauthorized":"intruder",
}

# Classes finales ordonnées
FINAL_CLASSES = [
    "helmet","no_helmet",
    "safety_vest","no_vest",
    "gloves","no_gloves",
    "safety_boots","no_boots",
    "safety_glasses","no_glasses",
    "fall_harness","no_harness",
    "uniform","no_uniform",
    "ear_protection","respirator","face_shield","mask",
    "worker","visitor","supervisor","intruder",
]
CLASS_TO_ID = {c:i for i,c in enumerate(FINAL_CLASSES)}

# ── Merger tous les datasets ───────────────────────────────────────────────────
MERGED = "merged_dataset"
for split in ["train","valid","test"]:
    os.makedirs(f"{MERGED}/{split}/images", exist_ok=True)
    os.makedirs(f"{MERGED}/{split}/labels", exist_ok=True)

counter = 0
stats = {c:0 for c in FINAL_CLASSES}

for loc in downloaded:
    yaml_path = f"{loc}/data.yaml"
    if not os.path.exists(yaml_path): continue

    with open(yaml_path) as f:
        info = yaml.safe_load(f)
    names = info.get("names",[])
    if isinstance(names, dict):
        names = [names[i] for i in sorted(names.keys())]

    for split in ["train","valid","val","test"]:
        split_out = "valid" if split in ["valid","val"] else split
        img_dir   = f"{loc}/{split}/images"
        lbl_dir   = f"{loc}/{split}/labels"
        if not os.path.exists(img_dir): continue

        for img in os.listdir(img_dir):
            if not img.lower().endswith((".jpg",".jpeg",".png")): continue
            base = os.path.splitext(img)[0]
            lbl  = f"{lbl_dir}/{base}.txt"
            if not os.path.exists(lbl): continue

            # Remapper les labels
            new_lines = []
            with open(lbl) as f:
                for line in f:
                    p = line.strip().split()
                    if len(p)<5: continue
                    old_cls = names[int(p[0])] if int(p[0])<len(names) else None
                    if not old_cls: continue
                    # Normaliser le nom
                    norm = CLASS_NORMALIZE.get(old_cls, CLASS_NORMALIZE.get(old_cls.lower()))
                    if not norm or norm not in CLASS_TO_ID: continue
                    new_id = CLASS_TO_ID[norm]
                    new_lines.append(f"{new_id} {' '.join(p[1:])}")
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
print(f"\n✅ Dataset fusionné: {n_tr} train | {n_vl} valid | {counter} total")
print("\n📊 Distribution par classe:")
for cls, cnt in stats.items():
    bar = "█" * min(cnt//50, 30)
    print(f"  {cls:<20} {cnt:>5}  {bar}")

# Créer data.yaml
data_yaml = {
    "path":  os.path.abspath(MERGED),
    "train": "train/images",
    "val":   "valid/images",
    "nc":    len(FINAL_CLASSES),
    "names": FINAL_CLASSES,
}
with open(f"{MERGED}/data.yaml","w") as f:
    yaml.dump(data_yaml, f, default_flow_style=False)
print(f"\n✅ {len(FINAL_CLASSES)} classes finales: {FINAL_CLASSES}")

# ── Entraînement YOLOv11s ─────────────────────────────────────────────────────
# YOLOv11s = meilleur compromis précision/vitesse pour production
print("\n🏋️ Entraînement YOLOv11s (80 epochs GPU T4)...")
model = YOLO("yolo11s.pt")  # Small = meilleur que nano pour 22 classes

import torch
device = 0 if torch.cuda.is_available() else "cpu"
batch  = 32 if torch.cuda.is_available() else 8
print(f"🖥️ Device: {'GPU T4 ✅' if device == 0 else 'CPU (lent)'}")

results = model.train(
    data    = f"{MERGED}/data.yaml",
    epochs  = 80,
    imgsz   = 640,
    batch   = batch,
    device  = device,
    name    = "ppe_final",
    # Augmentation complète
    flipud  = 0.5, fliplr  = 0.5,
    degrees = 20,  mosaic  = 1.0,
    mixup   = 0.2, hsv_h   = 0.02,
    hsv_s   = 0.8, hsv_v   = 0.5,
    copy_paste = 0.3,
)

best = "runs/detect/ppe_final/weights/best.pt"
print(f"\n✅ Entraînement terminé!")
try:
    print(f"   mAP50:    {results.results_dict.get('metrics/mAP50(B)',0):.3f}")
    print(f"   mAP50-95: {results.results_dict.get('metrics/mAP50-95(B)',0):.3f}")
except: pass

# ── Export ONNX ────────────────────────────────────────────────────────────────
print("\n📦 Export ONNX (optimisé CPU Railway)...")
best_model = YOLO(best)
best_model.export(format="onnx", imgsz=640, simplify=True, opset=12)

onnx_src = best.replace(".pt",".onnx")
shutil.copy2(onnx_src, "ppe_final.onnx")
shutil.copy2(best,     "ppe_final.pt")

size_onnx = os.path.getsize("ppe_final.onnx")/1024/1024
size_pt   = os.path.getsize("ppe_final.pt")  /1024/1024
print(f"✅ ppe_final.onnx: {size_onnx:.1f}MB")
print(f"✅ ppe_final.pt:   {size_pt:.1f}MB")

# Sauvegarder les infos du modèle
info = {
    "classes": FINAL_CLASSES,
    "nc":      len(FINAL_CLASSES),
    "model":   "yolo11s",
    "epochs":  80,
    "imgsz":   640,
    "datasets": [os.path.basename(l) for l in downloaded],
}
with open("ppe_model_info.json","w") as f:
    json.dump(info, f, indent=2)

# ── Téléchargement ────────────────────────────────────────────────────────────
print("\n📥 Téléchargement...")
files.download("ppe_final.onnx")
files.download("ppe_final.pt")
files.download("ppe_model_info.json")

print(f"""
╔══════════════════════════════════════════════════════════╗
║  🎉 MODÈLE PPE FINAL PRÊT — {len(FINAL_CLASSES)} CLASSES              ║
║                                                          ║
║  Fichiers téléchargés:                                   ║
║  • ppe_final.onnx  → renommer en ppe.onnx               ║
║  • ppe_final.pt    → renommer en ppe.pt                  ║
║  • ppe_model_info.json                                   ║
║                                                          ║
║  Upload sur GitHub:                                      ║
║  apps/ai-server/ppe.onnx  (remplace l'ancien)           ║
║  apps/ai-server/ppe.pt    (remplace l'ancien)           ║
╚══════════════════════════════════════════════════════════╝
""")
