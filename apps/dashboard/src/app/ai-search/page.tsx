import { PageHeader } from "@/components/PageHeader";

export default function AiSearchPage() {
  return (
    <div>
      <PageHeader
        title="AI Search"
        description="Recherche conversationnelle sur les événements et détections."
      />

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-4 flex h-64 flex-col justify-end gap-3 overflow-y-auto text-sm">
          <div className="max-w-md rounded-lg bg-slate-800 px-4 py-2 text-slate-300">
            Exemple : « Montre-moi les personnes détectées hier. »
          </div>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Poser une question sur vos caméras..."
            className="flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600"
          />
          <button className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}
