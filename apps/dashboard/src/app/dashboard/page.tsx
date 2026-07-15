import { PageHeader } from "@/components/PageHeader";

const STAT_CARDS = [
  { label: "Caméras connectées", value: "—" },
  { label: "Événements aujourd'hui", value: "—" },
  { label: "Alertes actives", value: "—" },
  { label: "Dernière activité", value: "—" },
];

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Vue d'ensemble en temps réel de toutes vos organisations et caméras."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold text-white">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-4 text-sm font-medium text-slate-300">Graphiques d'activité</h2>
          <div className="flex h-48 items-center justify-center text-sm text-slate-600">
            Graphique à connecter (détections / temps)
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-4 text-sm font-medium text-slate-300">Carte des caméras</h2>
          <div className="flex h-48 items-center justify-center text-sm text-slate-600">
            Carte à connecter (positions caméras)
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="mb-4 text-sm font-medium text-slate-300">Dernières détections</h2>
        <div className="flex h-32 items-center justify-center text-sm text-slate-600">
          Aucune donnée pour le moment — connecter Firestore (collection `detections`)
        </div>
      </div>
    </div>
  );
}
