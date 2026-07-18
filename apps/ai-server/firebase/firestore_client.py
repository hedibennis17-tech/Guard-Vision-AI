"""
Firebase Firestore Client — Vision Guard AI Server
Écrit les détections, events et notifications depuis Python
"""
import firebase_admin
from firebase_admin import credentials, firestore
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
import json, os
from loguru import logger
from config.settings import settings


def _init_firebase():
    if firebase_admin._apps:
        return firestore.client()

    creds_path = settings.FIREBASE_CREDENTIALS_PATH
    creds_json = settings.FIREBASE_CREDENTIALS_JSON

    if creds_json:
        # JSON inline (variable d'environnement Railway)
        cred_dict = json.loads(creds_json)
        cred = credentials.Certificate(cred_dict)
    elif creds_path and os.path.exists(creds_path):
        cred = credentials.Certificate(creds_path)
    else:
        # Application Default Credentials (GCP)
        cred = credentials.ApplicationDefault()

    firebase_admin.initialize_app(cred, {"projectId": settings.FIREBASE_PROJECT_ID})
    logger.success(f"✅ Firebase connecté: {settings.FIREBASE_PROJECT_ID}")
    return firestore.client()


class FirestoreClient:
    def __init__(self):
        try:
            self.db = _init_firebase()
            self.connected = True
        except Exception as e:
            logger.error(f"❌ Firebase connexion impossible: {e}")
            self.db = None
            self.connected = False

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def write_detection(
        self,
        organization_id: str,
        camera_id:       str,
        detection:       Dict[str, Any],
        snapshot_url:    Optional[str] = None,
    ) -> Optional[str]:
        """Écrit une détection dans Firestore"""
        if not self.connected:
            return None
        try:
            now  = self._now()
            ref  = self.db.collection("organizations").document(organization_id)\
                       .collection("detections").document()
            data = {
                "id":           ref.id,
                "organizationId": organization_id,
                "cameraId":     camera_id,
                "type":         detection.get("class","unknown"),
                "label":        detection.get("label",""),
                "category":     detection.get("category","object"),
                "severity":     detection.get("severity","info"),
                "confidence":   detection.get("score",0),
                "bbox":         detection.get("bbox"),
                "center":       detection.get("center"),
                "trackId":      detection.get("track_id"),
                "snapshotUrl":  snapshot_url,
                "detectedAt":   now,
                "source":       "yolov11_server",
                "module":       detection.get("module","general"),
            }
            ref.set(data)
            return ref.id
        except Exception as e:
            logger.error(f"❌ Firestore detection write: {e}")
            return None

    def write_event(
        self,
        organization_id: str,
        camera_id:       str,
        detection_id:    str,
        detection:       Dict[str, Any],
        thumbnail_url:   Optional[str] = None,
        existing_event_id: Optional[str] = None,
    ) -> Optional[str]:
        """Crée ou met à jour un event dans Firestore"""
        if not self.connected:
            return None
        try:
            now   = self._now()
            org   = self.db.collection("organizations").document(organization_id)

            # Chercher event existant (30s)
            if not existing_event_id:
                from datetime import timedelta
                window = (datetime.now(timezone.utc) - timedelta(seconds=30)).isoformat()
                existing = org.collection("events")\
                    .where("cameraId","==",camera_id)\
                    .where("primaryType","==",detection.get("class",""))\
                    .where("acknowledged","==",False)\
                    .order_by("createdAt", direction=firestore.Query.DESCENDING)\
                    .limit(1).stream()

                for doc in existing:
                    ev = doc.to_dict()
                    if ev.get("createdAt","") >= window:
                        existing_event_id = doc.id
                        break

            if existing_event_id:
                # Mise à jour
                ref = org.collection("events").document(existing_event_id)
                ref.update({
                    "detectionIds": firestore.ArrayUnion([detection_id]),
                    "thumbnailUrl": thumbnail_url,
                    "updatedAt":    now,
                })
                return existing_event_id
            else:
                # Nouvel event
                ref = org.collection("events").document()
                ref.set({
                    "id":            ref.id,
                    "organizationId":organization_id,
                    "siteId":        "default",
                    "cameraId":      camera_id,
                    "detectionIds":  [detection_id],
                    "primaryType":   detection.get("class",""),
                    "category":      detection.get("category","object"),
                    "label":         detection.get("label",""),
                    "severity":      detection.get("severity","info"),
                    "durationSeconds":0,
                    "thumbnailUrl":  thumbnail_url,
                    "videoClipUrl":  None,
                    "clipStatus":    "pending",
                    "acknowledged":  False,
                    "source":        "yolov11_server",
                    "createdAt":     now,
                    "updatedAt":     now,
                })
                logger.info(f"📋 Event créé: {ref.id} ({detection.get('label')})")
                return ref.id

        except Exception as e:
            logger.error(f"❌ Firestore event write: {e}")
            return None

    def write_notification(
        self,
        organization_id: str,
        event_id:        str,
        detection:       Dict[str, Any],
    ) -> Optional[str]:
        """Crée une notification pour les alertes importantes"""
        if not self.connected:
            return None
        if detection.get("severity") not in ["warning","critical"]:
            return None
        try:
            now = self._now()
            ref = self.db.collection("organizations").document(organization_id)\
                       .collection("notifications").document()
            icon = "🚨" if detection.get("severity")=="critical" else "⚠️"
            ref.set({
                "id":            ref.id,
                "organizationId":organization_id,
                "eventId":       event_id,
                "type":          "ai_detection",
                "title":         detection.get("label",""),
                "body":          f"{icon} {detection.get('label','')} détecté par IA serveur",
                "severity":      detection.get("severity","info"),
                "read":          False,
                "source":        "yolov11_server",
                "createdAt":     now,
            })
            return ref.id
        except Exception as e:
            logger.error(f"❌ Firestore notif write: {e}")
            return None


_client: Optional[FirestoreClient] = None

def get_firestore() -> FirestoreClient:
    global _client
    if _client is None:
        _client = FirestoreClient()
    return _client
