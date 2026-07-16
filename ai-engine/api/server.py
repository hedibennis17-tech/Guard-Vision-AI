"""
API HTTP du Vision Guard AI Engine — FastAPI.

Endpoints consommés par les Cloud Functions et le Dashboard :
  GET  /health            → santé du service
  GET  /status            → état de l'engine (streams actifs, modèle, etc.)
  POST /cameras/start     → démarrer la détection sur une caméra
  DELETE /cameras/{id}    → arrêter la détection
  POST /analyze/frame     → analyser une image base64 (webhook/test)
"""

from __future__ import annotations
from contextlib import asynccontextmanager
from typing import Optional
import base64
import numpy as np
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from loguru import logger

from detection.detection_engine import DetectionEngine
from config import API_HOST, API_PORT

# ─── Instance globale du Detection Engine ───────────────────────────────────
engine = DetectionEngine()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Démarre le Detection Engine au lancement de l'API."""
    logger.info("Démarrage de l'API Vision Guard AI Engine...")
    engine.start()
    yield
    logger.info("Arrêt de l'API...")
    engine.shutdown()


app = FastAPI(
    title="Vision Guard AI Engine",
    description="YOLOv11 Detection Service — Phase 5",
    version="0.5.0",
    lifespan=lifespan,
)


# ─── Modèles Pydantic ────────────────────────────────────────────────────────

class StartCameraRequest(BaseModel):
    camera_id: str
    organization_id: str
    site_id: str = ""
    rtsp_url: str


class AnalyzeFrameRequest(BaseModel):
    """Analyse une image encodée en base64 (utile pour les tests et webhooks)."""
    image_base64: str
    camera_id: Optional[str] = None
    organization_id: Optional[str] = None


# ─── Endpoints ───────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "vision-guard-ai-engine"}


@app.get("/status")
async def status():
    return engine.get_status()


@app.post("/cameras/start")
async def start_camera(req: StartCameraRequest):
    try:
        result = engine.add_camera_manual(
            camera_id=req.camera_id,
            organization_id=req.organization_id,
            site_id=req.site_id,
            rtsp_url=req.rtsp_url,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/cameras/{camera_id}")
async def stop_camera(camera_id: str):
    try:
        return engine.remove_camera_manual(camera_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze/frame")
async def analyze_frame(req: AnalyzeFrameRequest):
    """
    Analyse une frame unique (base64 JPEG/PNG).
    Utile pour tester le modèle ou pour des intégrations webhook.
    """
    try:
        image_bytes = base64.b64decode(req.image_base64)
        np_arr = np.frombuffer(image_bytes, np.uint8)

        try:
            import cv2
            frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        except ImportError:
            frame = np.zeros((720, 1280, 3), dtype=np.uint8)

        analysis = engine.detector.analyze(frame)
        return {
            "detections": [
                {
                    "class_name":   d.class_name,
                    "confidence":   d.confidence,
                    "bounding_box": {
                        "x": d.bounding_box.x, "y": d.bounding_box.y,
                        "width": d.bounding_box.width, "height": d.bounding_box.height,
                    },
                }
                for d in analysis.detections
            ],
            "inference_ms":   analysis.inference_ms,
            "has_detections": analysis.has_detections,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─── Point d'entrée ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.server:app", host=API_HOST, port=API_PORT, reload=False)


# ─── Reports endpoints (Phase 8) ─────────────────────────────────────────────

from reports.report_service import ReportService

_report_service = ReportService()


class GenerateReportRequest(BaseModel):
    organization_id: str
    period_start:    str   # ISO 8601
    period_end:      str
    cadence:         str = "on_demand"
    generated_by:    str = "user"


@app.post("/reports/generate")
async def generate_report(req: GenerateReportRequest, background_tasks: BackgroundTasks):
    """
    Génère un rapport PDF en tâche de fond.
    Retourne l'ID du rapport immédiatement ; le PDF est disponible dans Storage quelques secondes après.
    """
    import uuid
    report_id = str(uuid.uuid4())

    def _generate():
        try:
            _report_service.generate_report(
                organization_id=req.organization_id,
                period_start=req.period_start,
                period_end=req.period_end,
                cadence=req.cadence,
                generated_by=req.generated_by,
            )
        except Exception as e:
            logger.error(f"Erreur génération rapport {report_id}: {e}")

    background_tasks.add_task(_generate)
    return {"report_id": report_id, "status": "generating"}


# ─── Analytics endpoints (Phase 9) ───────────────────────────────────────────

from analytics.analytics_aggregator import AnalyticsAggregator

_analytics_aggregator = AnalyticsAggregator()


class AggregateAnalyticsRequest(BaseModel):
    organization_id: str
    date:            str   # YYYY-MM-DD


@app.post("/analytics/aggregate")
async def aggregate_analytics(req: AggregateAnalyticsRequest):
    try:
        result = _analytics_aggregator.aggregate_day(req.organization_id, req.date)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/analytics/heatmap/{org_id}")
async def get_heatmap(org_id: str, week_start: str = "2026-07-07"):
    try:
        data = _analytics_aggregator.aggregate_week_heatmap(org_id, week_start)
        return {"heatmap": data, "weekStart": week_start}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
