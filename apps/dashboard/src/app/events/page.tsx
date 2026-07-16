"use client";

import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";

type Severity = "all" | "critical" | "warning" | "info";
type EventStatus = "all" | "open" | "acknowledged";

interface EventItem {
  id: string;
  primaryType: string;
  severity: "critical" | "warning" | "info";
  cameraName: string;
  detectionCount: number;
  durationSeconds: number;
  acknowledged: boolean;
  createdAt: string;
  thumbnailUrl?: string;
}

const SEVERITY_CONFIG = {
  critical: { label: "Critique",    color: "text-red-400 bg-red-400/10 border-red-800",      dot: "bg-red-500"    },
  warning:  { label: "Avertissement", color: "text-amber-400 bg-amber-400/10 border-amber-800", dot: "bg-amber-500"  },
  info:     { label: "Info",         color: "text-slate-400 bg-slate-800 border-slate-700",    dot: "bg-slate-500"  },
};

const TYPE_ICONS: Record<string, string> = {
  person: "🧍", car: "🚗", motorcycle: "🏍", truck: "🚛", bus: "🚌",
  fire: "🔥", smoke: "💨", dog: "🐕", cat: "🐈", ppe_violation: "⛑️",
};

// Données démo — remplacées par Firestore realtime (collection `events`)
const DEMO_EVENTS: EventItem[] = [
  { id: "e1", primaryType: "fire",   severity: "critical", cameraName: "Entrepôt",           detectionCount: 3,  durationSeconds: 18,  acknowledged: false, createdAt: "il y a 2min"  },
  { id: "e2", primaryType: "person", severity: "critical", cameraName: "Entrée principale",  detectionCount: 7,  durationSeconds: 42,  acknowledged: false, createdAt: "il y a 5min"  },
  { id: "e3", primaryType: "person", severity: "warning",  cameraName: "Parking",            detectionCount: 2,  durationSeconds: 8,   acknowledged: false, createdAt: "il y a 12min" },
  { id: "e4", primaryType: "car",    severity: "info",     cameraName: "Entrée véhicules",   detectionCount: 4,  durationSeconds: 25,  acknowledged: true,  createdAt: "il y a 1h"    },
  { id: "e5", primaryType: "dog",    severity: "info",     cameraName: "Cour arrière",       detectionCount: 1,  durationSeconds: 3,   acknowledged: true,  createdAt: "il y a 2h"    },
  { id: "e6", primaryType: "smoke",  severity: "critical", cameraName: "Cuisine",            detectionCount: 5,  durationSeconds: 30,  acknowledged: true,  createdAt: "il y a 3h"    },
];

export default function EventsPage() {
  const [severityFilter, setSeverityFilter] = useState<Severity>("all");
  const [statusFilter,   setStatusFilter]   = useState<EventStatus>("all");
  const [search,         setSearch]         = useState("");
  const [selectedEvent,  setSelectedEvent]  = useState<EventItem | null>(null);
  const [events,         setEvents]         = useState<EventItem[]>(DEMO_EVENTS);

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

  function acknowledge(eventId: string) {
    setEvents((prev) =>
      prev.map((e) => e.id === eventId ? { ...e, acknowledged: true } : e)
    );
    if (selectedEvent?.id === eventId) {
      setSelectedEvent((prev) => prev ? { ...prev, acknowledged: true } : null);
    }
    // En production : appeler la Cloud Function acknowledgeEvent()
  }

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
          {filtered.map((ev) => {
            const cfg = SEVERITY_CONFIG[ev.severity];
            const isSelected = selectedEvent?.id === ev.id;
            return (
              <button
                key={ev.id}
                onClick={() => setSelectedEvent(ev)}
                className={`w-full rounded-xl border p-3 text-left transition-all ${
                  isSelected
                    ? "border-brand bg-brand/5"
                    : `border-slate-800 bg-slate-900 hover:border-slate-700`
                } ${ev.acknowledged ? "opacity-50" : ""}`}
              >
                <div className="flex items-start gap-3">
                  {/* Thumbnail */}
                  <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-2xl">
                    {TYPE_ICONS[ev.primaryType] ?? "📷"}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      {!ev.acknowledged && (
                        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                      )}
                    </div>
                    <p className="mt-1 text-xs font-medium text-slate-300 truncate">
                      {ev.cameraName}
                    </p>
                    <p className="text-xs text-slate-600">
                      {ev.detectionCount} détection{ev.detectionCount > 1 ? "s" : ""} · {ev.durationSeconds}s · {ev.createdAt}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}

          {filtered.length === 0 && (
            <div className="pt-10 text-center text-sm text-slate-600">
              Aucun événement correspondant.
            </div>
          )}
        </div>
      </div>

      {/* ── Colonne droite — détail ── */}
      <div className="flex-1 overflow-y-auto">
        {selectedEvent ? (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{TYPE_ICONS[selectedEvent.primaryType] ?? "📷"}</span>
                <div>
                  <h2 className="text-xl font-semibold text-white capitalize">
                    {selectedEvent.primaryType} — {SEVERITY_CONFIG[selectedEvent.severity].label}
                  </h2>
                  <p className="text-sm text-slate-400">
                    {selectedEvent.cameraName} · {selectedEvent.createdAt}
                  </p>
                </div>
              </div>

              {!selectedEvent.acknowledged && (
                <button
                  onClick={() => acknowledge(selectedEvent.id)}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                >
                  ✅ Acquitter
                </button>
              )}
            </div>

            {/* Métriques */}
            <div className="mb-6 grid grid-cols-3 gap-4">
              {[
                { label: "Détections",  value: selectedEvent.detectionCount.toString() },
                { label: "Durée",       value: `${selectedEvent.durationSeconds}s`     },
                { label: "Statut",      value: selectedEvent.acknowledged ? "Acquitté" : "Ouvert" },
              ].map((m) => (
                <div key={m.label} className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-center">
                  <p className="text-2xl font-semibold text-white">{m.value}</p>
                  <p className="text-xs text-slate-500">{m.label}</p>
                </div>
              ))}
            </div>

            {/* Thumbnail / Video */}
            <div className="mb-6 overflow-hidden rounded-xl border border-slate-800 bg-black">
              <div className="flex aspect-video items-center justify-center text-sm text-slate-700">
                {selectedEvent.primaryType === "fire" || selectedEvent.primaryType === "smoke"
                  ? "🔥 Snapshot critique — clip vidéo disponible après Phase 6 (EventAggregator)"
                  : "📷 Snapshot de détection — clip vidéo généré par EventAggregator (Python)"
                }
              </div>
            </div>

            {/* Timeline des détections */}
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <h3 className="mb-4 text-sm font-medium text-slate-300">
                Timeline des détections de cet événement
              </h3>
              <div className="space-y-2">
                {Array.from({ length: selectedEvent.detectionCount }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-px w-4 bg-slate-700" />
                    <div className="h-1.5 w-1.5 rounded-full bg-brand" />
                    <span className="text-xs text-slate-500">
                      Détection #{i + 1} — {selectedEvent.primaryType} · {Math.floor(Math.random() * 30) + 1}s
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
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
