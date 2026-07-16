"""
PdfReportGenerator — Phase 8
Génère un rapport PDF professionnel avec reportlab.

Structure du rapport :
  Page 1 — Couverture (logo, organisation, période, résumé exécutif)
  Page 2 — Statistiques globales + graphique détections par type
  Page 3 — Top événements (tableau)
  Page 4 — Résumé par caméra
  Page N — Pied de page paginé
"""

from __future__ import annotations
import io
from datetime import datetime
from typing import Optional
from loguru import logger

from reports.report_data import ReportData, DetectionSummary, EventSummary

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        HRFlowable, PageBreak, KeepTogether,
    )
    from reportlab.graphics.shapes import Drawing, Rect, String
    from reportlab.graphics import renderPDF
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False
    logger.warning("reportlab non installé — PdfReportGenerator en mode stub.")

# ─── Palette Vision Guard ────────────────────────────────────────────────────
VG_BLUE     = colors.HexColor("#0EA5E9")
VG_DARK     = colors.HexColor("#0F172A")
VG_SURFACE  = colors.HexColor("#1E293B")
VG_BORDER   = colors.HexColor("#334155")
VG_TEXT     = colors.HexColor("#F1F5F9")
VG_MUTED    = colors.HexColor("#64748B")
SEV_RED     = colors.HexColor("#EF4444")
SEV_AMBER   = colors.HexColor("#F59E0B")
SEV_SLATE   = colors.HexColor("#475569")


class PdfReportGenerator:
    """Génère un PDF de rapport Vision Guard à partir d'un ReportData."""

    def generate(self, data: ReportData) -> bytes:
        """Retourne les bytes du PDF généré."""
        if not REPORTLAB_AVAILABLE:
            return self._stub_pdf(data)

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=20*mm, rightMargin=20*mm,
            topMargin=20*mm, bottomMargin=20*mm,
            title=f"Vision Guard — Rapport {data.cadence}",
            author="Vision Guard AI Platform",
        )

        styles = self._build_styles()
        story  = []

        # ── Page 1 — Couverture ─────────────────────────────────────────────
        story += self._cover_page(data, styles)
        story.append(PageBreak())

        # ── Page 2 — Statistiques ───────────────────────────────────────────
        story += self._stats_page(data, styles)
        story.append(PageBreak())

        # ── Page 3 — Top événements ─────────────────────────────────────────
        story += self._events_page(data, styles)
        story.append(PageBreak())

        # ── Page 4 — Caméras ────────────────────────────────────────────────
        story += self._cameras_page(data, styles)

        doc.build(story, onFirstPage=self._page_footer, onLaterPages=self._page_footer)
        return buffer.getvalue()

    # ── Couverture ───────────────────────────────────────────────────────────

    def _cover_page(self, data: ReportData, styles: dict) -> list:
        cadence_labels = {
            "daily": "Rapport Journalier", "weekly": "Rapport Hebdomadaire",
            "monthly": "Rapport Mensuel",  "on_demand": "Rapport Personnalisé",
        }
        period_fmt = f"{self._fmt_date(data.period_start)} — {self._fmt_date(data.period_end)}"

        return [
            Spacer(1, 30*mm),
            Paragraph("VISION GUARD", styles["cover_brand"]),
            Paragraph("AI Platform", styles["cover_subtitle"]),
            Spacer(1, 20*mm),
            HRFlowable(width="100%", thickness=1, color=VG_BLUE),
            Spacer(1, 8*mm),
            Paragraph(cadence_labels.get(data.cadence, "Rapport"), styles["cover_title"]),
            Paragraph(data.organization_name, styles["cover_org"]),
            Paragraph(period_fmt, styles["cover_period"]),
            Spacer(1, 8*mm),
            HRFlowable(width="100%", thickness=1, color=VG_BORDER),
            Spacer(1, 20*mm),

            # Résumé exécutif
            Paragraph("Résumé exécutif", styles["section_title"]),
            Spacer(1, 5*mm),
            self._summary_table(data),
        ]

    def _summary_table(self, data: ReportData) -> Table:
        cells = [
            ["Détections totales", "Événements", "Critiques", "Acquittés"],
            [
                str(data.total_detections),
                str(data.total_events),
                str(data.critical_events),
                str(data.acknowledged_events),
            ],
        ]
        t = Table(cells, colWidths=[42*mm]*4)
        t.setStyle(TableStyle([
            ("BACKGROUND",   (0,0), (-1,0), VG_SURFACE),
            ("TEXTCOLOR",    (0,0), (-1,0), VG_MUTED),
            ("FONTSIZE",     (0,0), (-1,0), 8),
            ("ALIGN",        (0,0), (-1,-1), "CENTER"),
            ("FONTSIZE",     (0,1), (-1,1), 22),
            ("TEXTCOLOR",    (0,1), (-1,1), VG_BLUE),
            ("FONTNAME",     (0,1), (-1,1), "Helvetica-Bold"),
            ("TOPPADDING",   (0,0), (-1,-1), 8),
            ("BOTTOMPADDING",(0,0), (-1,-1), 8),
            ("GRID",         (0,0), (-1,-1), 0.5, VG_BORDER),
            ("ROUNDEDCORNERS", [4]),
        ]))
        return t

    # ── Statistiques ─────────────────────────────────────────────────────────

    def _stats_page(self, data: ReportData, styles: dict) -> list:
        story = [Paragraph("Statistiques des détections", styles["section_title"]), Spacer(1, 5*mm)]

        # Sévérité breakdown
        sev_cells = [
            ["Sévérité",   "Événements", "Pourcentage"],
            ["🚨 Critique", str(data.critical_events), self._pct(data.critical_events, data.total_events)],
            ["⚠️  Warning",  str(data.warning_events),  self._pct(data.warning_events,  data.total_events)],
            ["ℹ️  Info",     str(data.info_events),      self._pct(data.info_events,     data.total_events)],
        ]
        sev_t = Table(sev_cells, colWidths=[60*mm, 40*mm, 40*mm])
        sev_t.setStyle(self._std_table_style(header_bg=VG_SURFACE))
        story += [sev_t, Spacer(1, 8*mm)]

        # Détections par type
        story.append(Paragraph("Détections par type", styles["section_title"]))
        story.append(Spacer(1, 5*mm))

        if data.detection_breakdown:
            det_cells = [["Type", "Détections", "Confiance moy."]]
            for d in data.detection_breakdown:
                det_cells.append([d.type.capitalize(), str(d.count), f"{d.avgConfidence:.1%}"])
            det_t = Table(det_cells, colWidths=[60*mm, 40*mm, 40*mm])
            det_t.setStyle(self._std_table_style(header_bg=VG_SURFACE))
            story.append(det_t)

            # Barre horizontale simple
            story.append(Spacer(1, 8*mm))
            story.append(Paragraph("Distribution visuelle", styles["label"]))
            story.append(Spacer(1, 3*mm))
            max_count = max(d.count for d in data.detection_breakdown) or 1
            for det in data.detection_breakdown[:8]:
                bar_w = int((det.count / max_count) * 120)
                bar_cells = [[
                    det.type.capitalize(),
                    f"{det.count}",
                    "█" * bar_w + "░" * (120 - bar_w),
                ]]
                bt = Table(bar_cells, colWidths=[40*mm, 15*mm, 95*mm])
                bt.setStyle(TableStyle([
                    ("FONTSIZE",     (0,0), (-1,-1), 7),
                    ("TEXTCOLOR",    (0,0), (1,-1), VG_MUTED),
                    ("TEXTCOLOR",    (2,0), (2,-1), VG_BLUE),
                    ("TOPPADDING",   (0,0), (-1,-1), 2),
                    ("BOTTOMPADDING",(0,0), (-1,-1), 2),
                ]))
                story.append(bt)

        return story

    # ── Top événements ───────────────────────────────────────────────────────

    def _events_page(self, data: ReportData, styles: dict) -> list:
        story = [Paragraph("Top événements", styles["section_title"]), Spacer(1, 5*mm)]

        if not data.top_events:
            story.append(Paragraph("Aucun événement sur la période.", styles["body"]))
            return story

        cells = [["Sévérité", "Type", "Caméra", "Durée", "Détections", "Statut"]]
        for ev in data.top_events:
            sev_label = {"critical":"🚨 Critique","warning":"⚠️ Warning","info":"ℹ️ Info"}.get(ev.severity, ev.severity)
            cells.append([
                sev_label,
                ev.primaryType.capitalize(),
                ev.cameraName[:20],
                f"{ev.durationSeconds}s",
                str(ev.detectionCount),
                "✅ Acquitté" if ev.acknowledged else "🔴 Ouvert",
            ])

        t = Table(cells, colWidths=[28*mm,28*mm,38*mm,18*mm,22*mm,28*mm])
        style = self._std_table_style(header_bg=VG_SURFACE)

        # Colorier les lignes critiques
        for i, ev in enumerate(data.top_events, start=1):
            if ev.severity == "critical":
                style.add("BACKGROUND", (0,i), (-1,i), colors.HexColor("#1F0E0E"))
            elif ev.severity == "warning":
                style.add("BACKGROUND", (0,i), (-1,i), colors.HexColor("#1C1500"))

        t.setStyle(style)
        story.append(t)
        return story

    # ── Caméras ──────────────────────────────────────────────────────────────

    def _cameras_page(self, data: ReportData, styles: dict) -> list:
        story = [Paragraph("Résumé par caméra", styles["section_title"]), Spacer(1, 5*mm)]

        cells = [["Caméra", "Statut", "Détections", "Événements"]]
        for cam in data.camera_summaries:
            status_label = "🟢 En ligne" if cam.status=="online" else "🔴 Hors ligne"
            cells.append([cam.name, status_label, str(cam.detectionCount), str(cam.eventCount)])

        t = Table(cells, colWidths=[60*mm,40*mm,30*mm,30*mm])
        t.setStyle(self._std_table_style(header_bg=VG_SURFACE))
        story.append(t)
        return story

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _page_footer(self, canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(VG_MUTED)
        canvas.drawString(20*mm, 12*mm, "Vision Guard AI Platform — Rapport confidentiel")
        canvas.drawRightString(A4[0]-20*mm, 12*mm, f"Page {doc.page}")
        canvas.restoreState()

    def _fmt_date(self, iso: str) -> str:
        try:
            return datetime.fromisoformat(iso.replace("Z","")).strftime("%d/%m/%Y")
        except Exception:
            return iso[:10]

    def _pct(self, part: int, total: int) -> str:
        if total == 0: return "0%"
        return f"{part/total:.0%}"

    def _std_table_style(self, header_bg=None) -> TableStyle:
        bg = header_bg or VG_SURFACE
        return TableStyle([
            ("BACKGROUND",    (0,0), (-1,0), bg),
            ("TEXTCOLOR",     (0,0), (-1,0), VG_MUTED),
            ("FONTSIZE",      (0,0), (-1,0), 8),
            ("FONTNAME",      (0,0), (-1,0), "Helvetica-Bold"),
            ("TEXTCOLOR",     (0,1), (-1,-1), VG_TEXT),
            ("FONTSIZE",      (0,1), (-1,-1), 9),
            ("ALIGN",         (0,0), (-1,-1), "LEFT"),
            ("ROWBACKGROUNDS",(0,1), (-1,-1), [VG_DARK, VG_SURFACE]),
            ("GRID",          (0,0), (-1,-1), 0.3, VG_BORDER),
            ("TOPPADDING",    (0,0), (-1,-1), 6),
            ("BOTTOMPADDING", (0,0), (-1,-1), 6),
            ("LEFTPADDING",   (0,0), (-1,-1), 6),
        ])

    def _build_styles(self) -> dict:
        base = getSampleStyleSheet()
        def s(name, **kw):
            return ParagraphStyle(name, parent=base["Normal"], **kw)
        return {
            "cover_brand":    s("cb",  fontSize=28, textColor=VG_BLUE, fontName="Helvetica-Bold", alignment=TA_LEFT),
            "cover_subtitle": s("cs",  fontSize=11, textColor=VG_MUTED, alignment=TA_LEFT, spaceAfter=4),
            "cover_title":    s("ct",  fontSize=22, textColor=VG_TEXT, fontName="Helvetica-Bold", alignment=TA_LEFT, spaceBefore=6),
            "cover_org":      s("co",  fontSize=14, textColor=VG_BLUE, alignment=TA_LEFT, spaceBefore=2),
            "cover_period":   s("cp",  fontSize=10, textColor=VG_MUTED, alignment=TA_LEFT, spaceBefore=2),
            "section_title":  s("st",  fontSize=13, textColor=VG_BLUE, fontName="Helvetica-Bold", spaceBefore=4, spaceAfter=2),
            "body":           s("bd",  fontSize=9,  textColor=VG_TEXT),
            "label":          s("lb",  fontSize=8,  textColor=VG_MUTED),
        }

    def _stub_pdf(self, data: ReportData) -> bytes:
        """PDF minimal quand reportlab n'est pas installé."""
        content = (
            f"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
            f"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
            f"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]"
            f"/Contents 4 0 R>>endobj\n"
            f"4 0 obj<</Length 44>>stream\nBT /F1 12 Tf 72 720 Td "
            f"(Vision Guard Report - {data.cadence}) Tj ET\nendstream\nendobj\n"
            f"xref\n0 5\ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n0\n%%EOF"
        )
        return content.encode()
