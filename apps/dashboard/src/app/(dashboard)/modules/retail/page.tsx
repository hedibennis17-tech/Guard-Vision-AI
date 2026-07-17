"use client";
import { useState } from "react";
import Link from "next/link";
import { RETAIL_CONFIG } from "@/lib/orchestrator/retailConfig";

type Tab = "overview"|"behaviors"|"shelves"|"analytics"|"checkout"|"reports";

export default function RetailPage() {
  const cfg = RETAIL_CONFIG;
  const [tab, setTab] = useState<Tab>("overview");

  const TABS: {id:Tab;label:string;icon:string}[] = [
    {id:"overview",   label:"Vue d'ensemble",    icon:"📊"},
    {id:"behaviors",  label:"Comportements",     icon:"👁️"},
    {id:"shelves",    label:"Rayons",            icon:"📦"},
    {id:"analytics",  label:"Analytics",         icon:"📈"},
    {id:"checkout",   label:"Caisses",           icon:"💰"},
    {id:"reports",    label:"Rapports",          icon:"📄"},
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="border-b border-slate-800 px-6 py-4">
        <div className="flex items-center gap-3 mb-3">
          <Link href="/modules" className="text-slate-400 hover:text-white">←</Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl text-2xl" style={{background:"#10B98120",border:"1px solid #10B98130"}}>🛒</div>
          <div>
            <h1 className="text-lg font-bold text-white">{cfg.module.name}</h1>
            <p className="text-xs text-slate-500">{cfg.module.description}</p>
          </div>
          <Link href="/modules/retail" className="ml-auto rounded-xl px-4 py-2 text-sm font-semibold text-black" style={{background:"#10B981"}}>
            📷 Tester la caméra
          </Link>
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap ${tab===t.id?"text-emerald-400 border border-emerald-800/40 bg-emerald-900/10":"text-slate-400 hover:text-white"}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-6">
        {tab==="overview"&&(
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
            {[
              {label:"Types personnes",  value:cfg.people.length,                icon:"👥"},
              {label:"Comportements",    value:cfg.suspicious_behaviors.length,  icon:"👁️"},
              {label:"Analytics rayons", value:cfg.shelf_analytics.length,       icon:"📦"},
              {label:"Analytics clients",value:cfg.customer_analytics.length,    icon:"📊"},
            ].map(k=>(
              <div key={k.label} className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-center">
                <span className="text-3xl block mb-1">{k.icon}</span>
                <p className="text-2xl font-bold text-emerald-400">{k.value}</p>
                <p className="text-xs text-slate-500">{k.label}</p>
              </div>
            ))}
          </div>
        )}
        {tab==="behaviors"&&(
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-white">Comportements suspects ({cfg.suspicious_behaviors.length})</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {cfg.suspicious_behaviors.map(b=>(
                <div key={b.id} className={`flex items-center gap-3 rounded-xl border p-3 ${b.severity==="critical"?"border-red-800/40 bg-red-900/10":"border-amber-800/40 bg-amber-900/10"}`}>
                  <span className="text-2xl shrink-0">{b.icon}</span>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-white">{b.label}</p>
                    <span className={`text-xs font-bold ${b.severity==="critical"?"text-red-400":"text-amber-400"}`}>{b.severity==="critical"?"🔴 CRITIQUE":"🟡 ALERTE"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab==="shelves"&&(
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-white">Analytics rayons</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {cfg.shelf_analytics.map(s=>(
                <div key={s.id} className={`flex items-center gap-3 rounded-xl border p-3 ${s.auto_alert?"border-amber-800/40 bg-amber-900/10":"border-slate-800 bg-slate-900"}`}>
                  <span className="text-2xl">{s.icon}</span>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-white">{s.label}</p>
                    {s.auto_alert&&<p className="text-xs text-amber-400">Alerte automatique</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab==="analytics"&&(
          <div>
            <h2 className="text-base font-semibold text-white mb-4">Analytics clients ({cfg.customer_analytics.length})</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {cfg.customer_analytics.map(a=>(
                <div key={a.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <span className="text-2xl block mb-2">{a.icon}</span>
                  <p className="text-xs text-slate-500 mb-1">{a.label}</p>
                  <p className="text-xl font-bold text-emerald-400">—</p>
                  <p className="text-xs text-slate-600">{a.unit}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab==="checkout"&&(
          <div>
            <h2 className="text-base font-semibold text-white mb-4">Surveillance caisses</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {cfg.checkout_monitoring.map(c=>(
                <div key={c.id} className={`flex items-center gap-3 rounded-xl border p-3 ${c.severity==="critical"?"border-red-800/40 bg-red-900/10":c.severity==="warning"?"border-amber-800/40 bg-amber-900/10":"border-slate-800 bg-slate-900"}`}>
                  <span className="text-2xl">{c.icon}</span>
                  <p className="text-xs font-medium text-white">{c.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab==="reports"&&(
          <div>
            <h2 className="text-base font-semibold text-white mb-4">Rapports</h2>
            <div className="space-y-2">
              {cfg.reports.map(r=>(
                <div key={r.id} className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <span className="text-2xl">{r.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{r.label}</p>
                    <p className="text-xs text-slate-500">{r.freq==="daily"?"Quotidien":r.freq==="weekly"?"Hebdomadaire":r.freq==="monthly"?"Mensuel":"À chaque événement"}</p>
                  </div>
                  <button className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:border-emerald-700 hover:text-emerald-400">Générer</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
