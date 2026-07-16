"use client";

import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";

type Cadence = "daily" | "weekly" | "monthly" | "on_demand";
type Status  = "ready" | "generating" | "pending" | "error";

interface ReportItem {
  id: string;
  cadence: Cadence;
  periodStart: string;
  periodEnd:   string;
  createdAt:   string;
  status:      Status;
  fileUrl?:    string;
  summary?: { totalDetections: number; totalEvents: number; criticalEvents: number };
}

const CADENCE_LABELS: Record<Cadence, string> = {
  daily:     "Journalier",
  weekly:    "Hebdomadaire",
  monthly:   "Mensuel",
  on_demand: "Personnalisé",
};
const CADENCE_ICONS: Record<Cadence, string> = {
  daily:"📅", weekly:"📆", monthly:"🗓️", on_demand:"🔍",
};

const STATUS_STYLES: Record<Status, string> = {
  ready:      "text-emerald-400 bg-emerald-400/10 border-emerald-800",
  generating: "text-brand bg-brand/10 border-brand/30",
  pending:    "text-amber-400 bg-amber-400/10 border-amber-800",
  error:      "text-red-400 bg-red-400/10 border-red-800",
};

const DEMO_REPORTS: ReportItem[] = [
  {
    id:"r1", cadence:"daily",     periodStart:"2026-07-14", periodEnd:"2026-07-15",
    createdAt:"Aujourd'hui 00:00", status:"ready", fileUrl:"#",
    summary:{ totalDetections:142, totalEvents:28, criticalEvents:3 },
  },
  {
    id:"r2", cadence:"weekly",    periodStart:"2026-07-08", periodEnd:"2026-07-14",
    createdAt:"Lundi 00:00",       status:"ready", fileUrl:"#",
    summary:{ totalDetections:891, totalEvents:174, criticalEvents:12 },
  },
  {
    id:"r3", cadence:"monthly",   periodStart:"2026-06-01", periodEnd:"2026-06-30",
    createdAt:"1 juil. 00:00",    status:"ready", fileUrl:"#",
    summary:{ totalDetections:3420, totalEvents:687, criticalEvents:41 },
  },
  {
    id:"r4", cadence:"on_demand", periodStart:"2026-07-10", periodEnd:"2026-07-15",
    createdAt:"il y a 2h",        status:"ready", fileUrl:"#",
    summary:{ totalDetections:312, totalEvents:62, criticalEvents:8 },
  },
];

export default function ReportsPage() {
  const [reports,       setReports]       = useState<ReportItem[]>(DEMO_REPORTS);
  const [customStart,   setCustomStart]   = useState("2026-07-01");
  const [customEnd,     setCustomEnd]     = useState("2026-07-15");
  const [generating,    setGenerating]    = useState<Cadence | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);

  async function handleGenerate(cadence: Cadence) {
    setGenerating(cadence);

    // Simuler la génération (en production: appeler Cloud Function generateReport)
    const newReport: ReportItem = {
      id: `r${Date.now()}`,
      cadence,
      periodStart: cadence === "on_demand" ? customStart : "2026-07-14",
      periodEnd:   cadence === "on_demand" ? customEnd   : "2026-07-15",
      createdAt:   "à l'instant",
      status:      "generating",
    };
    setReports((p) => [newReport, ...p]);

    await new Promise((r) => setTimeout(r, 2500));

    setReports((p) =>
      p.map((r) =>
        r.id === newReport.id
          ? { ...r, status:"ready", fileUrl:"#", summary:{ totalDetections:142, totalEvents:28, criticalEvents:3 } }
          : r
      )
    );
    setGenerating(null);
  }

  return (
    <div>
      <PageHeader title="Reports" description="Génération automatique et à la demande — PDF journalier, hebdo, mensuel." />

      {/* Génération rapide */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(["daily","weekly","monthly","on_demand"] as Cadence[]).map((cadence) => (
          <div key={cadence} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-2xl">{CADENCE_ICONS[cadence]}</span>
              <span className="text-sm font-medium text-white">{CADENCE_LABELS[cadence]}</span>
            </div>
            <p className="mb-4 text-xs text-slate-500">
              {cadence === "daily"     && "Rapport des dernières 24h"}
              {cadence === "weekly"    && "Rapport des 7 derniers jours"}
              {cadence === "monthly"   && "Rapport du mois en cours"}
              {cadence === "on_demand" && "Choisissez la période manuellement"}
            </p>
            {cadence === "on_demand" && (
              <div className="mb-3 space-y-2">
                <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-300" />
                <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-300" />
              </div>
            )}
            <button
              onClick={() => handleGenerate(cadence)}
              disabled={generating !== null}
              className="w-full rounded-lg bg-brand py-2 text-xs font-medium text-white disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {generating === cadence ? (
                <><div className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" /> Génération...</>
              ) : (
                "Générer PDF"
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Liste des rapports */}
      <div className="flex gap-6">
        <div className="flex-1 rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
          <div className="border-b border-slate-800 px-5 py-3">
            <span className="text-sm font-medium text-slate-300">Historique des rapports</span>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 text-xs text-slate-500">
              <tr>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Période</th>
                <th className="px-5 py-3">Créé</th>
                <th className="px-5 py-3">Statut</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {reports.map((report) => (
                <tr
                  key={report.id}
                  onClick={() => setSelectedReport(report)}
                  className={`cursor-pointer transition-colors hover:bg-slate-800/50 ${selectedReport?.id === report.id ? "bg-brand/5" : ""}`}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span>{CADENCE_ICONS[report.cadence]}</span>
                      <span className="text-slate-300">{CADENCE_LABELS[report.cadence]}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-400 text-xs">
                    {report.periodStart} → {report.periodEnd}
                  </td>
                  <td className="px-5 py-3 text-slate-500 text-xs">{report.createdAt}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLES[report.status]}`}>
                      {report.status === "generating" && (
                        <span className="mr-1 inline-block h-2 w-2 animate-spin rounded-full border border-current border-t-transparent" />
                      )}
                      {report.status === "ready"      ? "✅ Prêt"       : ""}
                      {report.status === "generating" ? "Génération..."  : ""}
                      {report.status === "pending"    ? "⏳ En attente"  : ""}
                      {report.status === "error"      ? "❌ Erreur"      : ""}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      {report.fileUrl && report.status === "ready" && (
                        <>
                          <a href={report.fileUrl} target="_blank"
                            className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:text-white"
                            onClick={(e) => e.stopPropagation()}>
                            📥 PDF
                          </a>
                          <button
                            className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:text-white"
                            onClick={(e) => e.stopPropagation()}>
                            🔗 Partager
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Panneau de détail */}
        {selectedReport && selectedReport.summary && (
          <div className="w-72 shrink-0 rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="text-2xl">{CADENCE_ICONS[selectedReport.cadence]}</span>
              <div>
                <p className="text-sm font-medium text-white">{CADENCE_LABELS[selectedReport.cadence]}</p>
                <p className="text-xs text-slate-500">{selectedReport.periodStart} → {selectedReport.periodEnd}</p>
              </div>
            </div>

            <div className="mb-4 space-y-3">
              {[
                { label:"Détections totales",  value: selectedReport.summary.totalDetections },
                { label:"Événements",           value: selectedReport.summary.totalEvents     },
                { label:"Critiques",            value: selectedReport.summary.criticalEvents, danger: true },
              ].map(({ label, value, danger }) => (
                <div key={label} className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2">
                  <span className="text-xs text-slate-400">{label}</span>
                  <span className={`text-sm font-semibold ${danger && value > 0 ? "text-red-400" : "text-white"}`}>
                    {value}
                  </span>
                </div>
              ))}
            </div>

            {selectedReport.fileUrl && (
              <a href={selectedReport.fileUrl} target="_blank"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand py-2 text-sm font-medium text-white">
                📄 Télécharger le PDF
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
