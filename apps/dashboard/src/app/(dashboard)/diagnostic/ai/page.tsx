"use client";
import { useEffect, useState } from "react";

interface Model {
  id:string; name:string; icon:string; status:string; where:string;
  deployed:boolean; real_status:string; detects:string[]; limitation:string; action:string;
}
interface DiagData {
  timestamp:string;
  server:{ url:string; online:boolean; latency:string|null; details:any };
  summary:{ total:number; running:number; fallback:number; missing:number; needs_gpu:number };
  honest_summary:string[];
  priority_actions:{ num:number; task:string; how:string; impact:string; effort:string; urgent?:boolean }[];
  models:Model[];
}

const STATUS_STYLE:Record<string,{badge:string;card:string;dot:string}> = {
  running:        {badge:"bg-emerald-900 text-emerald-400",     card:"border-emerald-800/40 bg-emerald-900/10", dot:"bg-emerald-400 animate-pulse"},
  fallback_active:{badge:"bg-amber-900 text-amber-400",         card:"border-amber-800/40 bg-amber-900/10",    dot:"bg-amber-400"},
  partial:        {badge:"bg-amber-900 text-amber-400",         card:"border-amber-800/40 bg-amber-900/10",    dot:"bg-amber-400"},
  not_deployed:   {badge:"bg-red-900 text-red-400",             card:"border-red-900/30 bg-red-900/10",       dot:"bg-red-500"},
  weights_missing:{badge:"bg-red-900 text-red-400",             card:"border-red-900/30 bg-red-900/10",       dot:"bg-red-500"},
  needs_gpu:      {badge:"bg-slate-800 text-slate-500",         card:"border-slate-800 bg-slate-900",         dot:"bg-slate-600"},
};
const STATUS_LABEL:Record<string,string> = {
  running:"✅ Actif", fallback_active:"⚠️ Fallback", partial:"🟡 Partiel",
  not_deployed:"🔴 Non déployé", weights_missing:"🔴 Poids manquants", needs_gpu:"⚫ GPU requis",
};

export default function DiagPage() {
  const [data,    setData]    = useState<DiagData|null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string|null>(null);
  const [filter,  setFilter]  = useState<"all"|"active"|"missing">("all");

  async function run() {
    setLoading(true); setError(null);
    try {
      const r = await fetch("/api/ai-diagnostic", { cache:"no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      if (!json.models) throw new Error("Format de réponse invalide");
      setData(json);
    } catch(e:any) {
      setError(e.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(()=>{ run(); },[]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent"/>
      <p className="text-slate-400">Diagnostic en cours...</p>
    </div>
  );

  if (error || !data) return (
    <div className="text-center py-20">
      <p className="text-4xl mb-3">⚠️</p>
      <p className="text-red-400 font-medium mb-2">Erreur</p>
      <p className="text-slate-500 text-sm mb-4">{error}</p>
      <button onClick={run} className="rounded-xl bg-brand px-4 py-2 text-sm text-white">Réessayer</button>
    </div>
  );

  const { server, summary, honest_summary=[], priority_actions=[], models=[] } = data;

  const filtered = models.filter(m => {
    if (filter==="active")  return m.deployed || m.status==="fallback_active";
    if (filter==="missing") return !m.deployed && m.status!=="running";
    return true;
  });

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">🔬 Diagnostic IA</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {new Date(data.timestamp).toLocaleString("fr-CA")}
          </p>
        </div>
        <button onClick={run}
          className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-brand hover:text-brand transition-colors">
          🔄 Actualiser
        </button>
      </div>

      {/* Serveur Railway */}
      <div className={`rounded-xl border p-4 ${server.online?"border-emerald-800/40 bg-emerald-900/10":"border-red-800/40 bg-red-900/10"}`}>
        <div className="flex items-center gap-3 mb-1">
          <span className={`h-3 w-3 rounded-full shrink-0 ${server.online?"bg-emerald-400 animate-pulse":"bg-red-500"}`}/>
          <p className="text-sm font-bold text-white">
            Serveur Python Railway — {server.online ? "🟢 EN LIGNE" : "🔴 HORS LIGNE"}
          </p>
          {server.latency && (
            <span className="rounded-full bg-emerald-900/50 px-2 py-0.5 text-xs text-emerald-400">{server.latency}</span>
          )}
        </div>
        <p className="text-xs font-mono text-slate-400 mt-1">{server.url}</p>
        {!server.online && (
          <div className="mt-2 rounded-lg bg-red-900/20 border border-red-800/30 p-2.5">
            <p className="text-xs font-bold text-red-400 mb-1">⚡ Action requise :</p>
            <p className="text-xs text-slate-300">Vercel → Settings → Environment Variables → Add :</p>
            <code className="text-xs text-brand">NEXT_PUBLIC_AI_SERVER_URL = https://guard-vision-ai-production.up.railway.app</code>
            <p className="text-xs text-slate-400 mt-1">Puis Save → Redeploy</p>
          </div>
        )}
      </div>

      {/* Compteurs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {label:"Actifs",       value:summary.running,   color:"text-emerald-400", border:"border-emerald-800/30 bg-emerald-900/10"},
          {label:"Fallback",     value:summary.fallback,  color:"text-amber-400",   border:"border-amber-800/30 bg-amber-900/10"},
          {label:"Non déployés", value:summary.missing,   color:"text-red-400",     border:"border-red-800/30 bg-red-900/10"},
          {label:"GPU requis",   value:summary.needs_gpu, color:"text-slate-400",   border:"border-slate-700 bg-slate-900"},
        ].map(k=>(
          <div key={k.label} className={`rounded-xl border p-3 text-center ${k.border}`}>
            <p className={`text-3xl font-bold ${k.color}`}>{k.value ?? 0}</p>
            <p className="text-xs text-slate-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Résumé honnête */}
      {honest_summary.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h3 className="text-xs font-bold text-slate-400 mb-2">📋 RÉSUMÉ HONNÊTE</h3>
          <ul className="space-y-1">
            {honest_summary.map((s,i)=>(
              <li key={i} className="text-sm text-white">{s}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions prioritaires */}
      {priority_actions.length > 0 && (
        <div className="rounded-xl border border-brand/30 bg-brand/5 p-4">
          <h3 className="text-sm font-bold text-brand mb-4">🚀 Actions prioritaires</h3>
          <div className="space-y-4">
            {priority_actions.map(a=>(
              <div key={a.num} className={`flex gap-3 rounded-xl p-3 ${a.urgent?"border border-red-700 bg-red-900/10":""}`}>
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${a.urgent?"bg-red-600":"bg-brand"}`}>
                  {a.urgent ? "❗" : a.num}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">{a.task}</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">Comment: {a.how}</p>
                  <p className="text-xs text-emerald-400 mt-0.5">Impact: {a.impact}</p>
                  <p className="text-xs text-brand/70 mt-0.5">Effort: {a.effort}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        {(["all","active","missing"] as const).map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter===f?"bg-brand text-white":"border border-slate-700 text-slate-400 hover:text-white"
            }`}>
            {f==="all"?"🌐 Tous":f==="active"?"✅ Actifs":"❌ Manquants"}
            {" "}({f==="all"?models.length:f==="active"?models.filter(m=>m.deployed||m.status==="fallback_active").length:models.filter(m=>!m.deployed&&m.status!=="running").length})
          </button>
        ))}
      </div>

      {/* Liste des modèles */}
      <div className="space-y-3">
        {filtered.map(model=>{
          const ui = STATUS_STYLE[model.status] ?? STATUS_STYLE.not_deployed;
          const label = STATUS_LABEL[model.status] ?? model.status;
          return (
            <div key={model.id} className={`rounded-xl border overflow-hidden ${ui.card}`}>
              {/* Header modèle */}
              <div className="flex items-start gap-3 p-4">
                <div className="flex items-center gap-2 shrink-0 mt-0.5">
                  <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${ui.dot}`}/>
                  <span className="text-2xl">{model.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <h3 className="text-sm font-bold text-white">{model.name}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ui.badge}`}>{label}</span>
                    <span className="text-xs text-slate-600">{model.where}</span>
                  </div>

                  {/* Statut réel */}
                  <p className={`text-xs font-semibold mb-2 ${
                    model.real_status?.startsWith("✅") ? "text-emerald-400"
                    : model.real_status?.startsWith("⚠️") ? "text-amber-400"
                    : "text-red-400"
                  }`}>
                    {model.real_status}
                  </p>

                  {/* Ce que ça détecte */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {(model.detects ?? []).map((d,i)=>(
                      <span key={i} className={`rounded-full border px-2 py-0.5 text-xs ${
                        model.deployed
                          ? "border-emerald-800/40 bg-emerald-900/20 text-emerald-400"
                          : model.status==="fallback_active"
                          ? "border-amber-800/30 bg-amber-900/15 text-amber-400"
                          : "border-slate-700 bg-slate-800 text-slate-500"
                      }`}>{d}</span>
                    ))}
                  </div>

                  {/* Limitation */}
                  <p className="text-xs text-amber-400/80 mb-1">⚠️ {model.limitation}</p>

                  {/* Action */}
                  <p className={`text-xs font-semibold ${model.deployed?"text-emerald-400":"text-brand"}`}>
                    → {model.action}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
