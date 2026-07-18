"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { checkSetup } from "@/lib/services/setupService";
import { ALL_MODULE_CONFIGS, type ModulePageConfig } from "@/lib/orchestrator/allModuleConfigs";

const STATUS_STYLE = {
  available:   { label:"✅ Disponible",  color:"#10B981", border:"border-emerald-800/40 bg-emerald-900/10" },
  beta:        { label:"🧪 Bêta",        color:"#F59E0B", border:"border-amber-800/40 bg-amber-900/10"    },
  coming_soon: { label:"🔜 Bientôt",     color:"#64748B", border:"border-slate-700 bg-slate-900"          },
  enterprise:  { label:"🏢 Entreprise",  color:"#8B5CF6", border:"border-purple-800/40 bg-purple-900/10"  },
};

const PLAN_STYLE = {
  free:       { label:"Gratuit",    color:"#10B981" },
  pro:        { label:"Pro",        color:"#0EA5E9" },
  enterprise: { label:"Entreprise", color:"#8B5CF6" },
};

export default function ModulesPage() {
  const [orgId,     setOrgId]     = useState<string|null>(null);
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [toggling,  setToggling]  = useState<string|null>(null);

  useEffect(() => {
    checkSetup().then(s => { if (s.organizationId) setOrgId(s.organizationId); });
  }, []);

  useEffect(() => {
    if (!orgId) return;
    const unsub = onSnapshot(
      collection(db, "organizations", orgId, "modules"),
      snap => setInstalled(new Set(snap.docs.filter(d=>d.data()?.enabled).map(d=>d.id)))
    );
    return unsub;
  }, [orgId]);

  async function toggle(moduleId: string) {
    if (!orgId) return;
    setToggling(moduleId);
    try {
      if (installed.has(moduleId)) {
        await deleteDoc(doc(db, "organizations", orgId, "modules", moduleId));
      } else {
        const cfg = ALL_MODULE_CONFIGS[moduleId];
        await setDoc(doc(db, "organizations", orgId, "modules", moduleId), {
          slug: moduleId, organizationId: orgId,
          name: cfg?.name ?? moduleId, enabled: true,
          enabledAt: new Date().toISOString(),
        });
      }
    } finally { setToggling(null); }
  }

  const modules = Object.values(ALL_MODULE_CONFIGS);
  const active  = modules.filter(m => installed.has(m.id));
  const rest    = modules.filter(m => !installed.has(m.id));

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">🧩 Modules IA</h1>
        <p className="text-sm text-slate-400">
          {active.length} module{active.length!==1?"s":""} actif{active.length!==1?"s":""}
          {" "}· {modules.length} modules disponibles
        </p>
      </div>

      {/* Modules actifs */}
      {active.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            ✅ MES MODULES ACTIFS
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {active.map(mod => (
              <ModuleCard key={mod.id} mod={mod} isInstalled={true}
                isToggling={toggling===mod.id} onToggle={()=>toggle(mod.id)}/>
            ))}
          </div>
        </div>
      )}

      {/* Tous les modules */}
      <div>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          {active.length > 0 ? "AUTRES MODULES DISPONIBLES" : "TOUS LES MODULES"}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rest.map(mod => (
            <ModuleCard key={mod.id} mod={mod} isInstalled={false}
              isToggling={toggling===mod.id} onToggle={()=>toggle(mod.id)}/>
          ))}
        </div>
      </div>
    </div>
  );
}

function ModuleCard({ mod, isInstalled, isToggling, onToggle }: {
  mod: ModulePageConfig;
  isInstalled: boolean; isToggling: boolean; onToggle: ()=>void;
}) {
  const status = STATUS_STYLE[mod.status as keyof typeof STATUS_STYLE] ?? STATUS_STYLE.available;
  const plan   = PLAN_STYLE[mod.plan as keyof typeof PLAN_STYLE] ?? PLAN_STYLE.pro;
  const canInstall = mod.status === "available" || mod.status === "beta";

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${
      isInstalled ? "border-2" : "border-slate-800 bg-slate-900"
    }`} style={isInstalled ? {borderColor:mod.color, background:`${mod.color}08`} : {}}>

      {/* Header carte */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl text-3xl"
            style={{background:`${mod.color}20`, border:`1px solid ${mod.color}40`}}>
            {mod.icon}
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${status.border}`}
              style={{color:status.color}}>
              {status.label}
            </span>
            <span className="text-xs" style={{color:plan.color}}>{plan.label}</span>
          </div>
        </div>

        <h3 className="text-sm font-bold text-white mb-1">{mod.name}</h3>
        <p className="text-xs text-slate-400 mb-3 leading-relaxed">
          {mod.tagline}
        </p>

        <div className="flex items-center gap-1.5 mb-4 flex-wrap">
          <span className="text-xs text-slate-600">{mod.detections.length} classes</span>
          <span className="text-slate-700">·</span>
          <span className="text-xs text-slate-600">{mod.locations.flatMap((l:any)=>l.locs).length} empl.</span>
          <span className="text-slate-700">·</span>
          <span className="text-xs text-slate-600">{mod.aiModels.length} modèles IA</span>
        </div>

        {/* Boutons */}
        <div className="flex gap-2">
          {canInstall && (
            <button onClick={onToggle} disabled={isToggling}
              className={`flex-1 rounded-xl py-2 text-xs font-bold transition-colors disabled:opacity-50 ${
                isInstalled
                  ? "border border-slate-700 bg-slate-800 text-slate-300 hover:border-red-700 hover:text-red-400"
                  : "text-white"
              }`}
              style={!isInstalled ? {background:mod.color} : {}}>
              {isToggling ? "⏳..." : isInstalled ? "Désinstaller" : "✅ Installer"}
            </button>
          )}

          {isInstalled && (
            <Link href={`/modules/${mod.id}`}
              className="flex-1 rounded-xl py-2 text-xs font-bold text-white text-center"
              style={{background:mod.color}}>
              Ouvrir →
            </Link>
          )}

          {!isInstalled && !canInstall && (
            <button disabled
              className="flex-1 rounded-xl border border-slate-700 py-2 text-xs text-slate-500 cursor-not-allowed">
              {status.label}
            </button>
          )}
        </div>
      </div>

      {/* Footer avec aperçu des modèles IA */}
      <div className="border-t border-slate-800 px-4 py-2.5">
        <div className="flex gap-1.5 flex-wrap">
          {mod.aiModels.slice(0, 3).map((m:string) => (
            <span key={m} className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-500">
              {m.split(" ")[0]}
            </span>
          ))}
          {mod.aiModels.length > 3 && (
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-600">
              +{mod.aiModels.length-3}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
