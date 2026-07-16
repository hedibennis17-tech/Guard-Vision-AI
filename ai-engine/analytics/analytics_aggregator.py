"""
AnalyticsAggregator — Phase 9
Agrège les DetectionDocs du jour en un DailyAnalyticsDoc.
Appelé chaque soir par un cron (Cloud Function scheduleAnalytics).
"""

from __future__ import annotations
from datetime import datetime, timezone, timedelta
from collections import defaultdict
from loguru import logger

try:
    from firebase_admin import firestore
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False


class AnalyticsAggregator:

    def aggregate_day(self, organization_id: str, date_str: str) -> dict:
        """
        Agrège toutes les détections d'une journée pour une organisation.
        date_str : "YYYY-MM-DD"
        """
        if not FIREBASE_AVAILABLE:
            return self._stub_aggregate(organization_id, date_str)

        db = firestore.client()
        start = f"{date_str}T00:00:00+00:00"
        end   = f"{date_str}T23:59:59+00:00"

        detections_snap = (
            db.collection("organizations").document(organization_id)
            .collection("detections")
            .where("detectedAt", ">=", start)
            .where("detectedAt", "<=", end)
            .get()
        )

        events_snap = (
            db.collection("organizations").document(organization_id)
            .collection("events")
            .where("createdAt", ">=", start)
            .where("createdAt", "<=", end)
            .get()
        )

        detections = [d.data() for d in detections_snap]
        events     = [e.data() for e in events_snap]

        by_type:   dict[str, int] = defaultdict(int)
        by_hour:   list[int]      = [0] * 24
        by_camera: dict[str, int] = defaultdict(int)

        for det in detections:
            t = det.get("type", "unknown")
            by_type[t] += 1
            try:
                h = datetime.fromisoformat(det["detectedAt"].replace("Z", "+00:00")).hour
                by_hour[h] += 1
            except Exception:
                pass
            cam = det.get("cameraId", "")
            if cam:
                by_camera[cam] += 1

        critical = sum(1 for e in events if e.get("severity") == "critical")
        warning  = sum(1 for e in events if e.get("severity") == "warning")

        cameras_snap = (
            db.collection("organizations").document(organization_id)
            .collection("cameras").where("status", "==", "online").get()
        )

        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "id":             date_str,
            "organizationId": organization_id,
            "date":           date_str,
            "totalDetections": len(detections),
            "totalEvents":     len(events),
            "criticalEvents":  critical,
            "warningEvents":   warning,
            "onlineCameras":   len(cameras_snap),
            "byType":          dict(by_type),
            "byHour":          by_hour,
            "byCamera":        dict(by_camera),
            "createdAt":       now,
            "updatedAt":       now,
        }

        db.collection("organizations").document(organization_id) \
          .collection("analytics").document(date_str) \
          .set(doc, merge=True)

        logger.success(
            f"Analytics agrégées | org={organization_id} date={date_str} "
            f"detections={len(detections)} events={len(events)}"
        )
        return doc

    def aggregate_week_heatmap(self, organization_id: str, week_start: str) -> list[list[int]]:
        """
        Génère la heatmap [7 jours][24 heures] pour la semaine commençant à week_start.
        Utilisée par la vue Heatmap du dashboard.
        """
        start = datetime.fromisoformat(week_start)
        heatmap = [[0] * 24 for _ in range(7)]

        if not FIREBASE_AVAILABLE:
            import random
            return [[random.randint(0, 15) for _ in range(24)] for _ in range(7)]

        db = firestore.client()
        for day_offset in range(7):
            date_str = (start + timedelta(days=day_offset)).strftime("%Y-%m-%d")
            snap = (
                db.collection("organizations").document(organization_id)
                .collection("analytics").document(date_str).get()
            )
            if snap.exists:
                by_hour = snap.data().get("byHour", [0]*24)
                heatmap[day_offset] = by_hour[:24]

        return heatmap

    def _stub_aggregate(self, organization_id: str, date_str: str) -> dict:
        import random
        now = datetime.now(timezone.utc).isoformat()
        return {
            "id":              date_str,
            "organizationId":  organization_id,
            "date":            date_str,
            "totalDetections": random.randint(80, 200),
            "totalEvents":     random.randint(15, 40),
            "criticalEvents":  random.randint(0, 5),
            "warningEvents":   random.randint(5, 15),
            "onlineCameras":   4,
            "byType":          {"person": 87, "car": 31, "dog": 8, "fire": 3, "smoke": 2},
            "byHour":          [random.randint(0, 20) for _ in range(24)],
            "byCamera":        {"cam1": 52, "cam2": 31, "cam3": 28, "cam4": 18},
            "createdAt":       now,
            "updatedAt":       now,
        }
