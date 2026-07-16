"use client";

import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";

// ─── Données démo ─────────────────────────────────────────────────────────────
const TREND_DATA = [
  { date:"09 juil", detections:98,  events:18, critical:1 },
  { date:"10 juil", detections:124, events:24, critical:2 },
  { date:"11 juil", detections:87,  events:15, critical:0 },
  { date:"12 juil", detections:156, events:31, critical:4 },
  { date:"13 juil", detections:142, events:28, critical:3 },
  { date:"14 juil", detections:189, events:37, critical:5 },
  { date:"15 juil", detections:134, events:26, critical:2 },
];

const TYPE_DATA = [
  { type:"Personnes", count:523, color:"#0EA5E9", pct:60 },
  { type:"Véhicules",  count:187, color:"#8B5CF6", pct:22 },
  { type:"Animaux",   count:73,  color:"#F59E0B", pct:8  },
  { type:"Feu/Fumée", count:18,  color:"#EF4444", pct:2  },
  { type:"Autres",    count:69,  color:"#64748B", pct:8  },
];

const CAMERA_DATA = [
  { name:"Entrée principale", detections:312, events:48, status:"online" },
  { name:"Parking",           detections:187, events:31, status:"online" },
  { name:"Entrepôt",          detections:168, events:29, status:"online" },
  { name:"Couloir A",         detections:121, events:19, status:"online" },
  { name:"Cour arrière",      detections:82,  events:12, status:"offline"},
];

// Heatmap [7 jours][24 heures]
const HEATMAP_DATA: number[][] = [
  [0,0,0,0,0,1,2,5,8,6,4,3,5,7,6,4,3,5,8,9,7,4,2,1],
  [0,0,0,0,0,0,1,3,6,7,5,4,6,8,7,5,4,6,9,11,8,5,2,0],
  [0,0,0,0,0,1,1,4,7,8,6,5,7,9,8,6,5,7,10,12,9,6,3,1],
  [0,0,0,0,0,0,2,4,7,9,7,5,8,10,9,7,5,8,11,13,10,7,3,1],
  [0,0,0,0,0,1,2,5,9,10,8,6,9,11,10,8,6,9,12,14,11,8,4,1],
  [1,0,0,0,0,1,3,8,12,14,11,9,12,15,13,11,9,12,15,18,14,10,6,3],
  [1,0,0,0,0,2,4,9,13,15,12,10,13,16,14,12,10,13,16,19,15,11,7,4],
];

const DAYS   = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
const HOURS  = Array.from({length:24},(_,i)=>i%6===0?`${i}h`:"");

type Period = "7d" | "30d" | "90d";

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("7d");
  const maxDetections = Math.max(...TREND_DATA.map((d) => d.detections));
  const maxHeatmap    = Math.max(...HEATMAP_DATA.flat());

  const heatmapColor = (val: number): string => {
    if (val === 0) return "#0F172A";
    const intensity = val / maxHeatmap;
    if (intensity < 0.25) return "#0C4A6E";
    if (intensity < 0.50) return "#0369A1";
    if (intensity < 0.75) return "#0EA5E9";
    return "#38BDF8";
  };

  // Totaux agrégés
  const totalDetections = TREND_DATA.reduce((s,d) => s+d.detections, 0);
  const totalEvents     = TREND_DATA.reduce((s,d) => s+d.events,     0);
  const totalCritical   = TREND_DATA.reduce((s,d) => s+d.critical,   0);
  const avgPerDay       = Math.round(totalDetections / TREND_DATA.length);

  return (
    <div>
      <PageHeader title="Analytics" description="Graphiques, statistiques et heatmaps de détection." />

      {/* Sélecteur de période */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
          {(["7d","30d","90d"] as Period[]).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${period===p ? "bg-brand text-white" : "text-slate-400 hover:text-white"}`}>
              {p==="7d" ? "7 jours" : p==="30d" ? "30 jours" : "90 jours"}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500">Données actualisées à 23h55 · Firestore `analytics`</span>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label:"Détections totales", value:totalDetections, trend:"+12%", up:true  },
          { label:"Événements",          value:totalEvents,     trend:"+8%",  up:true  },
          { label:"Critiques",           value:totalCritical,   trend:"-25%", up:false },
          { label:"Moy. / jour",         value:avgPerDay,       trend:"+5%",  up:true  },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-xs text-slate-500">{kpi.label}</p>
            <p className="mt-2 text-3xl font-semibold text-white">{kpi.value.toLocaleString()}</p>
            <p className={`mt-1 text-xs font-medium ${kpi.up ? "text-emerald-400" : "text-red-400"}`}>
              {kpi.trend} vs période précédente
            </p>
          </div>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* ── Graphique Tendance (2/3) ───────────────────────────────────── */}
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-4 text-sm font-medium text-slate-300">Détections par jour</h2>
          <div className="relative h-48">
            {/* Lignes de grille */}
            {[0,25,50,75,100].map((pct) => (
              <div key={pct} className="absolute left-0 right-0 flex items-center gap-2"
                style={{bottom:`${pct}%`}}>
                <span className="w-6 shrink-0 text-right text-xs text-slate-700">
                  {Math.round(maxDetections * pct / 100)}
                </span>
                <div className="flex-1 border-t border-slate-800/60" />
              </div>
            ))}
            {/* Barres */}
            <div className="absolute inset-0 ml-8 flex items-end gap-1.5">
              {TREND_DATA.map((d) => {
                const h = Math.round((d.detections / maxDetections) * 100);
                const hc = Math.round((d.critical  / maxDetections) * 100);
                return (
                  <div key={d.date} className="group relative flex flex-1 flex-col items-center">
                    {/* Tooltip */}
                    <div className="pointer-events-none absolute -top-14 left-1/2 z-10 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 whitespace-nowrap">
                      <p className="font-medium">{d.date}</p>
                      <p className="text-slate-400">{d.detections} détections · {d.events} events</p>
                    </div>
                    {/* Barre critiques (superposée) */}
                    <div className="absolute bottom-0 left-0 right-0 rounded-t bg-red-500/40"
                      style={{height:`${hc}%`}} />
                    {/* Barre principale */}
                    <div className="w-full rounded-t bg-brand transition-all"
                      style={{height:`${h}%`}} />
                  </div>
                );
              })}
            </div>
          </div>
          {/* Axe X */}
          <div className="mt-2 ml-8 flex gap-1.5">
            {TREND_DATA.map((d) => (
              <div key={d.date} className="flex-1 text-center text-xs text-slate-600">{d.date.slice(0,6)}</div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded bg-brand" />Détections</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded bg-red-500/40" />Critiques</span>
          </div>
        </div>

        {/* ── Répartition par type (1/3) ────────────────────────────────── */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-4 text-sm font-medium text-slate-300">Répartition par type</h2>
          {/* Donut SVG simple */}
          <div className="flex justify-center mb-4">
            <svg viewBox="0 0 100 100" className="h-32 w-32 -rotate-90">
              {(() => {
                let offset = 0;
                return TYPE_DATA.map((d) => {
                  const circ   = 2 * Math.PI * 35;
                  const stroke = (d.pct / 100) * circ;
                  const dash   = `${stroke} ${circ - stroke}`;
                  const el     = (
                    <circle key={d.type} cx="50" cy="50" r="35"
                      fill="none" strokeWidth="20"
                      stroke={d.color}
                      strokeDasharray={dash}
                      strokeDashoffset={-offset}
                    />
                  );
                  offset += stroke;
                  return el;
                });
              })()}
            </svg>
          </div>
          <div className="space-y-2">
            {TYPE_DATA.map((d) => (
              <div key={d.type} className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{background:d.color}} />
                <span className="flex-1 text-xs text-slate-400">{d.type}</span>
                <span className="text-xs font-medium text-white">{d.count}</span>
                <span className="text-xs text-slate-600">{d.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Heatmap ─────────────────────────────────────────────────────────── */}
      <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-300">Heatmap d'activité — semaine du 7 au 13 juillet</h2>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Faible</span>
            {["#0C4A6E","#0369A1","#0EA5E9","#38BDF8"].map((c) => (
              <div key={c} className="h-3 w-6 rounded" style={{background:c}} />
            ))}
            <span>Élevé</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-max">
            {/* Heure labels */}
            <div className="mb-1 ml-10 grid gap-px" style={{gridTemplateColumns:`repeat(24, 1fr)`, width:"600px"}}>
              {HOURS.map((h, i) => (
                <div key={i} className="text-center text-xs text-slate-600">{h}</div>
              ))}
            </div>
            {HEATMAP_DATA.map((row, dayIdx) => (
              <div key={dayIdx} className="flex items-center gap-2 mb-0.5">
                <span className="w-8 shrink-0 text-right text-xs text-slate-500">{DAYS[dayIdx]}</span>
                <div className="grid gap-px" style={{gridTemplateColumns:`repeat(24, 1fr)`, width:"600px"}}>
                  {row.map((val, hourIdx) => (
                    <div key={hourIdx} title={`${DAYS[dayIdx]} ${hourIdx}h : ${val} détections`}
                      className="h-5 rounded-sm cursor-default transition-transform hover:scale-110"
                      style={{background: heatmapColor(val)}}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Performance par caméra ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="border-b border-slate-800 px-5 py-3">
          <h2 className="text-sm font-medium text-slate-300">Performance par caméra</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 text-xs text-slate-500">
            <tr>
              <th className="px-5 py-3">Caméra</th>
              <th className="px-5 py-3">Statut</th>
              <th className="px-5 py-3">Détections</th>
              <th className="px-5 py-3">Événements</th>
              <th className="px-5 py-3">Activité</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {CAMERA_DATA.map((cam) => {
              const maxDet = Math.max(...CAMERA_DATA.map((c) => c.detections));
              const barW   = Math.round((cam.detections / maxDet) * 100);
              return (
                <tr key={cam.name} className="hover:bg-slate-800/50">
                  <td className="px-5 py-3 font-medium text-white">{cam.name}</td>
                  <td className="px-5 py-3">
                    <span className={`flex items-center gap-1.5 text-xs ${cam.status==="online" ? "text-emerald-400" : "text-slate-500"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${cam.status==="online" ? "bg-emerald-500" : "bg-slate-600"}`} />
                      {cam.status==="online" ? "En ligne" : "Hors ligne"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-white">{cam.detections.toLocaleString()}</td>
                  <td className="px-5 py-3 text-slate-300">{cam.events}</td>
                  <td className="px-5 py-3 w-40">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-800">
                        <div className="h-1.5 rounded-full bg-brand" style={{width:`${barW}%`}} />
                      </div>
                      <span className="text-xs text-slate-500 w-7">{barW}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
