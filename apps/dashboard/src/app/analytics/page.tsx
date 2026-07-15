import { PageHeader } from "@/components/PageHeader";

const CATEGORIES = ["Personnes", "Véhicules", "Animaux", "Objets"];

export default function AnalyticsPage() {
  return (
    <div>
      <PageHeader title="Analytics" description="Graphiques et heatmaps par catégorie de détection." />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {CATEGORIES.map((cat) => (
          <div key={cat} className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-center">
            <p className="text-sm text-slate-400">{cat}</p>
            <p className="mt-2 text-2xl font-semibold text-white">—</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-4 text-sm font-medium text-slate-300">Graphiques (tendances)</h2>
          <div className="flex h-56 items-center justify-center text-sm text-slate-600">
            À connecter — collection `analytics`
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-4 text-sm font-medium text-slate-300">Heatmaps</h2>
          <div className="flex h-56 items-center justify-center text-sm text-slate-600">
            À connecter — collection `heatmaps`
          </div>
        </div>
      </div>
    </div>
  );
}
