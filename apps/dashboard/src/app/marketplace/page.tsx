import { PageHeader } from "@/components/PageHeader";

const MODULES = [
  { name: "Vision Guard Home", status: "Actif", desc: "Surveillance résidentielle, mouvement, alertes." },
  { name: "Vision Guard Retail", status: "Bientôt", desc: "Self-checkout, ruptures de stock, prévention des pertes." },
  { name: "Vision Guard Industry", status: "Bientôt", desc: "EPI, fumée, zones dangereuses, comptage travailleurs." },
  { name: "Vision Guard Construction", status: "Bientôt", desc: "Suivi engins, détection chutes, zones interdites." },
  { name: "Vision Guard Smart City", status: "Bientôt", desc: "Trafic, stationnement, comptage piétons." },
];

export default function MarketplacePage() {
  return (
    <div>
      <PageHeader
        title="Marketplace"
        description="Modules IA activables — un seul moteur, plusieurs verticaux."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((mod) => (
          <div key={mod.name} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-medium text-white">{mod.name}</h3>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  mod.status === "Actif"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-slate-700/40 text-slate-400"
                }`}
              >
                {mod.status}
              </span>
            </div>
            <p className="text-sm text-slate-400">{mod.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
