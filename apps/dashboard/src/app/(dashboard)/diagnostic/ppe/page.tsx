"use client";
import { useEffect, useState, useRef } from "react";

const SERVER = process.env.NEXT_PUBLIC_AI_SERVER_URL ?? "";

function fmt(sec:number) {
  if (!sec) return "--";
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function PPEPage() {
  const [status,    setStatus]    = useState<any>(null);
  const [running,   setRunning]   = useState(false);
  const [logs,      setLogs]      = useState<string[]>([]);
  const [modelSize, setModelSize] = useState("n");
  const logsRef = useRef<HTMLDivElement>(null);

  const MODELS = [
    {v:"n",label:"YOLOv11 Nano",   desc:"⚡ ~2h CPU — test rapide",    epochs:30},
    {v:"s",label:"YOLOv11 Small",  desc:"🔹 ~4h CPU",                  epochs:50},
    {v:"m",label:"YOLOv11 Medium", desc:"⭐ ~8h CPU — production",      epochs:80},
    {v:"l",label:"YOLOv11 Large",  desc:"🔶 GPU recommandé",            epochs:100},
    {v:"x",label:"YOLOv11 XLarge", desc:"💎 GPU A100",                  epochs:150},
  ];

  async function fetchStatus() {
    try {
      const r = await fetch(`${SERVER}/ppe/train-status`,{cache:"no-store"});
      const d = await r.json();
      setStatus(d);
      setRunning(d.training_running ?? false);
      if (d.last_logs?.length) {
        setLogs(prev => {
          const set = new Set(prev);
          const next = [...prev];
          for (const l of d.last_logs) if (!set.has(l)) next.push(l);
          return next.slice(-150);
        });
      }
    } catch {}
  }

  useEffect(() => { fetchStatus(); const iv = setInterval(fetchStatus,5000); return ()=>clearInterval(iv); },[]);
  useEffect(() => { if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight; },[logs]);

  async function startTraining() {
    setRunning(true);
    setLogs(prev=>[...prev,`[${new Date().toLocaleTimeString()}] 🚀 Démarrage YOLOv11${modelSize.toUpperCase()}...`]);
    try {
      const r = await fetch(`${SERVER}/ppe/start-training`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model_size:modelSize})});
      const d = await r.json();
      setLogs(prev=>[...prev, d.message||"✅ Lancé"]);
    } catch(e:any) { setLogs(prev=>[...prev,"❌ "+e.message]); setRunning(false); }
  }

  const prog  = status?.progress ?? {};
  const pct   = prog.percent ?? 0;
  const ready = status?.ppe_pt_exists;

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      <div>
        <h1 className="text-2xl font-bold text-white">⛑️ Entraînement PPE Custom</h1>
        <p className="text-sm text-slate-400 mt-0.5">YOLOv11 — Casque · Gilet · Uniforme · Harnais · Bottes</p>
      </div>

      {/* Statut */}
      <div className={`rounded-xl border p-4 ${ready?"border-emerald-700 bg-emerald-900/15":"border-slate-700 bg-slate-900"}`}>
        <div className="flex items-center gap-3">
          <span className={`h-3.5 w-3.5 rounded-full shrink-0 ${ready?"bg-emerald-400":running?"bg-amber-400 animate-pulse":"bg-slate-600"}`}/>
          <p className="text-sm font-bold text-white">
            {ready ? "✅ models/ppe.pt — ACTIF" : running ? "⏳ Entraînement en cours..." : "⏸ En attente"}
          </p>
        </div>
        <p className="text-xs text-slate-500 mt-1 ml-6">Fichiers: {status?.models_dir?.join(", ")||"vide"}</p>
      </div>

      {/* ── COMPTEUR DE PROGRESSION ── */}
      {running && prog.total_epochs > 0 && (
        <div className="rounded-xl border border-amber-800/40 bg-amber-900/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-amber-400">🏋️ Entraînement en cours</span>
            <span className="text-xs text-slate-400">
              {fmt(prog.elapsed_sec)} écoulé · ~{fmt(prog.remaining_sec)} restant
            </span>
          </div>

          {/* Barre de progression */}
          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1.5">
              <span>Epoch {prog.epoch}/{prog.total_epochs}</span>
              <span className="font-bold text-amber-400">{pct}%</span>
            </div>
            <div className="h-4 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-1000"
                style={{width:`${pct}%`, background:"linear-gradient(90deg,#F59E0B,#EF4444)"}}>
                <div className="h-full w-full animate-pulse opacity-50 bg-white/20 rounded-full"/>
              </div>
            </div>
          </div>

          {/* Métriques */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {label:"Epoch",  value:`${prog.epoch}/${prog.total_epochs}`, color:"text-white"},
              {label:"Loss",   value:prog.loss||"...",                     color:"text-amber-400"},
              {label:"mAP50",  value:prog.map50>0?prog.map50:"...",        color:"text-emerald-400"},
            ].map(k=>(
              <div key={k.label} className="rounded-xl bg-slate-900 border border-slate-800 p-3 text-center">
                <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{k.label}</p>
              </div>
            ))}
          </div>

          <p className="text-xs text-amber-400/70 text-center">
            Actualisation automatique toutes les 5 secondes — ne fermez pas la page
          </p>
        </div>
      )}

      {/* Terminé */}
      {ready && (
        <div className="rounded-2xl border-2 border-emerald-600 bg-emerald-900/20 py-6 text-center space-y-2">
          <p className="text-2xl font-bold text-emerald-400">🎉 PPE Actif!</p>
          <p className="text-sm text-emerald-300">models/ppe.pt chargé · mAP50: {prog.map50||"—"}</p>
          <p className="text-xs text-emerald-300/60">Construction · Industrial · Defense · activés</p>
        </div>
      )}

      {/* Sélecteur modèle */}
      {!ready && !running && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h3 className="text-xs font-bold text-slate-400 mb-3">MODÈLE</h3>
          <div className="space-y-2">
            {MODELS.map(m=>(
              <button key={m.v} onClick={()=>setModelSize(m.v)}
                className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all ${modelSize===m.v?"border-amber-500 bg-amber-900/20":"border-slate-700 bg-slate-800 hover:border-slate-500"}`}>
                <div>
                  <p className="text-sm font-bold text-white">{m.label}</p>
                  <p className="text-xs text-slate-400">{m.desc}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-600">{m.epochs} epochs</span>
                  {modelSize===m.v && <span className="h-3 w-3 rounded-full bg-amber-400"/>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bouton */}
      {!ready && !running && (
        <button onClick={startTraining}
          className="w-full rounded-2xl py-5 text-lg font-bold text-white"
          style={{background:"linear-gradient(135deg,#F59E0B,#D97706)"}}>
          ▶ Lancer — YOLOv11{modelSize.toUpperCase()}
        </button>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-black overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
            <span className="text-xs font-bold text-slate-400">LOGS — {logs.length} lignes</span>
            <button onClick={()=>setLogs([])} className="text-xs text-slate-600 hover:text-red-400">Effacer</button>
          </div>
          <div ref={logsRef} className="p-3 font-mono text-xs space-y-0.5 max-h-80 overflow-y-auto">
            {logs.map((l,i)=>(
              <p key={i} className={
                l.includes("✅")||l.includes("🎉") ? "text-emerald-400"
                : l.includes("❌") ? "text-red-400"
                : l.includes("Epoch") ? "text-amber-300 font-bold"
                : l.includes("🏁")||l.includes("📊") ? "text-emerald-300 font-bold"
                : l.includes("📥")||l.includes("📦") ? "text-blue-400"
                : "text-slate-500"
              }>{l}</p>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
