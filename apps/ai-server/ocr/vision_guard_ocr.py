"""
Vision Guard Recognition Engine — OCR AI Bundle v2.0
Architecture multi-couches selon spec ChatGPT:

Layer 1 (Railway CPU — actif maintenant):
  OpenCV    → prétraitement, QR codes
  pytesseract → lecture texte général
  pyzbar    → codes-barres 1D/2D

Layer 2 (optionnel, GPU recommandé):
  EasyOCR   → OCR multilingue précis
  PaddleOCR → OCR haute précision

Layer 3 (GPU server futur):
  YOLOv11   → détection zone texte avant OCR
  SAM2      → segmentation précise
  CLIP      → recherche sémantique

Réutilisable dans: TrafficGuard · Retail · Industrial · AgriGuard · Defense
"""
import os, re, base64, io, time
from typing import Optional, List, Dict, Any, Tuple
import numpy as np
import cv2
from PIL import Image
from loguru import logger


# ── Patterns de reconnaissance ────────────────────────────────────────────────

LICENSE_PLATE_PATTERNS = [
    # France
    (r'^[A-Z]{2}-?\d{3}-?[A-Z]{2}$',       "FR",  "Plaque France (AA-123-AA)"),
    # Québec
    (r'^[A-Z]{3}\s?\d{4}$',                 "QC",  "Plaque Québec (AAA 1234)"),
    (r'^\d{3}\s?[A-Z]{3}$',                 "QC",  "Plaque Québec (123 AAA)"),
    # Ontario
    (r'^[A-Z]{4}\s?\d{3}$',                 "ON",  "Plaque Ontario"),
    # Ancien format France
    (r'^\d{1,4}\s?[A-Z]{2,3}\s?\d{2,3}$',  "FR_OLD","Plaque France ancien"),
    # USA
    (r'^[A-Z0-9]{5,8}$',                    "US",  "Plaque US générique"),
    # Générique
    (r'^[A-Z0-9]{4,9}$',                    "GEN", "Plaque générique"),
]

SERIAL_PATTERNS = [
    r'SN[:\s#-]?([A-Z0-9]{6,20})',
    r'S/N[:\s#-]?([A-Z0-9]{6,20})',
    r'NUM[ÉE]RO[:\s]?([A-Z0-9]{4,20})',
    r'ID[:\s#-]?([A-Z0-9]{4,20})',
    r'REF[:\s#-]?([A-Z0-9]{4,20})',
]

WARNING_KEYWORDS = [
    "DANGER","WARNING","CAUTION","ATTENTION","STOP","INTERDIT",
    "DÉFENSE","INFLAMMABLE","TOXIC","CORROSIF","HAUTE TENSION",
    "EXPLOSIF","BIOHAZARD","RADIATION","EMERGENCY","EXIT","SORTIE",
]


class VisionGuardOCR:
    """
    Moteur OCR réutilisable pour tous les modules Vision Guard.
    Détecte: texte, plaques, codes-barres, QR codes, numéros de série,
             panneaux de danger, étiquettes produits.
    """

    def __init__(self):
        self.tesseract_ok = False
        self.easyocr_ok   = False
        self.paddle_ok    = False
        self.pyzbar_ok    = False
        self._easy_reader = None
        self._init_engines()

    def _init_engines(self):
        # Tesseract (léger, Railway compatible)
        try:
            import pytesseract
            pytesseract.get_tesseract_version()
            self.tesseract_ok = True
            logger.success("✅ Tesseract OCR")
        except Exception as e:
            logger.warning(f"⚠️ Tesseract: {e}")

        # pyzbar (codes-barres)
        try:
            from pyzbar import pyzbar
            self.pyzbar_ok = True
            logger.success("✅ pyzbar (barcodes)")
        except Exception as e:
            logger.warning(f"⚠️ pyzbar: {e}")

        # EasyOCR (optionnel)
        try:
            import easyocr
            self._easy_reader = easyocr.Reader(["fr","en"], gpu=False, verbose=False)
            self.easyocr_ok   = True
            logger.success("✅ EasyOCR")
        except Exception as e:
            logger.info(f"EasyOCR non disponible: {e}")

        # PaddleOCR (optionnel)
        try:
            from paddleocr import PaddleOCR
            self._paddle = PaddleOCR(use_angle_cls=True, lang="fr", use_gpu=False, show_log=False)
            self.paddle_ok = True
            logger.success("✅ PaddleOCR")
        except Exception as e:
            logger.info(f"PaddleOCR non disponible: {e}")

    # ── Prétraitement image ───────────────────────────────────────────────────

    def _preprocess(self, img: np.ndarray) -> Dict[str, np.ndarray]:
        """Applique différents prétraitements pour maximiser la lisibilité OCR"""
        gray    = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
        denoised= cv2.fastNlMeansDenoising(gray, h=10)
        _, thresh = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        sharp   = cv2.filter2D(gray, -1, np.array([[-1,-1,-1],[-1,9,-1],[-1,-1,-1]]))
        clahe   = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        enhanced= clahe.apply(gray)
        return {
            "original": img,
            "gray":     gray,
            "thresh":   thresh,
            "sharp":    sharp,
            "enhanced": enhanced,
        }

    def _decode_b64(self, b64: str) -> Optional[np.ndarray]:
        try:
            if "," in b64: b64 = b64.split(",")[1]
            img = Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")
            return np.array(img)
        except Exception as e:
            logger.error(f"Decode error: {e}"); return None

    # ── OCR Principal ─────────────────────────────────────────────────────────

    def read_text(self, img: np.ndarray) -> List[Dict]:
        """Lit tout le texte dans une image — utilise le meilleur moteur disponible"""
        results = []

        # 1. PaddleOCR (meilleur si disponible)
        if self.paddle_ok:
            try:
                res = self._paddle.ocr(img, cls=True)
                for line in (res[0] or []):
                    bbox, (text, conf) = line
                    if conf > 0.5 and len(text.strip()) > 1:
                        results.append({
                            "text":       text.strip(),
                            "confidence": round(float(conf), 3),
                            "engine":     "paddleocr",
                            "bbox":       [[int(p[0]),int(p[1])] for p in bbox],
                        })
                if results: return results
            except Exception as e:
                logger.warning(f"PaddleOCR error: {e}")

        # 2. EasyOCR (fallback multilingue)
        if self.easyocr_ok and self._easy_reader:
            try:
                res = self._easy_reader.readtext(img)
                for (bbox, text, conf) in res:
                    if conf > 0.4 and len(text.strip()) > 1:
                        results.append({
                            "text":       text.strip(),
                            "confidence": round(float(conf), 3),
                            "engine":     "easyocr",
                            "bbox":       [[int(p[0]),int(p[1])] for p in bbox],
                        })
                if results: return results
            except Exception as e:
                logger.warning(f"EasyOCR error: {e}")

        # 3. Tesseract (fallback léger)
        if self.tesseract_ok:
            try:
                import pytesseract
                prep  = self._preprocess(img)
                texts = []
                for key, processed in prep.items():
                    if key == "original": continue
                    data = pytesseract.image_to_data(
                        processed, output_type=pytesseract.Output.DICT,
                        config="--psm 11 -l fra+eng"
                    )
                    for i, text in enumerate(data["text"]):
                        text = text.strip()
                        conf = int(data["conf"][i])
                        if text and conf > 40 and len(text) > 1:
                            texts.append({
                                "text": text, "confidence": conf/100,
                                "engine": "tesseract",
                                "bbox": [[data["left"][i], data["top"][i]]],
                            })
                # Dédupliquer
                seen = set()
                for t in texts:
                    if t["text"] not in seen:
                        seen.add(t["text"]); results.append(t)
            except Exception as e:
                logger.warning(f"Tesseract error: {e}")

        return results

    # ── Plaque d'immatriculation ──────────────────────────────────────────────

    def read_license_plate(self, img: np.ndarray) -> Optional[Dict]:
        """
        ALPR — Reconnaissance automatique de plaques.
        1. Localise la plaque (OpenCV contours)
        2. Applique OCR sur la zone détectée
        3. Valide avec les patterns connus
        """
        # Méthode 1: OCR sur image complète
        texts = self.read_text(img)
        for item in sorted(texts, key=lambda x: x["confidence"], reverse=True):
            text    = item["text"].upper().replace(" ","").replace("-","").replace(".","")
            cleaned = re.sub(r'[^A-Z0-9]', '', text)
            for pattern, country, desc in LICENSE_PLATE_PATTERNS:
                # Tester avec et sans séparateurs
                for candidate in [item["text"].upper(), cleaned,
                                   re.sub(r'[^A-Z0-9-]','',item["text"].upper())]:
                    if re.match(pattern, candidate.strip()):
                        return {
                            "plate_text":  item["text"].upper().strip(),
                            "normalized":  cleaned,
                            "country":     country,
                            "format":      desc,
                            "confidence":  item["confidence"],
                            "engine":      item["engine"],
                            "type":        "license_plate",
                        }

        # Méthode 2: Détecter zone plaque par OpenCV
        try:
            gray     = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
            blur     = cv2.bilateralFilter(gray, 11, 17, 17)
            edged    = cv2.Canny(blur, 30, 200)
            contours,_ = cv2.findContours(edged.copy(), cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
            contours = sorted(contours, key=cv2.contourArea, reverse=True)[:10]

            for c in contours:
                peri  = cv2.arcLength(c, True)
                approx= cv2.approxPolyDP(c, 0.018*peri, True)
                if len(approx) == 4:
                    x,y,w,h = cv2.boundingRect(approx)
                    ratio   = w/h if h > 0 else 0
                    if 2.5 < ratio < 6.0 and w > 80:
                        crop    = img[y:y+h, x:x+w]
                        sub_texts = self.read_text(crop)
                        for item in sub_texts:
                            cleaned = re.sub(r'[^A-Z0-9]','',item["text"].upper())
                            if 5 <= len(cleaned) <= 9:
                                return {
                                    "plate_text":  item["text"].upper().strip(),
                                    "normalized":  cleaned,
                                    "country":     "DETECTED",
                                    "format":      "OpenCV Contour Detection",
                                    "confidence":  item["confidence"],
                                    "engine":      f"opencv+{item['engine']}",
                                    "bbox":        [x,y,x+w,y+h],
                                    "type":        "license_plate",
                                }
        except Exception as e:
            logger.warning(f"OpenCV plate detection: {e}")

        return None

    # ── Codes-barres & QR ─────────────────────────────────────────────────────

    def read_barcodes(self, img: np.ndarray) -> List[Dict]:
        """Lit codes-barres 1D + QR codes"""
        results = []

        # pyzbar (EAN, Code128, Code39, DataMatrix, PDF417...)
        if self.pyzbar_ok:
            try:
                from pyzbar import pyzbar
                gray     = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
                barcodes = pyzbar.decode(gray)
                for bc in barcodes:
                    results.append({
                        "data":       bc.data.decode("utf-8","replace"),
                        "type":       bc.type,
                        "format":     bc.type,
                        "rect":       {"x":bc.rect.left,"y":bc.rect.top,"w":bc.rect.width,"h":bc.rect.height},
                        "confidence": 1.0,
                        "engine":     "pyzbar",
                    })
            except Exception as e:
                logger.warning(f"pyzbar: {e}")

        # OpenCV QR Code
        try:
            qr_detector = cv2.QRCodeDetector()
            data, points, _ = qr_detector.detectAndDecode(
                cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
            )
            if data:
                already = any(r["data"]==data for r in results)
                if not already:
                    results.append({
                        "data":       data,
                        "type":       "QR_CODE",
                        "format":     "QR Code",
                        "confidence": 1.0,
                        "engine":     "opencv",
                    })
        except Exception as e:
            logger.warning(f"OpenCV QR: {e}")

        return results

    # ── Numéros de série ──────────────────────────────────────────────────────

    def read_serial_number(self, img: np.ndarray) -> Optional[Dict]:
        """Extrait les numéros de série, IDs, références"""
        texts = self.read_text(img)
        full_text = " ".join(t["text"] for t in texts).upper()

        for pattern in SERIAL_PATTERNS:
            match = re.search(pattern, full_text)
            if match:
                return {
                    "serial":     match.group(1),
                    "raw_text":   full_text[:200],
                    "pattern":    pattern,
                    "type":       "serial_number",
                    "confidence": 0.85,
                }

        # Fallback: chercher séquences alphanumériques longues
        candidates = re.findall(r'[A-Z0-9]{8,20}', full_text)
        if candidates:
            return {
                "serial":     candidates[0],
                "raw_text":   full_text[:200],
                "pattern":    "generic_alphanumeric",
                "type":       "serial_number",
                "confidence": 0.60,
            }
        return None

    # ── Panneaux de danger ────────────────────────────────────────────────────

    def read_warning_signs(self, img: np.ndarray) -> List[Dict]:
        """Détecte les panneaux de danger et signalisation"""
        texts   = self.read_text(img)
        results = []

        for item in texts:
            text_upper = item["text"].upper()
            for keyword in WARNING_KEYWORDS:
                if keyword in text_upper:
                    results.append({
                        "keyword":    keyword,
                        "full_text":  item["text"],
                        "severity":   "critical" if keyword in ["DANGER","STOP","EXPLOSIF","RADIATION"] else "warning",
                        "confidence": item["confidence"],
                        "type":       "warning_sign",
                        "engine":     item["engine"],
                    })
                    break

        # Détecter couleurs de panneau (rouge = stop/danger, jaune = attention)
        try:
            hsv     = cv2.cvtColor(img, cv2.COLOR_RGB2HSV)
            red_mask= cv2.inRange(hsv, (0,100,100), (10,255,255))
            red_pct = (red_mask > 0).sum() / red_mask.size
            if red_pct > 0.15 and not results:
                results.append({
                    "keyword":    "ROUGE_DÉTECTÉ",
                    "full_text":  "Panneau rouge détecté (STOP/DANGER probable)",
                    "severity":   "warning",
                    "confidence": red_pct,
                    "type":       "color_sign",
                    "engine":     "opencv_color",
                })
        except: pass

        return results

    # ── Analyse complète ──────────────────────────────────────────────────────

    def analyze(
        self,
        image_b64:   str,
        module:      str = "general",  # traffic|retail|industrial|agriculture|defense
        run_plate:   bool = True,
        run_barcode: bool = True,
        run_serial:  bool = True,
        run_warning: bool = True,
        run_text:    bool = True,
    ) -> Dict:
        """
        Analyse complète d'une image — point d'entrée principal.
        Adapte les détections selon le module actif.
        """
        start = time.time()
        img   = self._decode_b64(image_b64)
        if img is None:
            return {"error": "Impossible de décoder l'image", "results": {}}

        results: Dict[str, Any] = {
            "module": module,
            "image_size": [img.shape[1], img.shape[0]],
        }

        # Adapter selon le module
        if module == "transportation":
            run_plate=True; run_barcode=False; run_warning=True
        elif module == "retail":
            run_plate=False; run_barcode=True; run_serial=True; run_warning=False
        elif module in ["industrial","construction"]:
            run_plate=False; run_barcode=True; run_serial=True; run_warning=True
        elif module == "defense":
            run_plate=True; run_barcode=True; run_serial=True; run_warning=True

        # Exécuter les détections
        if run_plate:
            results["license_plate"] = self.read_license_plate(img)

        if run_barcode:
            results["barcodes"] = self.read_barcodes(img)

        if run_serial:
            results["serial_number"] = self.read_serial_number(img)

        if run_warning:
            results["warning_signs"] = self.read_warning_signs(img)

        if run_text:
            results["all_text"] = self.read_text(img)

        # Résumé
        alerts = []
        if results.get("license_plate"):
            p = results["license_plate"]
            alerts.append({
                "type":  "license_plate",
                "value": p["plate_text"],
                "conf":  p["confidence"],
                "icon":  "🔤",
            })
        for bc in results.get("barcodes", []):
            alerts.append({
                "type":  "barcode",
                "value": f"{bc['type']}: {bc['data']}",
                "conf":  bc["confidence"],
                "icon":  "📊",
            })
        for ws in results.get("warning_signs", []):
            alerts.append({
                "type":    "warning",
                "value":   ws["keyword"],
                "conf":    ws["confidence"],
                "severity":ws["severity"],
                "icon":    "⚠️",
            })

        results["alerts"]       = alerts
        results["inference_ms"] = round((time.time()-start)*1000)
        results["engines_used"] = {
            "tesseract": self.tesseract_ok,
            "easyocr":   self.easyocr_ok,
            "paddleocr": self.paddle_ok,
            "pyzbar":    self.pyzbar_ok,
            "opencv_qr": True,
        }

        return results

    @property
    def status(self) -> Dict:
        active = sum([self.tesseract_ok, self.easyocr_ok, self.paddle_ok])
        return {
            "loaded":     active > 0 or self.pyzbar_ok,
            "engines": {
                "tesseract": self.tesseract_ok,
                "easyocr":   self.easyocr_ok,
                "paddleocr": self.paddle_ok,
                "pyzbar":    self.pyzbar_ok,
                "opencv_qr": True,
            },
            "features": {
                "license_plate":      True,
                "barcode":            self.pyzbar_ok,
                "qr_code":            True,
                "text_general":       self.tesseract_ok or self.easyocr_ok or self.paddle_ok,
                "serial_number":      True,
                "warning_signs":      True,
                "multilingue":        self.easyocr_ok or self.paddle_ok,
            },
            "modules": ["transportation","retail","industrial","construction","agriculture","defense"],
        }


# Singleton
_ocr: Optional[VisionGuardOCR] = None

def get_ocr() -> VisionGuardOCR:
    global _ocr
    if _ocr is None:
        _ocr = VisionGuardOCR()
    return _ocr
