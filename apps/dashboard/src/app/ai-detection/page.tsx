import { PageHeader } from "@/components/PageHeader";

export default function AiDetectionPage() {
  return (
    <div>
      <PageHeader
        title="AI Detection"
        description="Moteur YOLOv11 — détections en temps réel sur tous les flux caméras."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {["Personnes", "Véhicules", "Feu / Fumée", "Anomalies"].map((type) => (
          <div key={type} className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-center">
            <p className="text-xs text-slate-400">{type}</p>
            <p className="mt-2 text-2xl font-semibold text-white">—</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/50 p-10 text-center">
        <p className="text-sm font-medium text-slate-400">Phase 5 — Intégration YOLOv11</p>
        <p className="mt-2 text-xs text-slate-600">
          Le moteur reçoit un streamUrl normalisé (RTSP) depuis le Camera Connector Engine.<br />
          Il ne connaît jamais le type de connecteur (Ring, Hikvision, ONVIF...).
        </p>
      </div>
    </div>
  );
}
