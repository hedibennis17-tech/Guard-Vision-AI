# ═══════════════════════════════════════════════════════════════════════════════
# VISION GUARD AI — PPE TRAINING FINAL — 16 CLASSES COMPLÈTES
# UNE SEULE FOIS POUR TOUJOURS
#
# Classes: helmet/no_helmet, vest/no_vest, gloves/no_gloves, boots/no_boots,
#          glasses/no_glasses, harness/no_harness, uniform/no_uniform,
#          mask, person
#
# INSTRUCTIONS:
# 1. colab.research.google.com → Nouveau notebook → Runtime → T4 GPU
# 2. Secrets (🔑): ROBOFLOW_KEY = 9H5LTv4r2ToBc0cb0rh5
# 3. Colle ce script dans une cellule → Run
# 4. ~1h → ppe_final.pt + ppe_final.onnx téléchargés automatiquement
# ═══════════════════════════════════════════════════════════════════════════════

import subprocess, os, shutil, json, time
subprocess.run(["pip","install","ultralytics","roboflow","pyyaml","-q"], check=True)

import yaml, torch
from ultralytics import YOLO
from google.colab import files

try:
    from google.colab import userdata
    API_KEY = userdata.get('ROBOFLOW_KEY')
except:
    API_KEY = "9H5LTv4r2ToBc0cb0rh5"

print(f"🔑 Roboflow: {API_KEY[:8]}...")

# ── Classes finales ────────────────────────────────────────────────────────────
FINAL_CLASSES = [
    "helmet","no_helmet","vest","no_vest","gloves","no_gloves",
    "boots","no_boots","glasses","no_glasses","harness","no_harness",
    "uniform","no_uniform","mask","person"
]
CLASS_TO_ID = {c:i for i,c in enumerate(FINAL_CLASSES)}
print(f"✅ {len(FINAL_CLASSES)} classes: {FINAL_CLASSES}")

# ── Normalisation des noms de classes ─────────────────────────────────────────
NORMALIZE = {
    # Casque
    "hard hat":"helmet","hardhat":"helmet","helmet":"helmet",
    "Head":"helmet","head protection":"helmet","safety helmet":"helmet",
    "no hard hat":"no_helmet","no-helmet":"no_helmet","no_helmet":"no_helmet",
    "without helmet":"no_helmet","NO-Hardhat":"no_helmet","no hardhat":"no_helmet",
    # Gilet
    "safety vest":"vest","vest":"vest","high vis":"vest","hi-vis":"vest",
    "safety_vest":"vest","Safety Vest":"vest",
    "no vest":"no_vest","no-vest":"no_vest","no_vest":"no_vest",
    "without vest":"no_vest","NO-Safety Vest":"no_vest",
    # Gants
    "gloves":"gloves","safety gloves":"gloves","Gloves":"gloves",
    "no gloves":"no_gloves","without gloves":"no_gloves","no-gloves":"no_gloves",
    # Bottes
    "safety boots":"boots","boots":"boots","safety shoes":"boots",
    "safety footwear":"boots","shoes":"boots",
    "no boots":"no_boots","without boots":"no_boots","no-boots":"no_boots",
    # Lunettes
    "safety glasses":"glasses","glasses":"glasses","goggles":"glasses",
    "eye protection":"glasses","safety goggles":"glasses",
    "no glasses":"no_glasses","without glasses":"no_glasses",
    # Harnais
    "harness":"harness","fall harness":"harness","safety harness":"harness",
    "no harness":"no_harness","without harness":"no_harness",
    # Uniforme
    "uniform":"uniform","no uniform":"no_uniform","no-uniform":"no_uniform",
    # Masque
    "mask":"mask","face mask":"mask","respirator":"mask","Mask":"mask",
    "face shield":"mask",
    # Personnes
    "person":"person","Person":"person","worker":"person","Worker":"person",
    "human":"person",
}

def normalize(name):
    if not name: return None
    n = str(name).strip()
    return NORMALIZE.get(n) or NORMALIZE.get(n.lower()) or None

# ── Télécharger datasets via SDK Roboflow ────────────────────────────────────
from roboflow import Roboflow
rf = Roboflow(api_key=API_KEY)

DATASETS = [
    # ✅ CONFIRMÉS fonctionnels depuis les sessions précédentes
    {"ws":"roboflow-100",               "proj":"construction-safety-gsnvb",  "ver":2},
    {"ws":"roboflow-universe-datasets", "proj":"uniform-detection",          "ver":1},
    # Nouveaux à essayer
    {"ws":"roboflow-universe-datasets", "proj":"ppe-1-lkyjj",               "ver":1},
    {"ws":"roboflow-universe-datasets", "proj":"ppe-bpvll",                 "ver":3},
    {"ws":"roboflow-universe-datasets", "proj":"construction-ppe-detection", "ver":1},
    {"ws":"roboflow-universe-datasets", "proj":"safety-gear-detection",     "ver":1},
    {"ws":"roboflow-universe-datasets", "proj":"ppe-equipment-detection",   "ver":1},
    {"ws":"roboflow-universe-datasets", "proj":"personal-protective-equipment-detection", "ver":1},
]

os.makedirs("ds", exist_ok=True)
downloaded = []

for ds in DATASETS:
    try:
        print(f"📥 {ds['proj']}...")
        d = rf.workspace(ds["ws"]).project(ds["proj"]).version(ds["ver"]).download("yolov8", location=f"ds/{ds['proj']}")
        downloaded.append(d.location)
        print(f"   ✅ {d.location}")
    except Exception as e:
        print(f"   ❌ {str(e)[:60]}")

print(f"\n📊 {len(downloaded)}/{len(DATASETS)} datasets téléchargés")
if not downloaded:
    raise Exception("Aucun dataset. Vérifie la clé Roboflow.")

# ── Merger et normaliser ──────────────────────────────────────────────────────
MERGED = "merged"
for split in ["train","valid","test"]:
    os.makedirs(f"{MERGED}/{split}/images", exist_ok=True)
    os.makedirs(f"{MERGED}/{split}/labels", exist_ok=True)

counter = 0
stats = {c:0 for c in FINAL_CLASSES}

for loc in downloaded:
    yp = f"{loc}/data.yaml"
    if not os.path.exists(yp): continue
    with open(yp) as f: info = yaml.safe_load(f)
    names = info.get("names",[])
    if isinstance(names, dict): names = [names[i] for i in sorted(names.keys())]

    for split in ["train","valid","val","test"]:
        out = "valid" if split in ["valid","val"] else split
        img_dir = f"{loc}/{split}/images"
        lbl_dir = f"{loc}/{split}/labels"
        if not os.path.exists(img_dir): continue

        for img_file in os.listdir(img_dir):
            if not img_file.lower().endswith((".jpg",".jpeg",".png")): continue
            base = os.path.splitext(img_file)[0]
            lbl_path = f"{lbl_dir}/{base}.txt"
            if not os.path.exists(lbl_path): continue

            new_lines = []
            with open(lbl_path) as f:
                for line in f:
                    p = line.strip().split()
                    if len(p) < 5: continue
                    old_id = int(p[0])
                    if old_id >= len(names): continue
                    norm = normalize(names[old_id])
                    if not norm: continue
                    new_id = CLASS_TO_ID[norm]
                    new_lines.append(f"{new_id} {' '.join(p[1:])}")
                    stats[norm] += 1

            if not new_lines: continue
            ext  = os.path.splitext(img_file)[1]
            name = f"vg_{counter:07d}{ext}"
            shutil.copy2(f"{img_dir}/{img_file}", f"{MERGED}/{out}/images/{name}")
            with open(f"{MERGED}/{out}/labels/{os.path.splitext(name)[0]}.txt","w") as f:
                f.write("\n".join(new_lines))
            counter += 1

n_tr = len(os.listdir(f"{MERGED}/train/images"))
n_vl = len(os.listdir(f"{MERGED}/valid/images"))
print(f"\n✅ {counter} images fusionnées: {n_tr} train | {n_vl} valid")
print("📊 Distribution:")
for cls,cnt in stats.items():
    if cnt > 0: print(f"  {cls:<20} {cnt:>5}  {'█'*min(cnt//30,30)}")

# data.yaml
data_yaml = {"path":os.path.abspath(MERGED),"train":"train/images","val":"valid/images","nc":len(FINAL_CLASSES),"names":FINAL_CLASSES}
with open(f"{MERGED}/data.yaml","w") as f: yaml.dump(data_yaml,f,default_flow_style=False)

# ── Entraînement ──────────────────────────────────────────────────────────────
device = 0 if torch.cuda.is_available() else "cpu"
batch  = 32 if torch.cuda.is_available() else 8
print(f"\n🏋️ YOLOv11s | device={'GPU T4 ✅' if device==0 else 'CPU ⚠️'} | batch={batch} | 80 epochs")

model = YOLO("yolo11s.pt")
results = model.train(
    data    = f"{MERGED}/data.yaml",
    epochs  = 80,
    imgsz   = 640,
    batch   = batch,
    device  = device,
    name    = "ppe_final",
    flipud  = 0.5, fliplr = 0.5,
    degrees = 15,  mosaic = 1.0,
    mixup   = 0.1, hsv_h  = 0.015,
    hsv_s   = 0.7, hsv_v  = 0.4,
    copy_paste = 0.2,
    verbose = False, plots = False,
)

best = "runs/detect/ppe_final/weights/best.pt"
print(f"\n✅ Terminé!")
try:
    print(f"   mAP50:    {results.results_dict.get('metrics/mAP50(B)',0):.3f}")
    print(f"   mAP50-95: {results.results_dict.get('metrics/mAP50-95(B)',0):.3f}")
except: pass

# ── Export ONNX ───────────────────────────────────────────────────────────────
print("\n📦 Export ONNX...")
YOLO(best).export(format="onnx", imgsz=640, simplify=True, opset=12)

shutil.copy2(best,                       "ppe_final.pt")
shutil.copy2(best.replace(".pt",".onnx"),"ppe_final.onnx")

info = {"classes":FINAL_CLASSES,"nc":len(FINAL_CLASSES),"model":"yolo11s","stats":stats}
with open("ppe_model_info.json","w") as f: json.dump(info,f,indent=2)

print(f"✅ ppe_final.pt:   {os.path.getsize('ppe_final.pt')/1024/1024:.1f}MB")
print(f"✅ ppe_final.onnx: {os.path.getsize('ppe_final.onnx')/1024/1024:.1f}MB")

# ── Sauvegarde Drive ──────────────────────────────────────────────────────────
try:
    from google.colab import drive
    drive.mount('/content/drive', force_remount=False)
    for f in ["ppe_final.pt","ppe_final.onnx","ppe_model_info.json"]:
        shutil.copy2(f, f"/content/drive/MyDrive/{f}")
    print("✅ Sauvegardé dans Google Drive")
except: pass

files.download("ppe_final.onnx")
files.download("ppe_final.pt")
files.download("ppe_model_info.json")

print(f"""
╔══════════════════════════════════════════════════════╗
║  🎉 PPE FINAL PRÊT — {len(FINAL_CLASSES)} CLASSES                   ║
║                                                      ║
║  Upload ppe_final.onnx → apps/ai-server/ sur GitHub  ║
║  Upload ppe_final.pt   → apps/ai-server/ sur GitHub  ║
║  (Remplace les anciens fichiers)                     ║
╚══════════════════════════════════════════════════════╝
""")
