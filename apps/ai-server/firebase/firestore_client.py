"""Firebase Firestore Client"""
import firebase_admin
from firebase_admin import credentials, firestore
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import json, os
from loguru import logger
from config.settings import settings

def _init():
    if firebase_admin._apps:
        return firestore.client()
    try:
        if settings.FIREBASE_CREDENTIALS_JSON:
            cred = credentials.Certificate(json.loads(settings.FIREBASE_CREDENTIALS_JSON))
        elif settings.FIREBASE_CREDENTIALS_PATH and os.path.exists(settings.FIREBASE_CREDENTIALS_PATH):
            cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
        else:
            cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred, {"projectId": settings.FIREBASE_PROJECT_ID})
        logger.success(f"✅ Firebase: {settings.FIREBASE_PROJECT_ID}")
        return firestore.client()
    except Exception as e:
        logger.error(f"❌ Firebase: {e}")
        return None

class FirestoreClient:
    def __init__(self):
        self.db = _init()
        self.connected = self.db is not None

    def _now(self): return datetime.now(timezone.utc).isoformat()

    def write_detection(self, org:str, cam:str, det:Dict) -> Optional[str]:
        if not self.connected: return None
        try:
            ref = self.db.collection("organizations").document(org).collection("detections").document()
            ref.set({
                "id":ref.id,"organizationId":org,"cameraId":cam,
                "type":det.get("class"),"label":det.get("label"),
                "category":det.get("category"),"severity":det.get("severity"),
                "confidence":det.get("score"),"bbox":det.get("bbox"),
                "source":"yolov11_server","detectedAt":self._now(),
            })
            return ref.id
        except Exception as e:
            logger.error(f"detection write: {e}"); return None

    def write_event(self, org:str, cam:str, det_id:str, det:Dict, existing_id:Optional[str]=None) -> Optional[str]:
        if not self.connected: return None
        try:
            now = self._now()
            org_ref = self.db.collection("organizations").document(org)

            if existing_id:
                org_ref.collection("events").document(existing_id).update({
                    "detectionIds": firestore.ArrayUnion([det_id]), "updatedAt": now,
                })
                return existing_id

            ref = org_ref.collection("events").document()
            ref.set({
                "id":ref.id,"organizationId":org,"cameraId":cam,"siteId":"default",
                "detectionIds":[det_id],"primaryType":det.get("class"),
                "category":det.get("category"),"label":det.get("label"),
                "severity":det.get("severity"),"durationSeconds":0,
                "thumbnailUrl":None,"videoClipUrl":None,"clipStatus":"pending",
                "acknowledged":False,"source":"yolov11_server",
                "createdAt":now,"updatedAt":now,
            })
            return ref.id
        except Exception as e:
            logger.error(f"event write: {e}"); return None

    def write_notification(self, org:str, ev_id:str, det:Dict) -> Optional[str]:
        if not self.connected: return None
        if det.get("severity") not in ["warning","critical"]: return None
        try:
            ref = self.db.collection("organizations").document(org).collection("notifications").document()
            icon = "🚨" if det.get("severity")=="critical" else "⚠️"
            ref.set({
                "id":ref.id,"organizationId":org,"eventId":ev_id,
                "type":"ai_detection","title":det.get("label"),
                "body":f"{icon} {det.get('label')} détecté",
                "severity":det.get("severity"),"read":False,
                "source":"yolov11_server","createdAt":self._now(),
            })
            return ref.id
        except Exception as e:
            logger.error(f"notif write: {e}"); return None

_client: Optional[FirestoreClient] = None
def get_firestore() -> FirestoreClient:
    global _client
    if _client is None: _client = FirestoreClient()
    return _client
