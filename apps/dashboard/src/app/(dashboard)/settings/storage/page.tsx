"use client";

import { useState } from "react";
import Link from "next/link";
import { PROVIDER_INFO, getActiveProvider, type StorageProvider } from "@/lib/services/storageService";

export default function StorageSettingsPage() {
  const active = getActiveProvider();
  const [selected, setSelected] = useState<StorageProvider>(active);

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Stockage des clips vidéo</h1>
        <p className="mt-1 text-sm text-slate-400">
          Les clips sont enregistrés quand l'IA détecte un événement. Choisissez votre provider de stockage.
        </p>
      </div>

      {/* Provider actif */}
      <div className="mb-6 rounded-xl border border-brand/30 bg-brand/5 p-4">
        <p className="text-xs text-slate-400 mb-1">Provider actif</p>
        <p className="text-sm font-medium text-white">
          {PROVIDER_INFO[active].icon} {PROVIDER_INFO[active].name}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Configuré via <code className="text-brand">NEXT_PUBLIC_CLIP_STORAGE_PROVIDER={active}</code>
        </p>
      </div>

      {/* Comment ça marche */}
      <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-300">Comment fonctionnent les clips ?</h2>
        <div className="space-y-2 text-xs text-slate-400">
          <div className="flex items-start gap-2">
            <span className="text-brand shrink-0">1.</span>
            <span>L'IA détecte un objet (personne, animal, feu...) → le pipeline crée un EventDoc dans Firestore</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-brand shrink-0">2.</span>
            <span>MediaRecorder capture 12 secondes du flux vidéo WebRTC (navigateur actif requis)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-brand shrink-0">3.</span>
            <span>Le clip est uploadé vers le provider choisi → l'URL est écrite dans <code>events/&#123;id&#125;.videoClipUrl</code></span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-brand shrink-0">4.</span>
            <span>La page Events affiche le lecteur vidéo automatiquement via onSnapshot Firestore</span>
          </div>
          <div className="mt-3 rounded-lg border border-amber-800/40 bg-amber-900/10 p-3">
            <p className="text-amber-400 font-medium mb-1">⚠️ Navigateur requis actuellement</p>
            <p>La capture WebRTC nécessite que /cameras/phone soit ouvert. Quand le serveur Python YOLOv11 sera déployé (Railway/GCP), les clips seront capturés côté serveur depuis le flux RTSP — la page n'aura plus besoin d'être ouverte.</p>
          </div>
        </div>
      </div>

      {/* Comparaison providers */}
      <h2 className="mb-3 text-sm font-semibold text-slate-300">Comparaison des providers</h2>
      <div className="space-y-3 mb-6">
        {(Object.entries(PROVIDER_INFO) as [StorageProvider, typeof PROVIDER_INFO[StorageProvider]][]).map(([key, info]) => (
          <button key={key} onClick={() => setSelected(key)}
            className={`w-full rounded-xl border p-5 text-left transition-all ${
              selected === key
                ? "border-brand bg-brand/5"
                : "border-slate-800 bg-slate-900 hover:border-slate-700"
            }`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{info.icon}</span>
                <div>
                  <p className="text-sm font-medium text-white">{info.name}</p>
                  {info.recommended && (
                    <span className="rounded-full bg-emerald-500/10 border border-emerald-800 px-2 py-0.5 text-xs text-emerald-400">
                      ⭐ Recommandé
                    </span>
                  )}
                </div>
              </div>
              {active === key && (
                <span className="rounded-full bg-brand/20 border border-brand/40 px-2 py-0.5 text-xs text-brand">
                  Actif
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-3">
              <div><span className="text-slate-500">Stockage :</span> <span className="text-slate-300">{info.storageCost}</span></div>
              <div><span className="text-slate-500">Sortie :</span> <span className={info.egressCost === "$0.00 (gratuit!)" ? "text-emerald-400" : "text-slate-300"}>{info.egressCost}</span></div>
              <div className="col-span-2"><span className="text-slate-500">Quota gratuit :</span> <span className="text-slate-300">{info.freeQuota}</span></div>
              <div className="col-span-2"><span className="text-slate-500">Estimation :</span> <span className="text-emerald-400 font-medium">{info.estimated}</span></div>
            </div>

            {selected === key && (
              <div className="mt-3 border-t border-slate-800 pt-3 text-xs text-slate-400">
                <p className="font-medium text-slate-300 mb-1">📋 Setup :</p>
                <p>{info.setup}</p>
                {key === "cloudflare" && (
                  <div className="mt-2 space-y-1">
                    <p className="text-slate-500">Variables à ajouter dans Vercel → Settings → Environment Variables :</p>
                    <code className="block bg-slate-950 rounded p-2 text-xs text-brand">
                      R2_ACCOUNT_ID=votre_account_id<br/>
                      R2_ACCESS_KEY_ID=votre_key<br/>
                      R2_SECRET_ACCESS_KEY=votre_secret<br/>
                      R2_BUCKET=visionguard-clips<br/>
                      R2_PUBLIC_URL=https://pub-xxx.r2.dev<br/>
                      NEXT_PUBLIC_CLIP_STORAGE_PROVIDER=cloudflare
                    </code>
                  </div>
                )}
                {key === "firebase" && (
                  <p className="mt-1 text-emerald-400">✅ Déjà configuré — aucune action requise</p>
                )}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Instructions migration */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-300">Migration Firebase → Cloudflare R2</h2>
        <div className="space-y-2 text-xs text-slate-400">
          <p>Les clips existants dans Firebase Storage restent accessibles. Les nouveaux clips vont dans R2.</p>
          <ol className="space-y-1.5 list-none">
            {[
              "Créer un compte Cloudflare (gratuit) → cloudflare.com",
              "R2 Object Storage → Create bucket → Nom: visionguard-clips",
              "Manage R2 API Tokens → Create API Token (permission: Object Read & Write)",
              "Copier Account ID, Access Key ID, Secret Access Key",
              "Dans R2 bucket → Settings → Public Access → Enable R2.dev subdomain",
              "Ajouter les 6 variables dans Vercel → Settings → Env Vars → Redeploy",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-brand font-bold shrink-0">{i+1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <a href="https://developers.cloudflare.com/r2/get-started/" target="_blank"
            className="inline-block mt-2 text-brand hover:underline">
            Documentation Cloudflare R2 ↗
          </a>
        </div>
      </div>
    </div>
  );
}
