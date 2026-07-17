"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { collection, getDocs, setDoc, deleteDoc, doc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase/client";
import { useOrganization } from "@/lib/context/OrganizationContext";
import { AI_BUNDLES, BUNDLE_STATUS_LABELS } from "@/lib/orchestrator/bundles";
import { MODULE_CONFIGS } from "@/lib/orchestrator/moduleConfigs";

export default function ModulesPage() {
  const { currentOrg } = useOrganization();
  const [installed,  setInstalled]  = useState<Set<string>>(new Set());
  const [installing, setInstalling] = useState<string | null>(null);

  useEffect(() => {
    if (!currentOrg?.id) return;
    getDocs(collection(db, "organizations", currentOrg.id, "modules"))
      .then(s => setInstalled(new Set(s.docs.filter(d=>d.data()?.enabled).map(d=>d.id))))
      .catch(()=>{});
  }, [currentOrg?.id]);

  async function toggleModule(bundleId: string, currentlyInstalled: boolean) {
    if (!currentOrg?.id || !auth.currentUser) return;
    setInstalling(bundleId);
    try {
      const bundle = AI_BUNDLES.find(b => b.id === bundleId);
      if (currentlyInstalled) {
        await deleteDoc(doc(db, "organizations", currentOrg.id, "modules", bundleId));
        setInstalled(prev => { const s = new Set(prev); s.delete(bundleId); return s; });
      } else {
        await setDoc(doc(db, "organizations", currentOrg.id, "modules", bundleId), {
          slug: bundleId, organizationId: currentOrg.id,
          name: bundle?.name, enabled: true,
          models: bundle?.models, detectionClasses: bundle?.detectionClasses,
          enabledAt: new Date().toISOString(), enabledBy: auth.currentUser.uid,
        });
        setInstalled(prev => new Set([...prev, bundleId]));
      }
    } finally { setInstalling(null); }
  }

  const installedList  = AI_BUNDLES.filter(b => installed.has(b.id));
  const availableList  = AI_BUNDLES.filter(b => !installed.has(b.id) && (b.status === "available" || b.status === "beta"));
  const comingSoonList = AI_BUNDLES.filter(b => !installed.has(b.id) && (b.status === "coming_soon" || b.status === "enterprise"));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Modules IA</h1>
        <p className="mt-1 text-sm text-slate-400">
          Installez un module → il active ses classes de détection sur toutes vos caméras automatiquement
        </p>
      </div>

      {/* Explication du flux */}
      <div className="mb-6 rounded-xl border border-brand/20 bg-brand/5 p-5">
        <h2 className="text-sm font-semibold text-brand mb-3">💡 Comment ça marche ?</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
          {[
            "1. Installez un module",
            "→",
            "2. Ouvrez votre caméra",
            "→",
            "3. L'IA détecte les classes du module",
            "→",
            "4. Events + Alertes + Analytics automatiques",
          ].map((s,i) => (
            <span key={i} className={s==="→" ? "text-slate-600" : ""}>{s}</span>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/cameras/phone"
            className="rounded-lg bg-brand px-4 py-2 text-xs font-medium text-white">
            📷 Ouvrir la caméra →
          </Link>
          <Link href="/live-monitoring"
            className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-300">
            📺 Live Monitor →
          </Link>
        </div>
      </div>

      {/* Modules installés */}
      {installedList.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-base font-semibold text-white">✅ Modules actifs</h2>
            <span className="rounded-full bg-emerald-900/30 border border-emerald-800 px-2 py-0.5 text-xs text-emerald-400">
              {installedList.length} installé{installedList.length>1?"s":""}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {installedList.map(bundle => {
              const config = MODULE_CONFIGS[bundle.id];
              return (
                <div key={bundle.id}
                  className="rounded-2xl border-2 overflow-hidden"
                  style={{ borderColor: bundle.color + "40", background: bundle.color + "08" }}>
                  {/* Header */}
                  <div className="p-4 flex items-center gap-3">
                    <span className="text-3xl">{bundle.icon}</span>
                    <div className="flex-1">
                      <p className="font-semibold text-white">{bundle.name}</p>
                      <p className="text-xs text-slate-400">{bundle.sector}</p>
                    </div>
                    <span className="rounded-full bg-emerald-900/30 border border-emerald-700 px-2 py-0.5 text-xs text-emerald-400">
                      Actif ✅
                    </span>
                  </div>

                  {/* Classes actives */}
                  <div className="px-4 pb-3">
                    <p className="text-xs text-slate-500 mb-2">
                      {config?.classes.length} classes de détection actives :
                    </p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {config?.classes.map(cls => (
                        <span key={cls.cocoClass}
                          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                          style={{ background:cls.color+"15", color:cls.color, border:`1px solid ${cls.color}30` }}>
                          {cls.icon} {cls.label}
                          {cls.alertOn && <span className="text-red-400">🚨</span>}
                        </span>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Link href={`/modules/${bundle.id}`}
                        className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white text-center"
                        style={{ background: bundle.color }}>
                        📷 Tester maintenant
                      </Link>
                      <button onClick={() => toggleModule(bundle.id, true)}
                        disabled={installing === bundle.id}
                        className="rounded-xl border border-red-800 bg-red-900/10 px-3 py-2 text-xs text-red-400 hover:bg-red-900/20">
                        Désinstaller
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modules disponibles */}
      {availableList.length > 0 && (
        <div className="mb-8">
          <h2 className="text-base font-semibold text-white mb-4">🧩 Disponibles à l'installation</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {availableList.map(bundle => {
              const config   = MODULE_CONFIGS[bundle.id];
              const statusDef = BUNDLE_STATUS_LABELS[bundle.status];
              const isInstalling = installing === bundle.id;
              return (
                <div key={bundle.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-3xl">{bundle.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-white">{bundle.name}</p>
                          <span className="text-xs" style={{color:statusDef.color}}>{statusDef.label}</span>
                        </div>
                        <p className="text-xs text-slate-400">{bundle.tagline}</p>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 mb-2">Activera ces détections :</p>
                    <div className="flex flex-wrap gap-1 mb-4">
                      {config?.classes.slice(0,5).map(cls => (
                        <span key={cls.cocoClass}
                          className="rounded-full px-2 py-0.5 text-xs"
                          style={{ background:cls.color+"15", color:cls.color }}>
                          {cls.icon} {cls.label}
                        </span>
                      ))}
                      {(config?.classes.length ?? 0) > 5 && (
                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-500">
                          +{(config?.classes.length ?? 0) - 5}
                        </span>
                      )}
                    </div>

                    <button onClick={() => toggleModule(bundle.id, false)}
                      disabled={isInstalling}
                      className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-60"
                      style={{ background: bundle.color }}>
                      {isInstalling
                        ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"/>Installation...</>
                        : `⚡ Installer ${bundle.name}`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Coming soon */}
      {comingSoonList.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-slate-500 mb-4">🔜 Prochainement</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {comingSoonList.map(bundle => (
              <div key={bundle.id}
                className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 opacity-60">
                <span className="text-2xl block mb-2">{bundle.icon}</span>
                <p className="text-xs font-medium text-slate-400">{bundle.name}</p>
                <p className="text-xs text-slate-600">{bundle.sector}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
