"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useOrganization } from "@/lib/context/OrganizationContext";
import { AI_BUNDLES, BUNDLE_STATUS_LABELS } from "@/lib/orchestrator/bundles";
import { MODULE_CONFIGS } from "@/lib/orchestrator/moduleConfigs";

export default function ModulesPage() {
  const { currentOrg } = useOrganization();
  const [installed, setInstalled] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!currentOrg?.id) return;
    getDocs(collection(db,"organizations",currentOrg.id,"modules"))
      .then(s => setInstalled(new Set(s.docs.filter(d=>d.data()?.enabled).map(d=>d.id))))
      .catch(()=>{});
  }, [currentOrg?.id]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Modules IA</h1>
        <p className="mt-1 text-sm text-slate-400">
          Testez chaque module avec votre webcam — segmentations et analytics spécifiques à chaque secteur
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {AI_BUNDLES.map(bundle => {
          const config    = MODULE_CONFIGS[bundle.id];
          const isActive  = installed.has(bundle.id);
          const statusDef = BUNDLE_STATUS_LABELS[bundle.status];
          const canTest   = bundle.status === "available" || bundle.status === "beta";

          return (
            <div key={bundle.id}
              className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden flex flex-col">
              {/* Header coloré */}
              <div className="p-5" style={{ background: bundle.color + "15", borderBottom:`1px solid ${bundle.color}20` }}>
                <div className="flex items-start justify-between mb-3">
                  <span className="text-4xl">{bundle.icon}</span>
                  <div className="flex flex-col items-end gap-1">
                    {isActive && (
                      <span className="rounded-full bg-emerald-900/40 border border-emerald-700 px-2 py-0.5 text-xs text-emerald-400">
                        ✅ Installé
                      </span>
                    )}
                    <span className="rounded-full border px-2 py-0.5 text-xs"
                      style={{ color:statusDef.color, borderColor:statusDef.color+"40", background:statusDef.color+"10" }}>
                      {statusDef.label}
                    </span>
                  </div>
                </div>
                <h2 className="text-base font-semibold text-white">{bundle.name}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{bundle.tagline}</p>
              </div>

              {/* Classes détectées */}
              <div className="px-4 py-3 flex-1">
                <p className="text-xs text-slate-500 mb-2">Détections ({config?.classes.length ?? 0} classes)</p>
                <div className="flex flex-wrap gap-1">
                  {(config?.classes ?? []).slice(0, 6).map(cls => (
                    <span key={cls.cocoClass}
                      className="rounded-full px-2 py-0.5 text-xs"
                      style={{ background:cls.color+"15", color:cls.color, border:`1px solid ${cls.color}30` }}>
                      {cls.icon} {cls.label}
                    </span>
                  ))}
                  {(config?.classes.length ?? 0) > 6 && (
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-500">
                      +{(config?.classes.length ?? 0) - 6}
                    </span>
                  )}
                </div>
              </div>

              {/* Stats preview */}
              {config?.stats && (
                <div className="px-4 pb-3 grid grid-cols-2 gap-1.5">
                  {config.stats.slice(0,4).map(stat => (
                    <div key={stat.id} className="rounded-lg bg-slate-950 px-2 py-1.5">
                      <p className="text-xs text-slate-600 truncate">{stat.icon} {stat.label}</p>
                      <p className="text-sm font-bold text-slate-400">—</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Bouton tester */}
              <div className="px-4 pb-4">
                {canTest ? (
                  <Link href={`/modules/${bundle.id}`}
                    className="flex items-center justify-center gap-2 w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
                    style={{ background: bundle.color }}>
                    📷 Tester ce module
                  </Link>
                ) : (
                  <button disabled
                    className="w-full rounded-xl border border-slate-700 py-2.5 text-sm text-slate-500 cursor-not-allowed">
                    {bundle.status === "enterprise" ? "🔒 Entreprise" : "🔜 Bientôt disponible"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
