"use client";
import { useState } from "react";
import Link from "next/link";
import { TRAFFIC_CONFIG } from "@/lib/orchestrator/trafficConfig";

type Tab = "overview"|"vehicles"|"violations"|"incidents"|"plates"|"analytics";

export default function TrafficPage() {
  const cfg = TRAFFIC_CONFIG;
  const [tab, setTab] = useState<Tab>("overview");

  const TABS: {id:Tab;label:string;icon:string}[] = [
    {id:"overview",   label:"Vue d'ensemble",  icon:"📊"},
    {id:"vehicles",   label:"Véhicules",       icon:"🚗"},
    {id:"violations", label:"Infractions",     icon:"🚦"},
    {id:"incidents",  label:"Accidents",       icon:"💥"},
    {id:"plates",     label:"Plaques OCR",     icon:"🔤"},
    {id:"analytics",  label:"Analytics",       icon:"📈"},
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="border-b border-slate-800 px-6 py-4">
        <div className="flex items-center gap-3 mb-3">
          <Link href="/modules" className="text-slate-400 hover:text-white">←</Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl text-2xl" style={{background:"#8B5CF620",border:"1px solid #8B5CF630"}}>🚗</div>
          <div>
            <h1 className="text-lg font-bold text-white">{cfg.module.name}</h1>
            <p className="text-xs text-slate-500">{cfg.module.description}</p>
          </div>
          <Link href="/modules/transportation" className="ml-auto rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{background:"#8B5CF6"}}>
            📷 Tester la caméra
          </Link>
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap ${tab===t.id?"text-violet-400 border border-violet-800/40 bg-violet-900/10":"text-slate-400 hover:text-white"}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-6">
        {tab==="overview"&&(
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 mb-6">
            {[
              {label:"Types véhicules",  value:cfg.vehicles.length,   icon:"🚗"},
              {label:"Infractions",      value:cfg.violations.length, icon:"🚦"},
              {label:"Types incidents",  value:cfg.incidents.length,  icon:"💥"},
              {label:"OCR Plaques",      value:cfg.license_plate.length,icon:"🔤"},
              {label:"Analytics",        value:cfg.analytics.length,  icon:"📈"},
              {label:"Zones",            value:cfg.zones.length,      icon:"📍"},
            ].map(k=>(
              <div key={k.label} className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-center">
                <span className="text-3xl block mb-1">{k.icon}</span>
                <p className="text-2xl font-bold text-violet-400">{k.value}</p>
                <p className="text-xs text-slate-500">{k.label}</p>
              </div>
            ))}
          </div>
        )}
        {tab==="vehicles"&&(
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {cfg.vehicles.map(v=>(
              <div key={v.id} className={`rounded-xl border p-3 ${(v as any).severity==="critical"?"border-red-800/40 bg-red-900/10":"border-slate-800 bg-slate-900"}`}>
                <span className="text-3xl block mb-2">{v.icon}</span>
                <p className="text-xs font-medium text-white">{v.label}</p>
                {(v as any).count_weight&&<p className="text-xs text-slate-500">Poids: ×{(v as any).count_weight}</p>}
                {(v as any).severity&&<p className="text-xs text-red-400">🚨 Prioritaire</p>}
              </div>
            ))}
          </div>
        )}
        {tab==="violations"&&(
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {cfg.violations.map(v=>(
              <div key={v.id} className={`flex items-center gap-3 rounded-xl border p-3 ${v.severity==="critical"?"border-red-800/40 bg-red-900/10":v.severity==="warning"?"border-amber-800/40 bg-amber-900/10":"border-slate-800 bg-slate-900"}`}>
                <span className="text-2xl">{v.icon}</span>
                <div className="flex-1">
                  <p className="text-xs font-medium text-white">{v.label}</p>
                  <span className={`text-xs ${v.severity==="critical"?"text-red-400":"text-amber-400"}`}>{v.severity==="critical"?"🔴":"🟡"} {v.fine?"PV automatique":""}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab==="incidents"&&(
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {cfg.incidents.map(i=>(
              <div key={i.id} className={`flex items-center gap-3 rounded-xl border p-3 ${i.severity==="critical"?"border-red-800/40 bg-red-900/10":"border-amber-800/40 bg-amber-900/10"}`}>
                <span className="text-2xl">{i.icon}</span>
                <div className="flex-1">
                  <p className="text-xs font-medium text-white">{i.label}</p>
                  <p className="text-xs text-slate-500">Réponse: {i.response_time}</p>
                </div>
                <span className={`text-xs font-bold ${i.severity==="critical"?"text-red-400":"text-amber-400"}`}>{i.severity==="critical"?"CRITIQUE":"ALERTE"}</span>
              </div>
            ))}
          </div>
        )}
        {tab==="plates"&&(
          <div>
            <h2 className="text-base font-semibold text-white mb-4">Reconnaissance de plaques — PaddleOCR</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {cfg.license_plate.map(p=>(
                <div key={p.id} className={`flex items-center gap-3 rounded-xl border p-3 ${(p as any).alert?"border-red-800/40 bg-red-900/10":p.status==="coming_soon"?"border-slate-700 bg-slate-900 opacity-60":"border-slate-800 bg-slate-900"}`}>
                  <span className="text-2xl">{p.icon}</span>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-white">{p.label}</p>
                    <span className={`text-xs ${p.status==="active"?"text-emerald-400":"text-slate-500"}`}>{p.status==="active"?"✅ Actif":"🔜 Bientôt"}</span>
                  </div>
                  {(p as any).alert&&<span className="text-xs text-red-400 font-bold">ALERTE</span>}
                </div>
              ))}
            </div>
          </div>
        )}
        {tab==="analytics"&&(
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {cfg.analytics.map(a=>(
              <div key={a.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <span className="text-2xl block mb-2">{a.icon}</span>
                <p className="text-xs text-slate-500 mb-1">{a.label}</p>
                <p className="text-xl font-bold text-violet-400">—</p>
                <p className="text-xs text-slate-600">{a.unit}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
