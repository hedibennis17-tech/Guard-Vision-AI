"use client";

import { useState } from "react";
import Link from "next/link";
import { INDUSTRIAL_CONFIG } from "@/lib/orchestrator/industrialConfig";

type Tab = "overview"|"zones"|"machines"|"ppe"|"hazards"|"behavior"|"vehicles"|"analytics"|"reports"|"advanced";

const TABS: {id:Tab;label:string;icon:string}[] = [
  {id:"overview",  label:"Vue d'ensemble",    icon:"📊"},
  {id:"zones",     label:"Zones & Accès",     icon:"📍"},
  {id:"machines",  label:"Machines",          icon:"⚙️"},
  {id:"ppe",       label:"EPI / PPE",         icon:"⛑️"},
  {id:"hazards",   label:"Risques",           icon:"⚠️"},
  {id:"behavior",  label:"Comportements",     icon:"👁️"},
  {id:"vehicles",  label:"Véhicules",         icon:"🏭"},
  {id:"analytics", label:"Analytics",         icon:"📈"},
  {id:"reports",   label:"Rapports",          icon:"📄"},
  {id:"advanced",  label:"Modules IA",        icon:"🚀"},
];

export default function IndustrialPage() {
  const cfg = INDUSTRIAL_CONFIG;
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 px-6 py-4">
        <div className="flex items-center gap-3 mb-3">
          <Link href="/modules" className="text-slate-400 hover:text-white text-lg">←</Link>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-3xl"
            style={{background:"#EF444420",border:"1px solid #EF444430"}}>
            {cfg.module.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white">{cfg.module.name}</h1>
              <span className="rounded-full border border-amber-700 bg-amber-900/20 px-2 py-0.5 text-xs text-amber-400">
                {cfg.module.status}
              </span>
            </div>
            <p className="text-xs text-slate-500">{cfg.module.description}</p>
          </div>
          <Link href="/modules/industrial" className="ml-auto rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{background:"#EF4444"}}>
            📷 Tester la caméra
          </Link>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                tab===t.id
                  ? "text-red-400 border border-red-800/40 bg-red-900/10"
                  : "text-slate-400 hover:text-white"
              }`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">

        {/* ── VUE D'ENSEMBLE ── */}
        {tab==="overview" && (
          <div>
            <p className="text-sm text-slate-400 mb-6 italic">"{cfg.module.goal}"</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 mb-6">
              {[
                {label:"Zones accès",        value:cfg.access_zones.length,          icon:"🚪", color:"text-blue-400"  },
                {label:"Types machines",     value:cfg.machines.length,              icon:"⚙️", color:"text-red-400"   },
                {label:"EPI surveillés",     value:cfg.ppe.length,                   icon:"⛑️", color:"text-amber-400" },
                {label:"Zones dangereuses",  value:cfg.danger_zones.length,          icon:"⚠️", color:"text-red-400"   },
                {label:"Risques comport.",   value:cfg.behavioral_risks.length,      icon:"👁️", color:"text-orange-400"},
                {label:"Véhicules industr.", value:cfg.industrial_vehicles.length,   icon:"🏭", color:"text-slate-300" },
                {label:"Analytics HSE",      value:cfg.analytics.length,             icon:"📊", color:"text-emerald-400"},
                {label:"Niveaux d'alerte",   value:cfg.alert_levels.length,          icon:"🚨", color:"text-red-400"   },
                {label:"Types rapports",     value:cfg.reports.length,              icon:"📄", color:"text-slate-300" },
                {label:"Modules avancés",    value:cfg.advanced_modules.length,      icon:"🚀", color:"text-purple-400"},
              ].map(k=>(
                <div key={k.label} className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-center">
                  <span className="text-2xl block mb-1">{k.icon}</span>
                  <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
                  <p className="text-xs text-slate-500">{k.label}</p>
                </div>
              ))}
            </div>

            {/* Niveaux d'alerte */}
            <h3 className="text-sm font-semibold text-slate-300 mb-3">🚨 Niveaux d'alerte & Actions</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {cfg.alert_levels.map(a=>(
                <div key={a.id} className="rounded-xl border border-slate-800 bg-slate-900 p-3 flex items-center gap-3">
                  <span className="text-2xl shrink-0">{a.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold" style={{color:a.color}}>{a.label}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {a.notify.length>0?a.notify.join(" · "):"Log seulement"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ZONES & ACCÈS ── */}
        {tab==="zones" && (
          <div className="space-y-6">
            <Section title="🚪 Zones d'accès" count={cfg.access_zones.length}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {cfg.access_zones.map(z=>(
                  <ZoneCard key={z.id} icon={z.icon} label={z.label}/>
                ))}
              </div>
            </Section>
            <Section title="🏭 Lignes de production" count={cfg.production_lines.length}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {cfg.production_lines.map(z=>(
                  <ZoneCard key={z.id} icon={z.icon} label={z.label}/>
                ))}
              </div>
            </Section>
            <Section title="📦 Zones de stockage" count={cfg.storage_zones.length}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {cfg.storage_zones.map(z=>(
                  <ZoneCard key={z.id} icon={z.icon} label={z.label}/>
                ))}
              </div>
            </Section>
            <Section title="⚡ Zones électriques" count={cfg.electrical_zones.length}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {cfg.electrical_zones.map(z=>(
                  <div key={z.id} className={`rounded-xl border p-3 ${z.severity==="critical"?"border-red-800/40 bg-red-900/10":"border-amber-800/40 bg-amber-900/10"}`}>
                    <span className="text-2xl block mb-1">{z.icon}</span>
                    <p className="text-xs font-medium text-white">{z.label}</p>
                    <p className="text-xs text-slate-500">{z.voltage}</p>
                  </div>
                ))}
              </div>
            </Section>
            <Section title="🔥 Sécurité incendie" count={cfg.fire_safety.length}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {cfg.fire_safety.map(z=>(
                  <ZoneCard key={z.id} icon={z.icon} label={z.label}/>
                ))}
              </div>
            </Section>
            <Section title="⚠️ Zones dangereuses" count={cfg.danger_zones.length}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {cfg.danger_zones.map(z=>(
                  <div key={z.id} className="rounded-xl border border-red-800/40 bg-red-900/10 p-3">
                    <span className="text-2xl block mb-1">{z.icon}</span>
                    <p className="text-xs font-medium text-white">{z.label}</p>
                    <p className="text-xs text-red-400 font-bold">CRITIQUE</p>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        )}

        {/* ── MACHINES ── */}
        {tab==="machines" && (
          <div className="space-y-6">
            <Section title="⚙️ Machines surveillées" count={cfg.machines.length}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {cfg.machines.map(m=>(
                  <div key={m.id} className={`rounded-xl border p-3 ${
                    m.risk==="critical"?"border-red-800/40 bg-red-900/10"
                    :m.risk==="high"?"border-amber-800/40 bg-amber-900/10"
                    :"border-slate-800 bg-slate-900"
                  }`}>
                    <span className="text-2xl block mb-1">{m.icon}</span>
                    <p className="text-xs font-medium text-white">{m.label}</p>
                    <p className={`text-xs font-bold ${
                      m.risk==="critical"?"text-red-400"
                      :m.risk==="high"?"text-amber-400"
                      :"text-slate-500"
                    }`}>
                      Risque {m.risk==="critical"?"CRITIQUE":m.risk==="high"?"Élevé":"Moyen"}
                    </p>
                  </div>
                ))}
              </div>
            </Section>
            <Section title="🤖 États machines surveillés" count={cfg.machine_states.length}>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {cfg.machine_states.map(s=>(
                  <div key={s.id} className={`flex items-center gap-3 rounded-xl border p-3 ${
                    s.severity==="critical"?"border-red-800/40 bg-red-900/10"
                    :s.severity==="warning"?"border-amber-800/40 bg-amber-900/10"
                    :"border-slate-800 bg-slate-900"
                  }`}>
                    <span className="text-2xl">{s.icon}</span>
                    <div>
                      <p className="text-xs font-medium text-white">{s.label}</p>
                      <p className={`text-xs font-bold ${s.severity==="critical"?"text-red-400":s.severity==="warning"?"text-amber-400":"text-slate-500"}`}>
                        Action: {s.action}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        )}

        {/* ── EPI / PPE ── */}
        {tab==="ppe" && (
          <Section title="⛑️ Équipements de Protection Individuelle" count={cfg.ppe.length}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {cfg.ppe.map(p=>(
                <div key={p.id} className={`rounded-xl border p-3 ${
                  (p as any).violation?"border-red-800 bg-red-900/20"
                  :p.critical?"border-red-800/40 bg-red-900/10"
                  :"border-slate-800 bg-slate-900"
                }`}>
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-xl">{p.icon}</span>
                    {(p as any).violation&&<span className="text-xs text-red-500 font-bold">VIOLATION</span>}
                    {p.critical&&!((p as any).violation)&&<span className="text-xs text-red-400">⚡</span>}
                  </div>
                  <p className="text-xs font-medium text-white">{p.label}</p>
                  <p className={`text-xs mt-0.5 ${p.required?"text-amber-400":"text-slate-600"}`}>
                    {p.required?"Obligatoire":"Optionnel"}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── RISQUES ── */}
        {tab==="hazards" && (
          <div className="space-y-6">
            <Section title="⚗️ Matières dangereuses" count={cfg.hazardous_materials.length}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {cfg.hazardous_materials.map(h=>(
                  <div key={h.id} className={`rounded-xl border p-3 ${h.severity==="critical"?"border-red-800/40 bg-red-900/10":"border-amber-800/40 bg-amber-900/10"}`}>
                    <span className="text-2xl block mb-1">{h.icon}</span>
                    <p className="text-xs font-medium text-white">{h.label}</p>
                    {h.class!=="—"&&<p className="text-xs text-slate-500">{h.class}</p>}
                  </div>
                ))}
              </div>
            </Section>
            <Section title="🔥 Risques environnementaux" count={cfg.environmental_risks.length}>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {cfg.environmental_risks.map(r=>(
                  <div key={r.id} className={`flex items-center gap-3 rounded-xl border p-3 ${r.severity==="critical"?"border-red-800/40 bg-red-900/10":"border-amber-800/40 bg-amber-900/10"}`}>
                    <span className="text-3xl">{r.icon}</span>
                    <div>
                      <p className="text-xs font-medium text-white">{r.label}</p>
                      <p className={`text-xs font-bold ${r.severity==="critical"?"text-red-400":"text-amber-400"}`}>
                        Réponse: {r.response}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        )}

        {/* ── COMPORTEMENTS ── */}
        {tab==="behavior" && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {cfg.behavioral_risks.map(b=>(
              <div key={b.id} className={`flex items-center gap-3 rounded-xl border p-3 ${b.severity==="critical"?"border-red-800/40 bg-red-900/10":"border-amber-800/40 bg-amber-900/10"}`}>
                <span className="text-2xl shrink-0">{b.icon}</span>
                <div className="flex-1">
                  <p className="text-xs font-medium text-white">{b.label}</p>
                  <span className={`text-xs font-bold ${b.severity==="critical"?"text-red-400":"text-amber-400"}`}>
                    {b.severity==="critical"?"🔴 CRITIQUE":"🟡 ALERTE"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── VÉHICULES ── */}
        {tab==="vehicles" && (
          <div className="space-y-6">
            <Section title="🚛 Véhicules industriels" count={cfg.industrial_vehicles.length}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {cfg.industrial_vehicles.map(v=>(
                  <div key={v.id} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                    <span className="text-3xl block mb-1">{v.icon}</span>
                    <p className="text-xs font-medium text-white">{v.label}</p>
                    {v.alert_radius_m>0&&<p className="text-xs text-red-400">Zone alerte: {v.alert_radius_m}m</p>}
                  </div>
                ))}
              </div>
            </Section>
            <Section title="🏭 Transport interne" count={cfg.internal_transport.length}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {cfg.internal_transport.map(t=>(
                  <ZoneCard key={t.id} icon={t.icon} label={t.label}/>
                ))}
              </div>
            </Section>
            <Section title="👷 Types de travailleurs" count={cfg.workers.length}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {cfg.workers.map(w=>(
                  <div key={w.id} className={`rounded-xl border p-3 ${(w as any).alert?"border-red-800/40 bg-red-900/10":"border-slate-800 bg-slate-900"}`}>
                    <span className="text-2xl block mb-1">{w.icon}</span>
                    <p className="text-xs font-medium text-white">{w.label}</p>
                    {(w as any).alert&&<p className="text-xs text-red-400">Surveillance accrue</p>}
                  </div>
                ))}
              </div>
            </Section>
          </div>
        )}

        {/* ── ANALYTICS ── */}
        {tab==="analytics" && (
          <div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 mb-6">
              {cfg.analytics.map(a=>(
                <div key={a.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <span className="text-2xl block mb-2">{a.icon}</span>
                  <p className="text-xs text-slate-500 mb-1">{a.label}</p>
                  <p className="text-xl font-bold text-red-400">—</p>
                  <p className="text-xs text-slate-600">{a.unit}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-red-800/30 bg-red-900/10 p-4">
              <p className="text-xs text-red-400">⚠️ Les analytics se remplissent automatiquement dès que l'IA détecte des événements. Activez une caméra pour commencer.</p>
            </div>
          </div>
        )}

        {/* ── RAPPORTS ── */}
        {tab==="reports" && (
          <Section title="📄 Rapports disponibles" count={cfg.reports.length}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {cfg.reports.map(r=>(
                <div key={r.id} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <span className="text-3xl shrink-0">{r.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{r.label}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-slate-500">
                        {r.freq==="daily"?"Quotidien":r.freq==="weekly"?"Hebdo":r.freq==="monthly"?"Mensuel":r.freq==="live"?"Temps réel":"À la demande"}
                      </p>
                      <div className="flex gap-1">
                        {r.format.map(f=>(
                          <span key={f} className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400">{f.toUpperCase()}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:border-red-700 hover:text-red-400">
                    Générer
                  </button>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── MODULES IA AVANCÉS ── */}
        {tab==="advanced" && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-2">🚀 Modules IA avancés</h2>
            <p className="text-sm text-slate-400 mb-6">
              Ces extensions transforment Vision Guard en une plateforme complète de supervision industrielle
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cfg.advanced_modules.map(m=>(
                <div key={m.id} className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
                  <div className="border-b border-slate-800 bg-gradient-to-r from-slate-800/50 to-slate-900 px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">{m.icon}</span>
                      <p className="text-sm font-semibold text-white">{m.name}</p>
                    </div>
                    <p className="text-xs text-slate-400">{m.description}</p>
                    <span className="mt-2 inline-block rounded-full bg-purple-900/30 border border-purple-800 px-2 py-0.5 text-xs text-purple-400">
                      🔜 En développement
                    </span>
                  </div>
                  <div className="p-4">
                    <ul className="space-y-1.5">
                      {m.features.map((f,i)=>(
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                          <span className="text-slate-600 shrink-0 mt-0.5">•</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, count, children }: { title:string; count:number; children:React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-500">{count}</span>
      </div>
      {children}
    </div>
  );
}

function ZoneCard({ icon, label }: { icon:string; label:string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
      <span className="text-2xl block mb-1">{icon}</span>
      <p className="text-xs font-medium text-white">{label}</p>
    </div>
  );
}
