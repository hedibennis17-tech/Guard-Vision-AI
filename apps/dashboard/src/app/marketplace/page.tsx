"use client";

import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";

interface Module {
  slug: string; name: string; tagline: string; description: string;
  icon: string; status: "available"|"beta"|"coming_soon"; minimumPlan: string;
  features: string[]; useCases: string[]; price?: string; enabled: boolean;
}

const MODULES: Module[] = [
  { slug:"home",        name:"Vision Guard Home",         tagline:"Surveillance résidentielle",       icon:"🏠", status:"available",   minimumPlan:"free",       enabled:true,  price:undefined,
    features:["Détection de mouvement","Alertes push/email","Rapports PDF","Historique 14j"],
    useCases:["Maison","Appartement","Chalet"],
    description:"Protégez votre maison 24h/7j avec IA.",
  },
  { slug:"retail",      name:"Vision Guard Retail",        tagline:"Prévention des pertes",            icon:"🛒", status:"beta",         minimumPlan:"pro",        enabled:false, price:"+29$/mois",
    features:["Détection de vol","Rayons vides","Comptage clients","Heatmap zones"],
    useCases:["Supermarché","Boutique","Pharmacie"],
    description:"Protégez votre commerce et analysez le comportement client.",
  },
  { slug:"industry",    name:"Vision Guard Industry",      tagline:"Sécurité industrielle et EPI",     icon:"🏭", status:"coming_soon",  minimumPlan:"business",   enabled:false, price:"+49$/mois",
    features:["Détection EPI","Zones dangereuses","Comptage travailleurs","Feu/fumée"],
    useCases:["Usine","Entrepôt","Mine"],
    description:"Sécurité des employés avec détection EPI.",
  },
  { slug:"construction",name:"Vision Guard Construction",  tagline:"Chantiers sécurisés",              icon:"🏗️", status:"coming_soon",  minimumPlan:"business",   enabled:false, price:"+49$/mois",
    features:["Suivi engins","Détection chutes","Zones interdites","Rapports conformité"],
    useCases:["Chantier BTP","Démolition"],
    description:"Surveillez vos chantiers et garantissez la conformité.",
  },
  { slug:"smart_city",  name:"Vision Guard Smart City",    tagline:"Intelligence urbaine",             icon:"🌆", status:"coming_soon",  minimumPlan:"enterprise", enabled:false, price:"Sur devis",
    features:["Comptage véhicules","Infractions routières","Flux piétons","Feux intelligents"],
    useCases:["Municipalité","Autoroute","Aéroport"],
    description:"Optimisez votre ville avec l'IA Vision.",
  },
  { slug:"agriculture", name:"Vision Guard Agriculture",   tagline:"Exploitation agricole protégée",   icon:"🌾", status:"coming_soon",  minimumPlan:"pro",        enabled:false, price:"+19$/mois",
    features:["Surveillance troupeaux","Détection prédateurs","Périmètre","Alertes nocturnes"],
    useCases:["Ferme","Ranch","Vignoble"],
    description:"Protégez vos exploitations et vos animaux.",
  },
  { slug:"defense",     name:"Vision Guard Defense",       tagline:"Sécurité périmétrique critique",   icon:"🛡️", status:"coming_soon",  minimumPlan:"enterprise", enabled:false, price:"Sur devis",
    features:["Détection périmétrique","Drones","Analyse comportementale","On-premise"],
    useCases:["Base militaire","Ambassade","Prison"],
    description:"Sécurité haute criticité pour infrastructures sensibles.",
  },
];

const STATUS_BADGE: Record<string, string> = {
  available:   "bg-emerald-500/10 text-emerald-400 border-emerald-800",
  beta:        "bg-amber-500/10 text-amber-400 border-amber-800",
  coming_soon: "bg-slate-700/40 text-slate-400 border-slate-700",
};
const STATUS_LABEL: Record<string, string> = {
  available:"Disponible", beta:"Bêta", coming_soon:"Bientôt",
};

export default function MarketplacePage() {
  const [modules,   setModules]   = useState<Module[]>(MODULES);
  const [selected,  setSelected]  = useState<Module | null>(null);
  const [toggling,  setToggling]  = useState<string | null>(null);

  async function toggle(slug: string) {
    setToggling(slug);
    await new Promise((r) => setTimeout(r, 800)); // Cloud Function enableModule/disableModule
    setModules((prev) =>
      prev.map((m) => m.slug === slug ? { ...m, enabled: !m.enabled } : m)
    );
    if (selected?.slug === slug) {
      setSelected((prev) => prev ? { ...prev, enabled: !prev.enabled } : null);
    }
    setToggling(null);
  }

  const activeCount = modules.filter((m) => m.enabled).length;

  return (
    <div>
      <PageHeader
        title="Marketplace"
        description="Un seul moteur YOLOv11, des modules spécialisés par secteur d'activité."
      />

      {/* Header stats */}
      <div className="mb-6 flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900 px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="text-sm text-slate-300">{activeCount} module{activeCount>1?"s":""} actif{activeCount>1?"s":""}</span>
        </div>
        <div className="h-4 w-px bg-slate-700" />
        <span className="text-sm text-slate-500">Moteur : YOLOv11 · Même moteur pour tous les modules</span>
        <div className="ml-auto text-xs text-slate-600">
          Classes de détection chargées dynamiquement selon les modules actifs
        </div>
      </div>

      <div className="flex gap-6">
        {/* ── Grille de modules ── */}
        <div className="flex-1 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 content-start">
          {modules.map((mod) => (
            <div
              key={mod.slug}
              onClick={() => setSelected(mod)}
              className={`cursor-pointer rounded-xl border p-5 transition-all hover:border-slate-600 ${
                selected?.slug === mod.slug
                  ? "border-brand bg-brand/5"
                  : mod.enabled
                  ? "border-emerald-800/50 bg-emerald-900/5"
                  : "border-slate-800 bg-slate-900"
              }`}
            >
              <div className="mb-3 flex items-start justify-between">
                <span className="text-3xl">{mod.icon}</span>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[mod.status]}`}>
                    {STATUS_LABEL[mod.status]}
                  </span>
                  {mod.enabled && (
                    <span className="rounded-full bg-emerald-500/10 border border-emerald-800 px-2 py-0.5 text-xs text-emerald-400">
                      ✅ Actif
                    </span>
                  )}
                </div>
              </div>
              <h3 className="mb-1 text-sm font-semibold text-white">{mod.name}</h3>
              <p className="mb-3 text-xs text-slate-500">{mod.tagline}</p>
              {mod.price && (
                <p className="mb-3 text-xs font-medium text-brand">{mod.price}</p>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); if(mod.status!=="coming_soon") toggle(mod.slug); }}
                disabled={mod.status === "coming_soon" || toggling === mod.slug}
                className={`w-full rounded-lg py-2 text-xs font-medium transition-colors disabled:opacity-40 ${
                  mod.enabled
                    ? "border border-slate-700 text-slate-300 hover:border-red-800 hover:text-red-400"
                    : mod.status === "coming_soon"
                    ? "bg-slate-800 text-slate-600 cursor-not-allowed"
                    : "bg-brand text-white hover:bg-brand/90"
                }`}
              >
                {toggling === mod.slug
                  ? <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />...</span>
                  : mod.status === "coming_soon" ? "Bientôt disponible"
                  : mod.enabled ? "Désactiver"
                  : "Activer"
                }
              </button>
            </div>
          ))}
        </div>

        {/* ── Panneau de détail ── */}
        {selected && (
          <div className="w-80 shrink-0 rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div className="mb-5 flex items-center gap-3">
              <span className="text-4xl">{selected.icon}</span>
              <div>
                <h2 className="text-base font-semibold text-white">{selected.name}</h2>
                <p className="text-xs text-slate-500">{selected.minimumPlan} min.</p>
              </div>
            </div>

            <p className="mb-5 text-sm text-slate-400">{selected.description}</p>

            <div className="mb-5">
              <p className="mb-2 text-xs font-medium text-slate-400">Fonctionnalités</p>
              <ul className="space-y-1.5">
                {selected.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-slate-300">
                    <span className="text-brand">✓</span> {f}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mb-5">
              <p className="mb-2 text-xs font-medium text-slate-400">Cas d'usage</p>
              <div className="flex flex-wrap gap-1.5">
                {selected.useCases.map((u) => (
                  <span key={u} className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                    {u}
                  </span>
                ))}
              </div>
            </div>

            {selected.price && (
              <div className="mb-5 rounded-lg border border-brand/30 bg-brand/5 p-3 text-center">
                <p className="text-lg font-semibold text-brand">{selected.price}</p>
                <p className="text-xs text-slate-500">en plus de votre plan actuel</p>
              </div>
            )}

            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-xs text-slate-500">
              <p className="mb-1 font-medium text-slate-400">Architecture</p>
              <p>Même moteur YOLOv11 · Classes de détection chargées dynamiquement · Modèle fine-tuné si disponible</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
