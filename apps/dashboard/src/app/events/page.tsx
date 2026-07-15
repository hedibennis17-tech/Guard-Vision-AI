import { PageHeader } from "@/components/PageHeader";

export default function EventsPage() {
  return (
    <div>
      <PageHeader title="Events" description="Recherche, filtres et export des événements détectés." />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Rechercher un événement..."
          className="w-64 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600"
        />
        <button className="rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-300">
          Filtres
        </button>
        <button className="rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-300">
          Export
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex aspect-square items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-xs text-slate-600"
          >
            Snapshot / Vidéo
          </div>
        ))}
      </div>
    </div>
  );
}
