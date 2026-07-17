"use client";

import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useEvents, type EventWithCamera } from "@/lib/hooks/useEvents";

type Severity = "all" | "critical" | "warning" | "info";
type EventStatus = "all" | "open" | "acknowledged";

const SEVERITY_CONFIG = {
  critical: { label: "Critique",      color: "text-red-400 bg-red-400/10 border-red-800",      dot: "bg-red-500"    },
  warning:  { label: "Avertissement", color: "text-amber-400 bg-amber-400/10 border-amber-800", dot: "bg-amber-500"  },
  info:     { label: "Info",          color: "text-slate-400 bg-slate-800 border-slate-700",    dot: "bg-slate-500"  },
};

const TYPE_ICONS: Record<string, string> = {
  person: "🧍", vehicle: "🚗", car: "🚗", motorcycle: "🏍", truck: "🚛", bus: "🚌",
  fire: "🔥", smoke: "💨", animal: "🐾", dog: "🐕", cat: "🐈",
  object: "📦", license_plate: "🔢", ppe_violation: "⛑️",
};

/** Formatte un ISO string en libellé relatif ("il y a 5min"). */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Math.max(0, Date.now() - then);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  return `il y a ${d}j`;
}

export default function EventsPage() {
  const { events, loading, error, acknowledge } = useEvents();

  const [severityFilter, setSeverityFilter] = useState<Severity>("all");
  const [statusFilter,   setStatusFilter]   = useState<EventStatus>("all");
  const [search,         setSearch]         = useState("");
  const [selectedId,     setSelectedId]     = useState<string | null>(null);

  const selectedEvent = events.find((e) => e.id === selectedId) ?? null;

  const filtered = events.filter((e) => {
    if (severityFilter !== "all" && e.severity !== severityFilter) return false;
    if (statusFilter === "open"         && e.acknowledged)  return false;
    if (statusFilter === "acknowledged" && !e.acknowledged) return false;
    if (search && !e.cameraName.toLowerCase().includes(search.toLowerCase()) &&
                  !e.primaryType.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const criticalCount = events.filter((e) => e.severity === "critical" && !e.acknowledged).length;
  const openCount     = events.filter((e) => !e.acknowledged).length;

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-5">
      {/* ── Colonne gauche — liste ── */}
      <div className="flex w-[420px] shrink-0 flex-col">
        <PageHeader title="Events" description="Événements détectés et agrégés par le Event Engine." />

        {/* Compteurs rapides */}
        <div className="mb-4 flex gap-3">
          <div className="flex-1 rounded-xl border border-red-900/40 bg-red-900/10 px-4 py-3 text-center">
            <p className="text-2xl font-semibold text-red-400">{criticalCount}</p>
            <p className="text-xs text-red-500">Critiques ouverts</p>
          </div>
          <div className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-center">
            <p className="text-2xl font-semibold text-white">{openCount}</p>
            <p className="text-xs text-slate-500">Total ouverts</p>
          </div>
        </div>

        {/* Filtres */}
        <div className="mb-3 flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as EventStatus)}
            className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-slate-300"
          >
            <option value="all">Tous</option>
            <option value="open">Ouverts</option>
            <option value="acknowledged">Acquittés</option>
          </select>
        </div>

        {/* Filtre sévérité */}
        <div className="mb-4 flex gap-1.5">
          {(["all", "critical", "warning", "info"] as Severity[]).map((s) => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                severityFilter === s
                  ? "bg-brand text-white"
                  : "bg-slate-900 text-slate-400 hover:text-white"
              }`}
            >
              {s === "all" ? "Tous" : SEVERITY_CONFIG[s].label}
            </button>
          ))}
        </div>

        {/* Liste */}
        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {loading && (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-[76px] animate-pulse rounded-xl border border-slate-800 bg-slate-900/60" />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="rounded-xl border border-red-900/40 bg-red-900/10 p-4 text-center text-sm text-red-400">
              Impossible de charger les événements.
              <span className="mt-1 block text-xs text-red-500/80">{error}</span>
            </div>
          )}

          {!loading && !error && filtered.map((ev) => {
            const cfg = SEVERITY_CONFIG[ev.severity];
            const isSelected = selectedId === ev.id;
            const detectionCount = ev.detectionIds?.length ?? 0;
            return (
              <button
                key={ev.id}
                onClick={() => setSelectedId(ev.id)}
                className={`w-full rounded-xl border p-3 text-left transition-all ${
                  isSelected
                    ? "border-brand bg-brand/5"
                    : `border-slate-800 bg-slate-900 hover:border-slate-700`
                } ${ev.acknowledged ? "opacity-50" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-800 text-2xl">
                    {ev.thumbnailUrl
                      ? <img src={ev.thumbnailUrl} alt={ev.primaryType} className="h-full w-full object-cover" crossOrigin="anonymous" />
                      : (TYPE_ICONS[ev.primaryType] ?? "📷")}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      {!ev.acknowledged && (
                        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                      )}
                    </div>
                    <p className="mt-1 truncate text-xs font-medium text-slate-300">
                      {ev.cameraName}
                    </p>
                    <p className="text-xs text-slate-600">
                      {detectionCount} détection{detectionCount > 1 ? "s" : ""} · {ev.durationSeconds}s · {relativeTime(ev.createdAt)}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}

          {!loading && !error && filtered.length === 0 && (
            <div className="pt-10 text-center text-sm text-slate-600">
              {events.length === 0
                ? "Aucun événement pour le moment."
                : "Aucun événement correspondant aux filtres."}
            </div>
          )}
        </div>
      </div>

      {/* ── Colonne droite — détail ── */}
      <div className="flex-1 overflow-y-auto">
        {selectedEvent ? (
          <EventDetail event={selectedEvent} onAcknowledge={acknowledge} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-slate-600">
              Sélectionnez un événement pour voir le détail.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function EventDetail({
  event,
  onAcknowledge,
}: {
  event: EventWithCamera;
  onAcknowledge: (id: string) => void;
}) {
  const detectionCount = event.detectionIds?.length ?? 0;
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{TYPE_ICONS[event.primaryType] ?? "📷"}</span>
          <div>
            <h2 className="text-xl font-semibold capitalize text-white">
              {event.primaryType} — {SEVERITY_CONFIG[event.severity].label}
            </h2>
            <p className="text-sm text-slate-400">
              {event.cameraName} · {relativeTime(event.createdAt)}
            </p>
          </div>
        </div>

        {!event.acknowledged && (
          <button
            onClick={() => onAcknowledge(event.id)}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Acquitter
          </button>
        )}
      </div>

      {/* Métriques */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        {[
          { label: "Détections", value: detectionCount.toString() },
          { label: "Durée",      value: `${event.durationSeconds}s` },
          { label: "Statut",     value: event.acknowledged ? "Acquitté" : "Ouvert" },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-center">
            <p className="text-2xl font-semibold text-white">{m.value}</p>
            <p className="text-xs text-slate-500">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Snapshot / clip vidéo */}
      <div className="mb-6 overflow-hidden rounded-xl border border-slate-800 bg-black">
        {event.videoClipUrl ? (
          <video src={event.videoClipUrl} controls className="aspect-video w-full" crossOrigin="anonymous" />
        ) : event.thumbnailUrl ? (
          <img src={event.thumbnailUrl} alt={event.primaryType} className="aspect-video w-full object-contain" crossOrigin="anonymous" />
        ) : (
          <div className="flex aspect-video items-center justify-center text-sm text-slate-700">
            Aucun snapshot disponible pour cet événement.
          </div>
        )}
      </div>

      {/* Timeline des détections */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="mb-4 text-sm font-medium text-slate-300">
          Détections regroupées dans cet événement
        </h3>
        {detectionCount === 0 ? (
          <p className="text-xs text-slate-600">Aucune détection associée.</p>
        ) : (
          <div className="space-y-2">
            {event.detectionIds.map((detId, i) => (
              <div key={detId} className="flex items-center gap-3">
                <div className="h-px w-4 bg-slate-700" />
                <div className="h-1.5 w-1.5 rounded-full bg-brand" />
                <span className="truncate text-xs text-slate-500">
                  Détection #{i + 1} — {event.primaryType} · {detId}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
