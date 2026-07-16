"""
ReportService — Phase 8
Orchestrateur : fetch data → generate PDF → upload Storage → update Firestore.
Exposé via l'API FastAPI (POST /reports/generate).
"""

from __future__ import annotations
import uuid
from datetime import datetime, timezone
from loguru import logger

from reports.report_data import ReportDataFetcher, ReportData
from reports.pdf_generator import PdfReportGenerator

try:
    from firebase_admin import firestore, storage
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False


class ReportService:
    def __init__(self):
        self._fetcher   = ReportDataFetcher()
        self._generator = PdfReportGenerator()

    def generate_report(
        self,
        organization_id: str,
        period_start:    str,
        period_end:      str,
        cadence:         str = "on_demand",
        generated_by:    str = "system",
    ) -> dict:
        """
        Génère un rapport PDF et le sauvegarde dans Firebase Storage.
        Retourne le ReportDoc créé dans Firestore.
        """
        report_id = str(uuid.uuid4())
        now       = datetime.now(timezone.utc).isoformat()
        logger.info(f"Génération rapport | org={organization_id} cadence={cadence} id={report_id[:8]}...")

        # 1. Fetch data
        data: ReportData = self._fetcher.fetch(organization_id, period_start, period_end, cadence)

        # 2. Generate PDF
        pdf_bytes = self._generator.generate(data)
        logger.info(f"PDF généré | {len(pdf_bytes):,} bytes")

        # 3. Upload Storage
        file_url = self._upload_pdf(pdf_bytes, organization_id, report_id)

        # 4. Save ReportDoc in Firestore
        report_doc = {
            "id":             report_id,
            "organizationId": organization_id,
            "cadence":        cadence,
            "format":         "pdf",
            "periodStart":    period_start,
            "periodEnd":      period_end,
            "fileUrl":        file_url,
            "generatedBy":    generated_by,
            "createdAt":      now,
            # Résumé pour l'affichage rapide dans l'UI
            "summary": {
                "totalDetections": data.total_detections,
                "totalEvents":     data.total_events,
                "criticalEvents":  data.critical_events,
            },
        }

        if FIREBASE_AVAILABLE:
            db = firestore.client()
            db.collection("organizations").document(organization_id) \
              .collection("reports").document(report_id) \
              .set(report_doc)
            logger.success(f"Rapport sauvegardé | id={report_id[:8]}... url={file_url}")

        return report_doc

    def _upload_pdf(self, pdf_bytes: bytes, organization_id: str, report_id: str) -> str:
        if not FIREBASE_AVAILABLE:
            logger.debug("[STUB] Upload PDF simulé")
            return f"https://storage.visionguard.ai/reports/{organization_id}/{report_id}.pdf"

        try:
            bucket    = storage.bucket()
            blob_path = f"organizations/{organization_id}/reports/{report_id}.pdf"
            blob      = bucket.blob(blob_path)
            blob.upload_from_string(pdf_bytes, content_type="application/pdf")
            blob.make_public()
            return blob.public_url
        except Exception as e:
            logger.error(f"Erreur upload PDF : {e}")
            return ""
