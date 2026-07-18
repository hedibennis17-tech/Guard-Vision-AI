"""
Shoplifting Detection — Intégration PyResearch
Source: github.com/pyresearch/Shoplifting-Detection-using-Computer-Vision-and-Machine-Learning

Modèle: shoplifting_wights.pt (YOLOv11 fine-tuned)
Classes: 0=Normal  1=Shoplifting (CRITIQUE)
"""
from ultralytics import YOLO
from typing import Optional, List, Dict, Any
import numpy as np, cv2, os, torch, base64
from datetime import datetime
from loguru import logger

CLASSES = {
    0:{"label":"Client normal",  "severity":"info",    "alert":False,"color":"#10B981","icon":"✅","category":"human"},
    1:{"label":"VOL DÉTECTÉ 🚨","severity":"critical","alert":True, "color":"#EF4444","icon":"🚨","category":"shoplifting"},
}

class ShopliftingDetector:
    def __init__(self, weights_path:str="models/shoplifting_wights.pt"):
        self.weights_path = weights_path
        self.model: Optional[YOLO] = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.loaded = False
        if os.path.exists(weights_path):
            try:
                self.model = YOLO(weights_path).to(self.device)
                self.loaded = True
                logger.success(f"✅ Shoplifting model loaded ({self.device})")
            except Exception as e:
                logger.error(f"❌ Shoplifting model error: {e}")
        else:
            logger.warning(f"⚠️ shoplifting_wights.pt not found in {weights_path}\n   → Place model in apps/ai-server/models/")

    def detect(self, image:np.ndarray, confidence:float=0.50) -> List[Dict]:
        if not self.loaded: return []
        try:
            results = self.model.predict(image, conf=confidence, device=self.device, verbose=False)
        except Exception as e:
            logger.error(f"❌ Shoplifting predict: {e}"); return []

        detections=[]
        for r in results:
            if r.boxes is None or not len(r.boxes): continue
            for box,conf,cls in zip(r.boxes.xyxy.cpu().numpy().astype(int),
                                    r.boxes.conf.cpu().numpy(),
                                    r.boxes.cls.cpu().numpy().astype(int)):
                info = CLASSES.get(int(cls),{"label":f"cls{cls}","severity":"info","alert":False,"color":"#64748B","icon":"📦","category":"object"})
                x1,y1,x2,y2 = box.tolist()
                detections.append({
                    "class":    "shoplifting" if cls==1 else "customer_normal",
                    "label":    info["label"], "icon":info["icon"],
                    "category":info["category"],"severity":info["severity"],
                    "score":round(float(conf),3),"confidence":round(float(conf)*100,1),
                    "bbox":[x1,y1,x2,y2],"center":[int((x1+x2)/2),int((y1+y2)/2)],
                    "alert":info["alert"],"module":"retail",
                    "source":"shoplifting_pyresearch","timestamp":datetime.now().isoformat(),
                })
        detections.sort(key=lambda d:(d["class"]=="shoplifting",d["score"]),reverse=True)
        return detections

    def detect_b64(self, b64:str, conf:float=0.50) -> List[Dict]:
        try:
            if "," in b64: b64=b64.split(",")[1]
            arr = np.frombuffer(base64.b64decode(b64),np.uint8)
            img = cv2.imdecode(arr,cv2.IMREAD_COLOR)
            return self.detect(cv2.cvtColor(img,cv2.COLOR_BGR2RGB),conf) if img is not None else []
        except: return []

    @property
    def status(self):
        return {"loaded":self.loaded,"path":self.weights_path,"device":self.device,
                "source":"github.com/pyresearch/Shoplifting-Detection"}

_inst:Optional[ShopliftingDetector]=None
def get_shoplifting_detector()->ShopliftingDetector:
    global _inst
    if _inst is None: _inst=ShopliftingDetector()
    return _inst
