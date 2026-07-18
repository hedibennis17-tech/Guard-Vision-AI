"""
PaddleOCR — Reconnaissance de texte, plaques, codes-barres
"""
from typing import List, Dict, Any, Optional
import numpy as np
import re
from loguru import logger
from config.settings import settings


class OCREngine:
    def __init__(self):
        self._ocr = None
        self._loaded = False
        self._load()

    def _load(self):
        try:
            from paddleocr import PaddleOCR
            self._ocr = PaddleOCR(
                use_angle_cls=settings.OCR_USE_ANGLE_CLS,
                lang=settings.OCR_LANGUAGE,
                use_gpu=settings.OCR_USE_GPU,
                show_log=False,
            )
            self._loaded = True
            logger.success("✅ PaddleOCR chargé")
        except ImportError:
            logger.warning("⚠️ PaddleOCR non installé — OCR désactivé")
        except Exception as e:
            logger.error(f"❌ Erreur chargement PaddleOCR: {e}")

    def read_text(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """Lit tout le texte dans une image"""
        if not self._loaded or self._ocr is None:
            return []
        try:
            results = self._ocr.ocr(image, cls=True)
            texts = []
            for line in (results[0] or []):
                bbox, (text, confidence) = line
                texts.append({
                    "text":       text,
                    "confidence": round(float(confidence), 3),
                    "bbox":       [[int(p[0]), int(p[1])] for p in bbox],
                    "type":       "text",
                })
            return texts
        except Exception as e:
            logger.error(f"❌ OCR error: {e}")
            return []

    def read_license_plate(self, image: np.ndarray) -> Optional[Dict[str, Any]]:
        """
        Extrait et valide une plaque d'immatriculation.
        Supporte formats: AA-111-AA, 1234 AB 75, etc.
        """
        texts = self.read_text(image)
        if not texts:
            return None

        # Patterns de plaques (France, Québec, etc.)
        PLATE_PATTERNS = [
            r'^[A-Z]{2}-\d{3}-[A-Z]{2}$',           # France: AB-123-CD
            r'^\d{4}\s?[A-Z]{2}\s?\d{2,3}$',         # Ancien France: 1234 AB 75
            r'^[A-Z]{3}\s?\d{4}$',                    # Québec: AAA 1234
            r'^[A-Z]{1,3}\s?\d{1,4}\s?[A-Z]{0,3}$',  # Générique
        ]

        for item in sorted(texts, key=lambda x: x["confidence"], reverse=True):
            text = item["text"].strip().upper().replace(" ", "")
            for pattern in PLATE_PATTERNS:
                if re.match(pattern, text):
                    return {
                        "plate_text": item["text"].strip().upper(),
                        "normalized": text,
                        "confidence": item["confidence"],
                        "bbox":       item["bbox"],
                        "type":       "license_plate",
                    }

        # Si aucune plaque reconnue, retourner le texte le plus confiant
        if texts:
            best = max(texts, key=lambda x: x["confidence"])
            if best["confidence"] > 0.7:
                return {**best, "type": "text_high_confidence"}
        return None

    def read_barcode(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """Lit les codes-barres et QR codes"""
        try:
            from pyzbar import pyzbar
            import cv2
            gray    = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
            barcodes= pyzbar.decode(gray)
            return [
                {
                    "data":     bc.data.decode("utf-8"),
                    "type":     bc.type,
                    "rect":     {"x":bc.rect.left,"y":bc.rect.top,"w":bc.rect.width,"h":bc.rect.height},
                    "confidence":1.0,
                }
                for bc in barcodes
            ]
        except ImportError:
            return []
        except Exception as e:
            logger.error(f"❌ Barcode error: {e}")
            return []


_ocr_engine: Optional[OCREngine] = None

def get_ocr() -> OCREngine:
    global _ocr_engine
    if _ocr_engine is None:
        _ocr_engine = OCREngine()
    return _ocr_engine
