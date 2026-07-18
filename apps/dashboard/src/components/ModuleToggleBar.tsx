"use client";

import { useEffect, useState } from "react";
import {
  collection, doc, setDoc, deleteDoc, onSnapshot, getDocs,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase/client";
import { AI_BUNDLES, BUNDLE_STATUS_LABELS } from "@/lib/orchestrator/bundles";
import { MODULE_CONFIGS } from "@/lib/orchestrator/moduleConfigs";

interface ModuleToggleBarProps {
  organizationId:  string;
  /** Callback appelé chaque fois que la liste des modules actifs change */
  onModulesChange: (activeModuleIds: string[]) => void;
  compact?:        boolean;
}

const STATUS_BADGE: Record<string,{ label:string; cls:string }> = {
  available:   { label:"Dispo",     cls:"border-emerald-700 text-emerald-400"   },
  beta:        { label:"Bêta",      cls:"border-amber-700  text-amber-400"      },
  coming_soon: { label:"Bientôt",   cls:"border-slate-700  text-slate-500"      },
  enterprise:  { label:"Entreprise",cls:"border-purple-700 text-purple-400"     },
};

export function ModuleToggleBar({
  organizationId, onModulesChange, compact = false,
}: ModuleToggleBarProps) {
  const [installed,  setInstalled]  = useState<Set<string>>(new Set());
  const [toggling,   setToggling]   = useState<string | null>(null);
  const [expanded,   setExpanded]   = useState(!compact);

  // Charger les modules installés en temps réel
  useEffect(() => {
    if (!organizationId) return;
    const unsub = onSnapshot(
      collection(db, "organizations", organizationId, "modules"),
      (snap) => {
        const active = new Set(
          snap.docs.filter(d => d.data()?.enabled).map(d => d.id)
        );
        setInstalled(active);
        onModulesChange(Array.from(active));
      },
      () => {},
    );
    return unsub;
  }, [organizationId]);

  const safeBundles = (AI_BUNDLES as any[]).filter(Boolean);

  async function toggleModule(bundleId: string, currentlyOn: boolean) {
    const user = auth.currentUser;
    if (!user || !organizationId) return;
    setToggling(bundleId);

    try {
      const bundle = safeBundles.find((b:any) => b?.id === bundleId);
      if (currentlyOn) {
        await deleteDoc(doc(db, "organizations", organizationId, "modules", bundleId));
      } else {
        await setDoc(doc(db, "organizations", organizationId, "modules", bundleId), {
          slug:             bundleId,
          organizationId,
          name:             bundle?.name ?? bundleId,
          enabled:          true,
          models:           bundle?.models ?? [],
          detectionClasses: bundle?.detectionClasses ?? [],
          enabledAt:        new Date().toISOString(),
          enabledBy:        user.uid,
        });
      }
    } catch (e) { console.error("toggleModule:", e); }
    finally    { setToggling(null); }
  }

  // Grouper : actifs en premier, puis disponibles, puis bientôt
  const ordered = [
    ...safeBundles.filter((b:any) => installed.has(b.id)),
    ...safeBundles.filter((b:any) => !installed.has(b.id) && (b.status==="available"||b.status==="beta")),
    ...safeBundles.filter((b:any) => !installed.has(b.id) && (b.status==="coming_soon"||b.status==="enterprise")),
  ];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/50 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">🧩 Modules IA</span>
          <span className="rounded-full bg-brand/20 border border-brand/30 px-2 py-0.5 text-xs text-brand">
            {installed.size} actif{installed.size !== 1 ? "s" : ""}
          </span>
          {installed.size > 0 && (
            <div className="flex gap-1">
              {Array.from(installed).slice(0, 4).map(id => {
                const b = safeBundles.find((b:any)=>b?.id===id);
                return b ? (
                  <span key={id} className="text-base" title={b.name}>{b.icon}</span>
                ) : null;
              })}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            {expanded ? "Réduire ▲" : "Gérer ▼"}
          </span>
        </div>
      </button>

      {/* Liste des modules */}
      {expanded && (
        <div className="border-t border-slate-800 p-3">
          <p className="text-xs text-slate-500 mb-3">
            Activez plusieurs modules en même temps — l'IA détecte toutes leurs classes simultanément
          </p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ordered.map(bundle => {
              const isOn       = installed.has(bundle.id);
              const isToggling = toggling === bundle.id;
              const canToggle  = bundle.status === "available" || bundle.status === "beta";
              const config     = MODULE_CONFIGS[bundle.id];
              const badge      = STATUS_BADGE[bundle.status as string] ?? STATUS_BADGE["available"];

              return (
                <button
                  key={bundle.id}
                  onClick={() => canToggle && toggleModule(bundle.id, isOn)}
                  disabled={isToggling || !canToggle}
                  title={
                    !canToggle
                      ? `${badge.label} — pas encore disponible`
                      : isOn
                      ? `Désactiver ${bundle.name}`
                      : `Activer ${bundle.name} (${config?.classes.length ?? "?"} classes)`
                  }
                  className={`relative flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all ${
                    isToggling
                      ? "animate-pulse border-slate-700 opacity-60"
                      : isOn
                      ? "border-2 shadow-sm"
                      : !canToggle
                      ? "border-slate-800 bg-slate-950 opacity-40 cursor-not-allowed"
                      : "border-slate-700 bg-slate-950 hover:border-slate-500 cursor-pointer"
                  }`}
                  style={isOn ? {
                    borderColor: bundle.color,
                    background:  bundle.color + "12",
                  } : {}}>

                  {/* Indicateur ON/OFF */}
                  <div className="absolute top-2 right-2">
                    {isToggling ? (
                      <span className="h-3 w-3 animate-spin rounded-full border border-slate-400 border-t-transparent block"/>
                    ) : isOn ? (
                      <div className="h-3 w-3 rounded-full animate-pulse"
                        style={{background: bundle.color}}/>
                    ) : canToggle ? (
                      <div className="h-3 w-3 rounded-full border border-slate-600"/>
                    ) : (
                      <span className="text-slate-600 text-xs">🔒</span>
                    )}
                  </div>

                  {/* Icône + nom */}
                  <span className="text-xl">{bundle.icon}</span>
                  <p className={`text-xs font-semibold leading-tight pr-4 ${isOn?"text-white":"text-slate-400"}`}>
                    {bundle.name}
                  </p>

                  {/* Badge statut ou classes */}
                  {isOn ? (
                    <p className="text-xs" style={{color: bundle.color}}>
                      ✅ {config?.classes.length ?? "?"} classes actives
                    </p>
                  ) : (
                    <span className={`text-xs border rounded-full px-1.5 py-0.5 ${badge.cls}`}>
                      {badge.label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Résumé des classes actives */}
          {installed.size > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-800">
              <p className="text-xs text-slate-500 mb-2">
                Classes détectées par les modules actifs ({
                  Array.from(installed).reduce((acc, id) => {
                    return acc + (MODULE_CONFIGS[id]?.classes.length ?? 0);
                  }, 0)
                } au total) :
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                {Array.from(installed).flatMap(id =>
                  MODULE_CONFIGS[id]?.classes.map(cls => ({
                    ...cls, moduleId: id,
                    color: safeBundles.find((b:any)=>b?.id===id)?.color ?? "#64748B",
                  })) ?? []
                ).map((cls, i) => (
                  <span key={i}
                    className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                    style={{
                      background: cls.color + "15",
                      border:     `1px solid ${cls.color}30`,
                      color:      cls.color,
                    }}>
                    {cls.icon} {cls.label}
                    {cls.alertOn && <span className="text-red-400">🚨</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Info coming soon */}
          <p className="mt-2 text-xs text-slate-700">
            🔒 Modules "Bientôt" et "Entreprise" — disponibles dans les prochaines mises à jour
          </p>
        </div>
      )}
    </div>
  );
}
