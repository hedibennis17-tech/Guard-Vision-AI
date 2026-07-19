"use client";
import { useEffect, useState, useRef } from "react";

const SERVER = process.env.NEXT_PUBLIC_AI_SERVER_URL ?? "";

export default function PPETrainingPage() {
  const [status,   setStatus]   = useState<any>(null);
  const [running,  setRunning]  = useState(false);
  const [logs,     setLogs]     = useState<string[]>([]);
  const [modelSize,setModelSize]= useState("n");
  const logsRef  = useRef<HTMLDivElement>(null);
  const pollRef  = useRef<NodeJS.Timeout|null>(null);

  const MODEL_OPTIONS = [
    {value:"n",label:"YOLOv11 Nano",   desc:"⚡ Test rapide ~2h CPU",        epochs:30},
    {value:"s",label:"YOLOv11 Small",  desc:"🔹 Bon compromis ~4h CPU",      epochs:50},
    {value:"m",label:"YOLOv11 Medium", desc:"⭐ Production ~8h CPU",          epochs:80},
    {value:"l",label:"YOLOv11 Large",  desc:"🔶 Haute précision (GPU)",       epochs:100},
    {value:"x",label:"YOLOv11 XLarge", desc:"💎 Précision max (GPU A100)",    epochs:150},
  ];

  async function fetchStatus() {
    try {
      const r  = await fetch(`${SERVER}/ppe/train-status`, {cache:"no-store"});
      const d  = await r.json();
      setStatus(d);
      setRunning(d.training_running ?? false);
      if (d.last_logs?.length) {
        setLogs(prev => {
          const merged = [...prev];
          for (const l of d.last_logs) {
            if (!merged.includes(l)) merged.push(l);
          }
          return merged.slice(-100); // garder 100 dernières lignes
        });
      }
    } catch {}
  }

  // Scroll automatique vers le bas
  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => {
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function startTraining() {
    setRunning(true);
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 🚀 Démarrage...`]);
    try {
      const r = await fetch(`${SERVER}/ppe/start-training`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({model_size: modelSize})
      });
      const d = await r.json();
      setLogs(prev => [...prev, d.message || d.status]);
    } catch(e:any) {
      setLogs(prev => [...prev, "❌ " + e.message]);
      setRunning(false);
    }
  }

  const ppeReady = status?.ppe_pt_exists;

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      <div>
        <h1 className="text-2xl font-bold text-white">⛑️ Entraînement PPE Custom</h1>
        <p className="text-sm text-slate-400 mt-1">YOLOv11 — Casque · Gilet · Uniforme · Harnais · Bottes</p>
      </div>

      {/* Statut modèle */}
      <div className={`rounded-xl border p-4 ${ppeReady?"border-emerald-800/40 bg-emerald-900/10":"border-slate-700 bg-slate-900"}`}>
        <div className="flex items-center gap-3">
          <span className={`h-4 w-4 rounded-full shrink-0 ${ppeReady?"bg-emerald-400 animate-pulse":"bg-slate-600"}`}/>
          <div>
            <p className="text-sm font-bold text-white">
              {ppeReady ? "✅ models/ppe.pt — ACTIF" : "⏳ models/ppe.pt — En attente d'entraînement"}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Fichiers: {status?.models_dir?.join(", ") || "models/ vide"}
            </p>
          </div>
          <button onClick={fetchStatus} className="ml-auto shrink-0 text-xs text-slate-500 hover:text-white">🔄</button>
        </div>
        {running && (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-amber-400"/>
            <span className="text-xs text-amber-400 font-medium">Entraînement en cours...</span>
          </div>
        )}
      </div>

      {/* Sélecteur modèle */}
      {!ppeReady && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h3 className="text-xs font-bold text-slate-400 mb-3">CHOISIR LE MODÈLE</h3>
          <div className="space-y-2">
            {MODEL_OPTIONS.map(m => (
              <button key={m.value} onClick={() => setModelSize(m.value)}
                className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all ${
                  modelSize===m.value?"border-amber-500 bg-amber-900/20":"border-slate-700 bg-slate-800 hover:border-slate-500"
                }`}>
                <div>
                  <p className="text-sm font-bold text-white">{m.label}</p>
                  <p className="text-xs text-slate-400">{m.desc}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-600">{m.epochs} epochs</span>
                  {modelSize===m.value && <span className="h-3 w-3 rounded-full bg-amber-400"/>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bouton Lancer */}
      {!ppeReady && (
        <button onClick={startTraining} disabled={running}
          className="w-full rounded-2xl py-5 text-lg font-bold text-white transition-all disabled:opacity-60"
          style={{background: running?"#4B5563":"linear-gradient(135deg,#F59E0B,#D97706)"}}>
          {running
            ? <span className="flex items-center justify-center gap-3">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"/>
                Entraînement en cours... Actualisation toutes les 5s
              </span>
            : `▶ Lancer l'entraînement — YOLOv11${modelSize.toUpperCase()}`}
        </button>
      )}

      {ppeReady && (
        <div className="rounded-2xl border-2 border-emerald-600 bg-emerald-900/20 py-6 text-center space-y-2">
          <p className="text-2xl font-bold text-emerald-400">🎉 Modèle PPE actif!</p>
          <p className="text-sm text-emerald-300">models/ppe.pt chargé — détection EPI active</p>
          <p className="text-xs text-emerald-300/60">Construction Safety · Industrial Safety · Defense Shield</p>
        </div>
      )}

      {/* Logs persistants */}
      {logs.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-black overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
            <h3 className="text-xs font-bold text-slate-400">LOGS — {logs.length} lignes</h3>
            <button onClick={() => setLogs([])} className="text-xs text-slate-600 hover:text-red-400">Effacer</button>
          </div>
          <div ref={logsRef} className="p-3 font-mono text-xs space-y-0.5 max-h-96 overflow-y-auto">
            {logs.map((l, i) => (
              <p key={i} className={
                l.includes("✅")||l.includes("🎉") ? "text-emerald-400"
                : l.includes("❌") ? "text-red-400"
                : l.includes("🏋️")||l.includes("🤖") ? "text-amber-300 font-bold"
                : l.includes("📥")||l.includes("📦") ? "text-blue-400"
                : l.includes("🔍")||l.includes("📄") ? "text-slate-300"
                : "text-slate-500"
              }>{l}</p>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
