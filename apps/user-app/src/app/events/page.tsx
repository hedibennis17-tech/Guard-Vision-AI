"use client";

import { useState } from "react";

const TYPE_ICONS: Record<string, string> = {
  person: "🧍", car: "🚗", fire: "🔥", smoke: "💨", dog: "🐕",
};

const SEVERITY_COLORS = {
  critical: "border-l-red-500 bg-red-900/10",
  warning:  "border-l-amber-500 bg-amber-900/10",
  info:     "border-l-slate-600 bg-slate-900/10",
};

const DEMO_EVENTS = [
  { id: "e1", type: "fire",   severity: "critical" as const, camera: "Entrepôt",          time: "il y a 2min",  count: 3  },
  { id: "e2", type: "person", severity: "warning"  as const, camera: "Entrée principale", time: "il y a 5min",  count: 7  },
  { id: "e3", type: "person", severity: "warning"  as const, camera: "Parking",           time: "il y a 12min", count: 2  },
  { id: "e4", type: "car",    severity: "info"     as const, camera: "Sortie",            time: "il y a 1h",    count: 4  },
  { id: "e5", type: "dog",    severity: "info"     as const, camera: "Cour arrière",      time: "il y a 2h",    count: 1  },
];

export default function EventsPage() {
  const [filter, setFilter] = useState<"all" | "critical" | "warning">("all");

  const filtered = filter === "all"
    ? DEMO_EVENTS
    : DEMO_EVENTS.filter((e) => e.severity === filter);

  return (
    <div className="px-4 pt-8">
      <h1 className="mb-4 text-xl font-semibold">Événements</h1>

      {/* Filtres */}
      <div className="mb-4 flex gap-2">
        {[
          { key: "all",      label: "Tous"      },
          { key: "critical", label: "🚨 Critiques" },
          { key: "warning",  label: "⚠️ Alertes" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as typeof filter)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              filter === f.key
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className="space-y-2">
        {filtered.map((ev) => (
          <div
            key={ev.id}
            className={`flex items-center gap-3 rounded-2xl border-l-4 border border-slate-200 bg-white p-3 ${SEVERITY_COLORS[ev.severity]}`}
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-2xl">
              {TYPE_ICONS[ev.type] ?? "📷"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{ev.camera}</p>
              <p className="text-xs text-slate-500">
                {ev.count} détection{ev.count > 1 ? "s" : ""} · {ev.time}
              </p>
            </div>
            <button className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600">
              Voir
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
