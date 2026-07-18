"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Model {
  id:string; name:string; icon:string; status:string; where:string;
  deployed:boolean; detects:string[]; limitation:string; action:string;
}
interface DiagData {
  timestamp:string;
  server:{ url:string; online:boolean; latency:string|null; yolo:any; firebase:any; version:string|null };
  summary:{ total:number; running:number; fallback:number; not_deployed:number; needs_gpu:number };
  current_capabilities:{ works_now:string[]; not_working:string[] };
  next_steps:{ priority:number; task:string; impact:string; effort:string }[];
  models:Model[];
}

const STATUS_UI:Record<string,{label:string;dot:string;card:string}> = {
  running:        {label:"✅ Actif",             dot:"bg-emerald-400",card:"border-emerald-800/40 bg-emerald-900/10"},
  fallback_active:{label:"⚠️ Fallback actif",    dot:"bg-amber-400",  card:"border-amber-800/40 bg-amber-900/10"},
  partial:        {label:"🟡 Partiel",           dot:"bg-amber-400",  card:"border-amber-800/40 bg-amber-900/10"},
  not_deployed:   {label:"🔴 Non déployé",       dot:"bg-red-500",    card:"border-red-900/40 bg-red-900/10"},
  weights_missing:{label:"🔴 Poids manquants",   dot:"bg-red-500",    card:"border-red-900/40 bg-red-900/10"},
  needs_gpu:      {label:"⚫ GPU requis",         dot:"bg-slate-600",  card:"border-slate-800 bg-slate-900"},
};

export default function AIDiagPage() {
  const [data,    setData]    = useState<DiagData|null>(null);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<"all"|"active"|"missing">("all");

  async function run() {
    setLoading(true);
    try {
      const r = await fetch("/api/ai-diagnostic", { cache:"no-store" });
      setData(await r.json());
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { run(); }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent"/>
      <p className="text-slate-400 text-sm">Diagnostic en cours...</p>
    </div>
  );

  if (!data) return (
    <div className="text-center py-20">
      <p className="text-4xl mb-3">⚠️</p>
      <p className="text-red-400 mb-4">Erreur lors du diagnostic</p>
      <button onClick={run} className="rounded-xl bg-brand px-4 py-2 text-sm text-white">Réessayer</button>
    </div>
  );

  const { server, summary, current_capabilities, next_steps, models } = data;

  const filtered = models.filter(m => {
    if (filter === "active")  return m.deployed || m.status === "fallback_active";
    if (filter === "missing") return !m.deployed && m.status !== "running";
    return true;
  });

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">🔬 Diagnostic IA</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {new Date(data.timestamp).toLocaleString("fr-CA")}
          </p>
        </div>
        <button onClick={run}
          className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-brand hover:text-brand transition-colors">
          🔄 Actualiser
        </button>
      </div>

      {/* Serveur Railway */}
      <div className={`rounded-xl border p-4 ${
        server.online
          ? "border-emerald-800/40 bg-emerald-900/10"
          : "border-red-800/40 bg-red-900/10"
      }`}>
        <div className="flex items-center gap-3 mb-2">
          <span className={`h-3 w-3 rounded-full ${server.online ? "bg-emerald-400 animate-pulse" : "bg-red-500"}`}/>
          <p className="text-sm font-bold text-white">
            Serveur Python Railway — {server.online ? "EN LIGNE" : "HORS LIGNE"}
          </p>
          {server.latency && (
            <span className="rounded-full bg-emerald-900/50 px-2 py-0.5 text-xs text-emerald-400">
              {server.latency}
            </span>
          )}
        </div>
        <p className="text-xs font-mono text-slate-400 mb-2">{server.url}</p>
        {server.online && server.version && (
          <div className="flex gap-3 text-xs">
            <span className="text-emerald-400">v{server.version}</span>
            {server.yolo?.loaded && <span className="text-emerald-400">YOLOv11 ✅</span>}
            {server.firebase?.connected && <span className="text-emerald-400">Firebase ✅</span>}
          </div>
        )}
        {!server.online && (
          <p className="text-xs text-red-400 mt-1">
            → Vérifier NEXT_PUBLIC_AI_SERVER_URL dans Vercel env vars
          </p>
        )}
      </div>

      {/* Compteurs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {label:"Actifs",         value:summary.running,      color:"text-emerald-400", bg:"border-emerald-800/30 bg-emerald-900/10"},
          {label:"Fallback",       value:summary.fallback,     color:"text-amber-400",   bg:"border-amber-800/30 bg-amber-900/10"},
          {label:"Non déployés",   value:summary.not_deployed, color:"text-red-400",     bg:"border-red-800/30 bg-red-900/10"},
          {label:"GPU requis",     value:summary.needs_gpu,    color:"text-slate-400",   bg:"border-slate-700 bg-slate-900"},
        ].map(k=>(
          <div key={k.label} className={`rounded-xl border p-3 text-center ${k.bg}`}>
            <p className={`text-3xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-slate-500 mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Ce qui marche / marche pas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-800/30 bg-emerald-900/10 p-4">
          <h3 className="text-xs font-bold text-emerald-400 mb-3">✅ CE QUI FONCTIONNE MAINTENANT</h3>
          <ul className="space-y-2">
            {current_capabilities.works_now.map((s,i)=>(
              <li key={i} className="text-xs text-emerald-300/80 flex gap-2">
                <span className="shrink-0">•</span>{s}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-red-800/30 bg-red-900/10 p-4">
          <h3 className="text-xs font-bold text-red-400 mb-3">❌ CE QUI NE FONCTIONNE PAS ENCORE</h3>
          <ul className="space-y-2">
            {current_capabilities.not_working.map((s,i)=>(
              <li key={i} className="text-xs text-red-300/80 flex gap-2">
                <span className="shrink-0">•</span>{s}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Prochaines étapes */}
      <div className="rounded-xl border border-brand/30 bg-brand/5 p-4">
        <h3 className="text-sm font-bold text-brand mb-3">🚀 Prochaines étapes prioritaires</h3>
        <div className="space-y-3">
          {next_steps.map(step=>(
            <div key={step.priority} className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                {step.priority}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{step.task}</p>
                <p className="text-xs text-slate-400 mt-0.5">Impact: {step.impact}</p>
                <p className="text-xs text-brand/70 mt-0.5">Effort: {step.effort}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filtres */}
      <div>
        <div className="flex gap-2 mb-4">
          {([["all","🌐 Tous"],["active","✅ Actifs"],["missing","❌ Manquants"]] as const).map(([v,l])=>(
            <button key={v} onClick={()=>setFilter(v)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter===v ? "bg-brand text-white" : "border border-slate-700 text-slate-400 hover:text-white"
              }`}>
              {l}
            </button>
          ))}
        </div>

        {/* Liste des modèles */}
        <div className="space-y-3">
          {filtered.map(model=>{
            const ui = STATUS_UI[model.status] ?? STATUS_UI.not_deployed;
            return (
              <div key={model.id} className={`rounded-xl border p-4 ${ui.card}`}>
                <div className="flex items-start gap-3">
                  <div className="flex items-center gap-2 shrink-0 mt-0.5">
                    <span className={`h-2.5 w-2.5 rounded-full ${ui.dot}`}/>
                    <span className="text-2xl">{model.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-sm font-bold text-white">{model.name}</h3>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                        model.deployed
                          ? "border-emerald-700 text-emerald-400"
                          : model.status==="fallback_active"
                          ? "border-amber-700 text-amber-400"
                          : model.status==="needs_gpu"
                          ? "border-slate-700 text-slate-500"
                          : "border-red-700 text-red-400"
                      }`}>
                        {ui.label}
                      </span>
                      <span className="text-xs text-slate-600">{model.where}</span>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-2">
                      {model.detects.map((d,i)=>(
                        <span key={i} className={`rounded-full px-2 py-0.5 text-xs border ${
                          model.deployed
                            ? "bg-emerald-900/30 border-emerald-800/40 text-emerald-400"
                            : model.status==="fallback_active"
                            ? "bg-amber-900/20 border-amber-800/30 text-amber-400"
                            : "bg-slate-800 border-slate-700 text-slate-500"
                        }`}>
                          {d}
                        </span>
                      ))}
                    </div>

                    <p className="text-xs text-amber-400/80 mb-1">⚠️ {model.limitation}</p>
                    <p className={`text-xs font-semibold ${model.deployed ? "text-emerald-400" : "text-brand"}`}>
                      → {model.action}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
