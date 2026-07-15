import { PageHeader } from "@/components/PageHeader";

export default function LiveMonitoringPage() {
  return (
    <div>
      <PageHeader
        title="Live Monitoring"
        description="Mosaïque de toutes les caméras en direct, plein écran et timeline."
      />

      <div className="mb-4 flex gap-2 text-sm">
        <button className="rounded-lg bg-brand px-3 py-1.5 text-white">Mosaïque</button>
        <button className="rounded-lg border border-slate-800 px-3 py-1.5 text-slate-300">
          Plein écran
        </button>
        <button className="rounded-lg border border-slate-800 px-3 py-1.5 text-slate-300">
          Timeline
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex aspect-video items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-xs text-slate-600"
          >
            Flux caméra {i + 1}
          </div>
        ))}
      </div>
    </div>
  );
}
