"use client";

import { useState } from "react";

type Cadence = "daily" | "weekly" | "monthly";
const LABELS: Record<Cadence, string> = { daily:"Journalier", weekly:"Hebdomadaire", monthly:"Mensuel" };
const ICONS:  Record<Cadence, string> = { daily:"📅", weekly:"📆", monthly:"🗓️" };

const DEMO = [
  { id:"r1", cadence:"daily"   as Cadence, period:"14 juil. 2026",              events:28, detections:142, url:"#" },
  { id:"r2", cadence:"weekly"  as Cadence, period:"8 – 14 juil. 2026",          events:174, detections:891, url:"#" },
  { id:"r3", cadence:"monthly" as Cadence, period:"Juin 2026",                  events:687, detections:3420, url:"#" },
];

export default function ReportsPage() {
  const [generating, setGenerating] = useState<Cadence | null>(null);
  const [reports]    = useState(DEMO);

  async function generate(cadence: Cadence) {
    setGenerating(cadence);
    await new Promise((r) => setTimeout(r, 2000));
    setGenerating(null);
  }

  return (
    <div className="px-4 pt-8">
      <h1 className="mb-6 text-xl font-semibold">Rapports</h1>

      {/* Boutons de génération */}
      <div className="mb-6 space-y-2">
        {(["daily","weekly","monthly"] as Cadence[]).map((c) => (
          <button key={c} onClick={() => generate(c)} disabled={generating !== null}
            className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 disabled:opacity-50">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{ICONS[c]}</span>
              <span className="text-sm font-medium">Rapport {LABELS[c]}</span>
            </div>
            {generating === c
              ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              : <span className="text-xs text-blue-600 font-medium">Générer PDF</span>
            }
          </button>
        ))}
      </div>

      {/* Historique */}
      <h2 className="mb-3 text-sm font-medium text-slate-500">Historique</h2>
      <div className="space-y-2">
        {reports.map((r) => (
          <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span>{ICONS[r.cadence]}</span>
                <span className="text-sm font-medium">{LABELS[r.cadence]}</span>
              </div>
              <div className="flex gap-2">
                <a href={r.url} className="rounded-lg bg-blue-50 px-2 py-1 text-xs text-blue-600">📥 PDF</a>
                <button className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600">🔗 Partager</button>
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-2">{r.period}</p>
            <div className="flex gap-4 text-xs text-slate-500">
              <span>{r.detections} détections</span>
              <span>·</span>
              <span>{r.events} événements</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
