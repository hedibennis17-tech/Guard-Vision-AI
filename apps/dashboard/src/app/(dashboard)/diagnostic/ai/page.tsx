"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ModelInfo {
  id:string; name:string; icon:string; status:string; where:string;
  deployed:boolean; detects:string[]; limitation:string; action:string;
}

interface DiagData {
  timestamp:string;
  python_server:{ url:string; online:boolean; details:any };
  summary:{ running:number; not_deployed:number; needs_gpu:number; total:number };
  honest_status:Record<string,string>;
  models:ModelInfo[];
  deploy_guide:Record<string,string>;
}

const WHERE_LABEL:Record<string,{label:string;color:string}> = {
  browser:       {label:"Navigateur",    color:"#10B981"},
  python_server: {label:"Serveur Python",color:"#F59E0B"},
  gpu_server:    {label:"Serveur GPU",   color:"#8B5CF6"},
  not_installed: {label:"Non installé",  color:"#EF4444"},
};

const STATUS_STYLE:Record<string,{bg:string;border:string;badge:string}> = {
  running:                   {bg:"bg-emerald-900/20",border:"border-emerald-800/40",badge:"bg-emerald-900 text-emerald-400"},
  available_if_server:       {bg:"bg-emerald-900/10",border:"border-emerald-800/20",badge:"bg-emerald-900 text-emerald-400"},
  server_online_model_missing:{bg:"bg-amber-900/20", border:"border-amber-800/40",  badge:"bg-amber-900 text-amber-400"},
  not_deployed:              {bg:"bg-red-900/10",    border:"border-red-800/30",    badge:"bg-red-900 text-red-400"},
  needs_gpu:                 {bg:"bg-slate-900",     border:"border-slate-800",     badge:"bg-slate-800 text-slate-500"},
  planned:                   {bg:"bg-slate-900",     border:"border-slate-800",     badge:"bg-slate-800 text-slate-600"},
};

const MODULE_MODELS:Record<string,string[]> = {
  "Home Security":       ["coco_ssd","bytetrack","clip"],
  "Retail Intelligence": ["coco_ssd","shoplifting","bytetrack","paddleocr"],
  "Construction Safety": ["yolov11_ppe","coco_ssd","bytetrack","sam2"],
  "Industrial Safety":   ["yolov11_ppe","coco_ssd","bytetrack","paddleocr"],
  "AgriGuard":           ["coco_ssd","bytetrack","grounding_dino","florence2"],
  "TrafficGuard":        ["coco_ssd","bytetrack","paddleocr"],
  "Smart City":          ["coco_ssd","bytetrack","florence2","clip"],
  "Defense Shield":      ["yolov11_ppe","coco_ssd","bytetrack","sam2"],
};

export default function AIDiagnosticPage() {
  const [data,    setData]    = useState<DiagData|null>(null);
  const [loading, setLoading] = useState(true);
  const [view,    setView]    = useState<"global"|string>("global");

  async function run() {
    setLoading(true);
    try {
      const r = await fetch("/api/ai-diagnostic");
      setData(await r.json());
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { run(); }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent"/>
      <p className="text-slate-400 text-sm">Diagnostic en cours...</p>
    </div>
  );

  if (!data) return (
    <div className="text-center py-20">
      <p className="text-red-400">Erreur lors du diagnostic</p>
      <button onClick={run} className="mt-4 rounded-xl bg-brand px-4 py-2 text-sm text-white">Réessayer</button>
    </div>
  );

  const { summary, models, python_server, honest_status, deploy_guide } = data;

  const moduleModels = view !== "global"
    ? models.filter(m => MODULE_MODELS[view]?.includes(m.id))
    : models;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">🔬 Diagnostic IA</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            État réel de tous les modèles — honnêteté totale
          </p>
        </div>
        <button onClick={run}
          className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-brand hover:text-brand">
          🔄 Relancer
        </button>
      </div>

      {/* Alerte serveur Python */}
      {!python_server.online && (
        <div className="mb-6 rounded-xl border border-red-800/40 bg-red-900/20 p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🚨</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-red-400 mb-1">
                Serveur Python IA non déployé — {Math.round((models.length - summary.running) / models.length * 100)}% des modèles inactifs
              </p>
              <p className="text-xs text-red-300/70 mb-3">
                URL configurée: <span className="font-mono">{python_server.url}</span>
              </p>
              <div className="space-y-1 text-xs text-slate-400">
                {Object.entries(deploy_guide).map(([k,v]) => (
                  <p key={k}><span className="text-slate-500">{k}:</span> {v}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {python_server.online && (
        <div className="mb-6 rounded-xl border border-emerald-800/40 bg-emerald-900/10 p-4">
          <p className="text-sm font-bold text-emerald-400">
            ✅ Serveur Python en ligne: {python_server.url}
          </p>
          <p className="text-xs text-emerald-300/60 mt-1">
            {JSON.stringify(python_server.details?.models ?? {})}
          </p>
        </div>
      )}

      {/* Compteurs */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          {label:"Actifs maintenant",  value:summary.running,      color:"text-emerald-400", bg:"border-emerald-800/40 bg-emerald-900/10"},
          {label:"Serveur requis",     value:summary.not_deployed, color:"text-red-400",     bg:"border-red-800/30 bg-red-900/10"},
          {label:"GPU requis",         value:summary.needs_gpu,    color:"text-slate-400",   bg:"border-slate-700 bg-slate-900"},
          {label:"Total modèles",      value:summary.total,        color:"text-brand",       bg:"border-brand/30 bg-brand/5"},
        ].map(k => (
          <div key={k.label} className={`rounded-xl border p-3 text-center ${k.bg}`}>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Ce qui fonctionne / ne fonctionne pas */}
      <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-800/30 bg-emerald-900/10 p-4">
          <h3 className="text-xs font-bold text-emerald-400 mb-2">✅ CE QUI FONCTIONNE MAINTENANT</h3>
          <ul className="space-y-1.5 text-xs text-emerald-300/80">
            {(honest_status.what_detects_NOW||"").split(".").filter(Boolean).map((s,i) => (
              <li key={i}>• {s.trim()}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-red-800/30 bg-red-900/10 p-4">
          <h3 className="text-xs font-bold text-red-400 mb-2">❌ CE QUI NE FONCTIONNE PAS ENCORE</h3>
          <ul className="space-y-1.5 text-xs text-red-300/80">
            <li>• Casque / gilet / uniforme absent → YOLOv11 serveur</li>
            <li>• Vol à l'étalage précis → shoplifting_wights.pt + serveur</li>
            <li>• Lecture plaques → PaddleOCR + serveur</li>
            <li>• Tracking ID unique → ByteTrack + serveur</li>
            <li>• Segmentation pixel → SAM2 + GPU</li>
            <li>• Rapports IA → LLM + GPU ou API</li>
          </ul>
        </div>
      </div>

      {/* Filtre par module */}
      <div className="flex gap-1.5 flex-wrap mb-4">
        <button onClick={() => setView("global")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${view==="global"?"bg-brand text-white":"border border-slate-700 text-slate-400 hover:text-white"}`}>
          🌐 Tous les modèles
        </button>
        {Object.keys(MODULE_MODELS).map(m => (
          <button key={m} onClick={() => setView(m)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${view===m?"bg-brand text-white":"border border-slate-700 text-slate-400 hover:text-white"}`}>
            {m}
          </button>
        ))}
      </div>

      {/* Liste des modèles */}
      <div className="space-y-3">
        {moduleModels.map(model => {
          const style = STATUS_STYLE[model.status] ?? STATUS_STYLE.planned;
          const whereInfo = WHERE_LABEL[model.where] ?? {label:model.where, color:"#64748B"};
          return (
            <div key={model.id}
              className={`rounded-xl border p-4 ${style.bg} ${style.border}`}>
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0">{model.icon}</span>
                <div className="flex-1 min-w-0">
                  {/* Nom + badges */}
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <h3 className="text-sm font-bold text-white">{model.name}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.badge}`}>
                      {model.status==="running"              ? "✅ Actif"
                       :model.status==="available_if_server"  ? "✅ Actif (serveur online)"
                       :model.status==="server_online_model_missing" ? "⚠️ Serveur OK — modèle manquant"
                       :model.status==="not_deployed"          ? "🔴 Non déployé"
                       :model.status==="needs_gpu"             ? "⚫ GPU requis"
                       :                                         "🔜 Planifié"}
                    </span>
                    <span className="rounded-full px-2 py-0.5 text-xs border border-slate-700"
                      style={{color:whereInfo.color}}>
                      {whereInfo.label}
                    </span>
                  </div>

                  {/* Ce qu'il détecte */}
                  <div className="mb-2">
                    <p className="text-xs font-semibold text-slate-500 mb-1">DÉTECTE :</p>
                    <div className="flex flex-wrap gap-1">
                      {model.detects.map((d,i) => (
                        <span key={i}
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            model.deployed
                              ? "bg-emerald-900/30 text-emerald-400 border border-emerald-800/30"
                              : "bg-slate-800 text-slate-500 border border-slate-700"
                          }`}>
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Limitation */}
                  <p className="text-xs text-amber-400/80 mb-1">
                    ⚠️ {model.limitation}
                  </p>

                  {/* Action */}
                  <p className={`text-xs font-semibold ${
                    model.deployed ? "text-emerald-400" : "text-brand"
                  }`}>
                    → {model.action}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Guide déploiement */}
      {!python_server.online && (
        <div className="mt-6 rounded-xl border border-brand/30 bg-brand/5 p-5">
          <h3 className="text-sm font-bold text-brand mb-3">
            🚀 Déployer le serveur Python — Active YOLOv11 + ByteTrack + PaddleOCR
          </h3>
          <ol className="space-y-2 text-xs text-slate-400">
            <li className="flex gap-2"><span className="text-brand font-bold shrink-0">1.</span>Aller sur <strong className="text-white">railway.app</strong> → New Project → Deploy from GitHub</li>
            <li className="flex gap-2"><span className="text-brand font-bold shrink-0">2.</span>Sélectionner le repo <strong className="text-white">Guard-Vision-AI</strong> → Root directory: <code className="text-brand">apps/ai-server</code></li>
            <li className="flex gap-2"><span className="text-brand font-bold shrink-0">3.</span>Ajouter les variables d'environnement:<br/>
              <code className="text-brand">FIREBASE_PROJECT_ID=ai-guard-vision-8ef41</code><br/>
              <code className="text-brand">FIREBASE_CREDENTIALS_JSON=</code><em className="text-slate-500">[JSON du service account Firebase]</em>
            </li>
            <li className="flex gap-2"><span className="text-brand font-bold shrink-0">4.</span>Copier l'URL Railway → Vercel env vars: <code className="text-brand">NEXT_PUBLIC_AI_SERVER_URL=https://xxx.railway.app</code></li>
            <li className="flex gap-2"><span className="text-brand font-bold shrink-0">5.</span><strong className="text-white">Résultat immédiat:</strong> YOLOv11 + ByteTrack + PaddleOCR actifs → casque/gilet/uniforme détectés</li>
          </ol>
          <div className="mt-4 flex gap-3">
            <a href="https://railway.app" target="_blank"
              className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand/90">
              🚂 Déployer sur Railway →
            </a>
            <a href="https://console.firebase.google.com/project/ai-guard-vision-8ef41/settings/serviceaccounts/adminsdk"
              target="_blank"
              className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm text-slate-300 hover:border-brand hover:text-brand">
              🔑 Service Account Firebase →
            </a>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-600 text-center">
        Diagnostic généré le {new Date(data.timestamp).toLocaleString("fr-CA")}
      </p>
    </div>
  );
}
