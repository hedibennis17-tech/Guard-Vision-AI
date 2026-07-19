"use client";
import { useEffect, useState } from "react";

const SERVER = process.env.NEXT_PUBLIC_AI_SERVER_URL ?? "";

export default function PPETrainingPage() {
  const [status,   setStatus]   = useState<any>(null);
  const [running,  setRunning]  = useState(false);
  const [logs,     setLogs]     = useState<string[]>([]);

  async function fetchStatus() {
    try {
      const r = await fetch(`${SERVER}/ppe/train-status`, { cache:"no-store" });
      const d = await r.json();
      setStatus(d);
      setRunning(d.training_running);
      if (d.last_logs?.length) setLogs(d.last_logs);
    } catch {}
  }

  useEffect(() => {
    fetchStatus();
    const iv = setInterval(fetchStatus, 8000);
    return () => clearInterval(iv);
  }, []);

  async function startTraining() {
    setRunning(true);
    setLogs(["🚀 Démarrage de l'entraînement PPE..."]);
    try {
      const r = await fetch(`${SERVER}/ppe/start-training`, {
        method:"POST", headers:{"Content-Type":"application/json"}, body:"{}"
      });
      const d = await r.json();
      setLogs(prev => [...prev, d.message || d.status || "✅ Lancé"]);
    } catch(e:any) {
      setLogs(["❌ Erreur: " + e.message]);
      setRunning(false);
    }
  }

  const ppeReady = status?.ppe_pt_exists;

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">⛑️ Entraînement PPE</h1>
        <p className="text-sm text-slate-400 mt-1">
          YOLOv11 Custom — Casque · Gilet · Uniforme · Harnais · Bottes · Gants
        </p>
      </div>

      {/* Statut modèle */}
      <div className={`rounded-xl border p-4 ${ppeReady ? "border-emerald-800/40 bg-emerald-900/10" : "border-red-800/40 bg-red-900/10"}`}>
        <div className="flex items-center gap-3">
          <span className={`h-4 w-4 rounded-full shrink-0 ${ppeReady ? "bg-emerald-400" : "bg-red-500"}`}/>
          <div>
            <p className="text-sm font-bold text-white">
              {ppeReady ? "✅ Modèle PPE actif — models/ppe.pt présent" : "❌ Modèle PPE absent — models/ppe.pt manquant"}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {ppeReady ? "Détection casque/gilet/uniforme active sur tous les modules" : "Sans ce fichier, aucune détection EPI précise n'est possible"}
            </p>
          </div>
        </div>
      </div>

      {/* Clé Roboflow */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-2">
        <h3 className="text-xs font-bold text-slate-400">CONFIGURATION</h3>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-300">Clé Roboflow</span>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${status?.roboflow_key ? "bg-emerald-900 text-emerald-400" : "bg-red-900 text-red-400"}`}>
            {status?.roboflow_key ? "✅ Configurée" : "❌ Manquante"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-300">Serveur Railway</span>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${status ? "bg-emerald-900 text-emerald-400" : "bg-red-900 text-red-400"}`}>
            {status ? "✅ En ligne" : "❌ Hors ligne"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-300">Fichiers dans models/</span>
          <span className="text-xs text-slate-400">{status?.models_dir?.join(", ") || "vide"}</span>
        </div>
      </div>

      {/* Bouton principal */}
      {!ppeReady && (
        <button
          onClick={startTraining}
          disabled={running}
          className="w-full rounded-2xl py-5 text-lg font-bold text-white transition-all disabled:opacity-60"
          style={{background: running ? "#6B7280" : "linear-gradient(135deg, #F59E0B, #D97706)"}}>
          {running ? (
            <span className="flex items-center justify-center gap-3">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"/>
              Entraînement en cours... (~2h sur CPU)
            </span>
          ) : "▶ Lancer l'entraînement PPE"}
        </button>
      )}

      {ppeReady && (
        <div className="rounded-2xl border-2 border-emerald-700 bg-emerald-900/20 py-5 text-center">
          <p className="text-lg font-bold text-emerald-400">🎉 PPE prêt — Modèle actif</p>
          <p className="text-sm text-emerald-300/70 mt-1">Casque · Gilet · Uniforme · Harnais détectés</p>
        </div>
      )}

      {/* Ce que ça fait */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="text-xs font-bold text-slate-400 mb-3">CE QUE L'ENTRAÎNEMENT FAIT</h3>
        <div className="space-y-2.5">
          {[
            {num:"1", text:"Télécharge le dataset PPE depuis Roboflow avec ta clé"},
            {num:"2", text:"Entraîne YOLOv11n sur les données (30 epochs)"},
            {num:"3", text:"Crée models/ppe.pt automatiquement"},
            {num:"4", text:"Active la détection: helmet ✅ / no_helmet 🚨 / safety_vest ✅ / no_vest 🚨 / uniform ✅ / no_uniform ⚠️"},
          ].map(s => (
            <div key={s.num} className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">{s.num}</span>
              <p className="text-sm text-slate-300 leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Logs */}
      {logs.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-black overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
            <h3 className="text-xs font-bold text-slate-400">LOGS EN TEMPS RÉEL</h3>
            <span className="text-xs text-slate-600">Actualisation toutes les 8s</span>
          </div>
          <div className="p-3 font-mono text-xs space-y-1 max-h-64 overflow-y-auto">
            {logs.map((l, i) => (
              <p key={i} className={
                l.startsWith("✅") || l.startsWith("🎉") ? "text-emerald-400" :
                l.startsWith("❌") ? "text-red-400" :
                l.startsWith("📥") || l.startsWith("🏋️") ? "text-amber-400" :
                "text-slate-400"
              }>{l}</p>
            ))}
          </div>
        </div>
      )}

      <button onClick={fetchStatus}
        className="w-full rounded-xl border border-slate-700 py-2.5 text-sm text-slate-400 hover:border-slate-500 hover:text-white transition-colors">
        🔄 Actualiser le statut
      </button>

    </div>
  );
}
