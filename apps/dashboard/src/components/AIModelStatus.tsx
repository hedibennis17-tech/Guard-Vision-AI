"use client";

/**
 * AIModelStatus — État réel des modèles IA
 * Honnête et transparent sur ce qui tourne réellement vs ce qui est prévu
 */

interface AIModel {
  id:       string;
  name:     string;
  icon:     string;
  status:   "active_browser" | "active_server" | "planned" | "not_deployed";
  detail:   string;
  requires: string;
}

const MODELS: AIModel[] = [
  {
    id:"coco_ssd",   name:"COCO-SSD (TF.js)", icon:"🎯",
    status:"active_browser",
    detail:"80 classes — navigateur, <50ms, aucun serveur requis",
    requires:"Navigateur",
  },
  {
    id:"yolov11",    name:"YOLOv11 Custom", icon:"🎯",
    status:"not_deployed",
    detail:"Détection EPI, uniforme, casque, gilet — haute précision",
    requires:"Serveur Python (Railway/GCP non déployé)",
  },
  {
    id:"sam2",       name:"SAM 2", icon:"✂️",
    status:"planned",
    detail:"Segmentation pixel-perfect de n'importe quel objet",
    requires:"Serveur GPU + déploiement",
  },
  {
    id:"paddleocr",  name:"PaddleOCR", icon:"📖",
    status:"not_deployed",
    detail:"Lecture plaques, texte, codes-barres",
    requires:"Serveur Python",
  },
  {
    id:"clip",       name:"CLIP (ViT-B/32)", icon:"🔗",
    status:"planned",
    detail:"Vision-langage, recherche sémantique",
    requires:"Serveur GPU",
  },
  {
    id:"bytetrack",  name:"ByteTrack", icon:"👁️",
    status:"not_deployed",
    detail:"Tracking multi-objets entre frames",
    requires:"Serveur Python",
  },
  {
    id:"grounding_dino", name:"Grounding DINO", icon:"🦖",
    status:"planned",
    detail:"Détection open-vocabulary via texte",
    requires:"Serveur GPU",
  },
  {
    id:"florence2",  name:"Florence-2", icon:"🌸",
    status:"planned",
    detail:"Foundation model Microsoft — OCR + détection",
    requires:"Serveur GPU",
  },
  {
    id:"whisper",    name:"Whisper v3", icon:"🎙️",
    status:"planned",
    detail:"Reconnaissance vocale, alertes audio",
    requires:"Serveur CPU/GPU",
  },
  {
    id:"llama3",     name:"Llama 3.2 (3B)", icon:"🦙",
    status:"planned",
    detail:"Analyse contextuelle, génération rapports",
    requires:"Serveur GPU (A100)",
  },
  {
    id:"deepseek",   name:"DeepSeek-V3", icon:"🔍",
    status:"planned",
    detail:"Raisonnement complexe, analyse scènes",
    requires:"Serveur GPU haute puissance",
  },
];

const STATUS_CONFIG = {
  active_browser: { label:"✅ Actif (navigateur)", color:"text-emerald-400", bg:"bg-emerald-900/20 border-emerald-800" },
  active_server:  { label:"✅ Actif (serveur)",    color:"text-emerald-400", bg:"bg-emerald-900/20 border-emerald-800" },
  not_deployed:   { label:"⚙️ Serveur requis",     color:"text-amber-400",   bg:"bg-amber-900/20 border-amber-800"     },
  planned:        { label:"🔜 Planifié",            color:"text-slate-500",   bg:"bg-slate-900 border-slate-800"        },
};

export function AIModelStatus({ compact = false }: { compact?: boolean }) {
  const active   = MODELS.filter(m => m.status.startsWith("active"));
  const pending  = MODELS.filter(m => m.status === "not_deployed");
  const planned  = MODELS.filter(m => m.status === "planned");

  if (compact) {
    return (
      <div className="rounded-xl border border-amber-800/40 bg-amber-900/10 p-3">
        <p className="text-xs font-semibold text-amber-400 mb-1">
          ⚠️ Modèles IA actifs actuellement
        </p>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full border border-emerald-700 bg-emerald-900/20 px-2 py-0.5 text-xs text-emerald-400">
            ✅ COCO-SSD (navigateur) — 80 classes
          </span>
          <span className="rounded-full border border-amber-700 bg-amber-900/10 px-2 py-0.5 text-xs text-amber-400">
            ⚙️ YOLOv11 custom — serveur requis
          </span>
          <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-500">
            🔜 SAM2 / CLIP / OCR / ByteTrack — planifiés
          </span>
        </div>
        <p className="text-xs text-amber-500 mt-2">
          Pour détecter casques, gilets, uniformes avec précision → déployer YOLOv11 serveur sur Railway ou GCP.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
      <div className="border-b border-slate-800 px-5 py-4">
        <h2 className="text-base font-semibold text-white mb-1">🤖 État réel des modèles IA</h2>
        <p className="text-xs text-slate-400">
          Transparence totale sur ce qui tourne actuellement vs ce qui est prévu
        </p>
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-3 gap-px bg-slate-800 border-b border-slate-800">
        {[
          { label:"Actifs",          value:active.length,  color:"text-emerald-400" },
          { label:"Serveur requis",  value:pending.length, color:"text-amber-400"   },
          { label:"Planifiés",       value:planned.length, color:"text-slate-500"   },
        ].map(s=>(
          <div key={s.label} className="bg-slate-900 px-4 py-3 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Liste */}
      <div className="divide-y divide-slate-800">
        {MODELS.map(m => {
          const cfg = STATUS_CONFIG[m.status];
          return (
            <div key={m.id} className={`flex items-start gap-3 px-5 py-3 ${m.status==="planned"?"opacity-50":""}`}>
              <span className="text-xl shrink-0">{m.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-medium text-white">{m.name}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${cfg.bg} ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{m.detail}</p>
                <p className="text-xs text-slate-600 mt-0.5">Requis: {m.requires}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA déploiement serveur */}
      <div className="border-t border-slate-800 p-4 bg-brand/5">
        <p className="text-sm font-semibold text-brand mb-2">
          ⚡ Pour activer YOLOv11 + SAM2 + OCR + ByteTrack
        </p>
        <p className="text-xs text-slate-400 mb-3">
          Déployer le serveur Python Vision Guard sur Railway (gratuit jusqu'à 5$/mois) ou Google Cloud Run.
          Une fois déployé, l'AI Orchestrator bascule automatiquement sur le serveur.
        </p>
        <div className="flex gap-2">
          <a href="https://railway.app" target="_blank"
            className="rounded-lg bg-brand px-4 py-2 text-xs font-medium text-white hover:bg-brand/90">
            🚂 Déployer sur Railway →
          </a>
          <a href="https://cloud.google.com/run" target="_blank"
            className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-300 hover:border-brand">
            ☁️ Google Cloud Run
          </a>
        </div>
      </div>
    </div>
  );
}
