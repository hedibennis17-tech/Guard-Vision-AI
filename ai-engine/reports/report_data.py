"""
ReportDataFetcher — Phase 8
Collecte toutes les données Firestore nécessaires pour générer un rapport.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional
from loguru import logger

try:
    from firebase_admin import firestore
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False


@dataclass
class DetectionSummary:
    type: str
    count: int
    avgConfidence: float


@dataclass
class EventSummary:
    id: str
    primaryType: str
    severity: str
    cameraName: str
    detectionCount: int
    durationSeconds: int
    createdAt: str
    acknowledged: bool


@dataclass
class CameraSummary:
    id: str
    name: str
    status: str
    detectionCount: int
    eventCount: int


@dataclass
class ReportData:
    """Toutes les données nécessaires au PDF — indépendant de reportlab."""
    organization_id:   str
    organization_name: str
    period_start:      str
    period_end:        str
    cadence:           str  # daily | weekly | monthly | on_demand

    # Totaux
    total_detections:   int = 0
    total_events:       int = 0
    critical_events:    int = 0
    warning_events:     int = 0
    info_events:        int = 0
    acknowledged_events: int = 0

    # Détails
    detection_breakdown: list[DetectionSummary] = field(default_factory=list)
    top_events:          list[EventSummary]     = field(default_factory=list)
    camera_summaries:    list[CameraSummary]    = field(default_factory=list)

    # Méta
    generated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ReportDataFetcher:
    """Récupère les données Firestore pour la période spécifiée."""

    def __init__(self):
        self._db = firestore.client() if FIREBASE_AVAILABLE else None

    def fetch(
        self,
        organization_id: str,
        period_start: str,
        period_end:   str,
        cadence:      str = "on_demand",
    ) -> ReportData:
        if not self._db:
            return self._stub_data(organization_id, period_start, period_end, cadence)

        try:
            return self._fetch_from_firestore(organization_id, period_start, period_end, cadence)
        except Exception as e:
            logger.error(f"Erreur fetch rapport : {e}")
            return self._stub_data(organization_id, period_start, period_end, cadence)

    def _fetch_from_firestore(
        self,
        organization_id: str,
        period_start: str,
        period_end:   str,
        cadence:      str,
    ) -> ReportData:
        db = self._db

        # Infos organisation
        org_snap = db.collection("organizations").document(organization_id).get()
        org_name = org_snap.data().get("name", "Organisation") if org_snap.exists else "Organisation"

        # Caméras
        cameras_snap = (
            db.collection("organizations").document(organization_id)
            .collection("cameras").get()
        )
        camera_map = {c.id: c.data().get("name", c.id) for c in cameras_snap}

        # Détections dans la période
        detections_snap = (
            db.collection("organizations").document(organization_id)
            .collection("detections")
            .where("detectedAt", ">=", period_start)
            .where("detectedAt", "<=", period_end)
            .get()
        )
        detections = [d.data() for d in detections_snap]

        # Agrégation par type
        type_counts: dict[str, list[float]] = {}
        for det in detections:
            t = det.get("type", "unknown")
            type_counts.setdefault(t, []).append(det.get("confidence", 0))

        detection_breakdown = [
            DetectionSummary(
                type=t,
                count=len(confs),
                avgConfidence=round(sum(confs) / len(confs), 3),
            )
            for t, confs in sorted(type_counts.items(), key=lambda x: -len(x[1]))
        ]

        # Événements dans la période
        events_snap = (
            db.collection("organizations").document(organization_id)
            .collection("events")
            .where("createdAt", ">=", period_start)
            .where("createdAt", "<=", period_end)
            .order_by("createdAt", direction="DESCENDING")
            .get()
        )
        events = [e.data() for e in events_snap]

        critical = sum(1 for e in events if e.get("severity") == "critical")
        warning  = sum(1 for e in events if e.get("severity") == "warning")
        info     = sum(1 for e in events if e.get("severity") == "info")
        acked    = sum(1 for e in events if e.get("acknowledged"))

        top_events = [
            EventSummary(
                id=e.get("id", ""),
                primaryType=e.get("primaryType", ""),
                severity=e.get("severity", "info"),
                cameraName=camera_map.get(e.get("cameraId", ""), "Caméra inconnue"),
                detectionCount=len(e.get("detectionIds", [])),
                durationSeconds=e.get("durationSeconds", 0),
                createdAt=e.get("createdAt", ""),
                acknowledged=e.get("acknowledged", False),
            )
            for e in events[:20]
        ]

        # Résumé par caméra
        cam_detections: dict[str, int] = {}
        for det in detections:
            cam_id = det.get("cameraId", "")
            cam_detections[cam_id] = cam_detections.get(cam_id, 0) + 1

        cam_events: dict[str, int] = {}
        for ev in events:
            cam_id = ev.get("cameraId", "")
            cam_events[cam_id] = cam_events.get(cam_id, 0) + 1

        camera_summaries = [
            CameraSummary(
                id=cam_id,
                name=cam_data.get("name", cam_id),
                status=cam_data.get("status", "unknown"),
                detectionCount=cam_detections.get(cam_id, 0),
                eventCount=cam_events.get(cam_id, 0),
            )
            for snap in cameras_snap
            for cam_id, cam_data in [(snap.id, snap.data())]
        ]

        return ReportData(
            organization_id=organization_id,
            organization_name=org_name,
            period_start=period_start,
            period_end=period_end,
            cadence=cadence,
            total_detections=len(detections),
            total_events=len(events),
            critical_events=critical,
            warning_events=warning,
            info_events=info,
            acknowledged_events=acked,
            detection_breakdown=detection_breakdown,
            top_events=top_events,
            camera_summaries=camera_summaries,
        )

    def _stub_data(self, org_id: str, period_start: str, period_end: str, cadence: str) -> ReportData:
        return ReportData(
            organization_id=org_id,
            organization_name="Vision Guard Demo",
            period_start=period_start,
            period_end=period_end,
            cadence=cadence,
            total_detections=142,
            total_events=28,
            critical_events=3,
            warning_events=12,
            info_events=13,
            acknowledged_events=25,
            detection_breakdown=[
                DetectionSummary("person", 87, 0.891),
                DetectionSummary("car",    31, 0.872),
                DetectionSummary("dog",     8, 0.812),
                DetectionSummary("fire",    3, 0.934),
                DetectionSummary("smoke",   2, 0.867),
            ],
            top_events=[
                EventSummary("e1","fire",  "critical","Entrepôt",    3,18,  period_start, True),
                EventSummary("e2","person","critical","Entrée",       7,42,  period_start, True),
                EventSummary("e3","person","warning", "Parking",      2,8,   period_start, False),
                EventSummary("e4","car",   "info",    "Sortie",       4,25,  period_start, True),
            ],
            camera_summaries=[
                CameraSummary("cam1","Entrée principale","online",52,8),
                CameraSummary("cam2","Parking",          "online",31,6),
                CameraSummary("cam3","Entrepôt",         "online",28,5),
                CameraSummary("cam4","Cour arrière",     "offline",0,0),
            ],
        )
