"use client";

import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";

type DetectionType = "person" | "car" | "motorcycle" | "bus" | "truck" | "dog" | "cat" | "fire" | "smoke";

interface Detection {
  id: string;
  type: DetectionType;
  confidence: number;
  cameraName: string;
  detectedAt: string;
  snapshotUrl?: string;
}

const TYPE_CONFIG: Record<DetectionType, { icon: string; label: string; color: string }> = {
  person:     { icon: "🧍", label: "Personne",   color: "text-blue-400 bg-blue-400/10"    },
  car:        { icon: "🚗", label: "Voiture",    color: "text-slate-400 bg-slate-400/10"  },
  motorcycle: { icon: "🏍",  label: "Moto",       color: "text-slate-400 bg-slate-400/10"  },
  bus:        { icon: "🚌", label: "Bus",         color: "text-slate-400 bg-slate-400/10"  },
  truck:      { icon: "🚛", label: "Camion",     color: "text-slate-400 bg-slate-400/10"  },
  dog:        { icon: "🐕", label: "Chien",      color: "text-amber-400 bg-amber-400/10"  },
  cat:        { icon: "🐈", label: "Chat",       color: "text-amber-400 bg-amber-400/10"  },
  fire:       { icon: "🔥", label: "Feu",        color: "text-red-400 bg-red-400/10"      },
  smoke:      { icon: "💨", label: "Fumée",      color: "text-orange-400 bg-orange-400/10"},
};

// Données démo — remplacées par Firestore realtime (Phase 6 Event Engine)
const DEMO_DETECTIONS: Detection[] = [
  { id: "d1", type: "person",  confidence: 0.96, cameraName: "Entrée principale", detectedAt: "il y a 12s"  },
  { id: "d2", type: "car",     confidence: 0.89, cameraName: "Parking",           detectedAt: "il y a 34s"  },
  { id: "d3", type: "person",  confidence: 0.91, cameraName: "Couloir A",         detectedAt: "il y a 1min" },
  { id: "d4", type: "dog",     confidence: 0.82, cameraName: "Cour arrière",      detectedAt: "il y a 3min" },
  { id: "d5", type: "fire",    confidence: 0.77, cameraName: "Entrepôt",          detectedAt: "il y a 5min" },
];

const STAT_CARDS = [
  { label: "Personnes",    type: "person" as DetectionType, count: 14 },
  { label: "Véhicules",   type: "car"    as DetectionType, count: 7  },
  { label: "Animaux",     type: "dog"    as DetectionType, count: 2  },
  { label: "Feu / Fumée", type: "fire"   as DetectionType, count: 1  },
];

export default function AiDetectionPage() {
  const [filter, setFilter] = useState<DetectionType | "all">("all");
  const [engineStatus] = useState<"running" | "stopped">("running");

  const filtered = filter === "all"
    ? DEMO_DETECTIONS
    : DEMO_DETECTIONS.filter((d) => d.type === filter);

  return (
    <div>
      <PageHeader
        title="AI Detection"
        description="Détections YOLOv11 en temps réel sur tous les flux caméras actifs."
      />

      {/* Status moteur */}
      <div className="mb-6 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-5 py-3">
        <div className="flex items-center gap-3">
          <div className={`h-2.5 w-2.5 rounded-full ${engineStatus === "running" ? "animate-pulse bg-emerald-500" : "bg-red-500"}`} />
          <span className="text-sm font-medium text-white">
            AI Engine — YOLOv11{" "}
            <span className={engineStatus === "running" ? "text-emerald-400" : "text-red-400"}>
              {engineStatus === "running" ? "En ligne" : "Hors ligne"}
            </span>
          </span>
        </div>
        <div className="flex gap-4 text-xs text-slate-500">
          <span>Modèle : yolo11m.pt</span>
          <span>Device : CPU</span>
          <span>Streams actifs : 4</span>
        </div>
      </div>

      {/* Stats par type */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STAT_CARDS.map((card) => {
          const cfg = TYPE_CONFIG[card.type];
          return (
            <button
              key={card.type}
              onClick={() => setFilter(filter === card.type ? "all" : card.type)}
              className={`rounded-xl border p-4 text-left transition-colors ${
                filter === card.type
                  ? "border-brand bg-brand/10"
                  : "border-slate-800 bg-slate-900 hover:border-slate-700"
              }`}
            >
              <span className="text-2xl">{cfg.icon}</span>
              <p className="mt-2 text-2xl font-semibold text-white">{card.count}</p>
              <p className="text-xs text-slate-400">{card.label} aujourd'hui</p>
            </button>
          );
        })}
      </div>

      {/* Filtre rapide */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            filter === "all" ? "bg-brand text-white" : "bg-slate-900 text-slate-400 hover:text-slate-200"
          }`}
        >
          Toutes
        </button>
        {(Object.keys(TYPE_CONFIG) as DetectionType[]).map((type) => (
          <button
            key={type}
            onClick={() => setFilter(filter === type ? "all" : type)}
            className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === type ? "bg-brand text-white" : "bg-slate-900 text-slate-400 hover:text-slate-200"
            }`}
          >
            {TYPE_CONFIG[type].icon} {TYPE_CONFIG[type].label}
          </button>
        ))}
      </div>

      {/* Liste des détections en temps réel */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="border-b border-slate-800 px-5 py-3 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-300">Détections récentes</span>
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Temps réel — Firestore listener (Phase 6)
          </span>
        </div>

        <div className="divide-y divide-slate-800">
          {filtered.map((det) => {
            const cfg = TYPE_CONFIG[det.type];
            return (
              <div key={det.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-800/50">
                {/* Snapshot placeholder */}
                <div className="h-12 w-16 shrink-0 rounded-lg bg-slate-800 flex items-center justify-center text-xl">
                  {cfg.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    {det.type === "fire" || det.type === "smoke" ? (
                      <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400 font-medium">
                        🚨 Alerte
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {det.cameraName} · {det.detectedAt}
                  </p>
                </div>

                {/* Confiance */}
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-white">
                    {Math.round(det.confidence * 100)}%
                  </p>
                  <p className="text-xs text-slate-600">confiance</p>
                </div>

                {/* Barre de confiance */}
                <div className="hidden sm:block w-24 shrink-0">
                  <div className="h-1.5 w-full rounded-full bg-slate-800">
                    <div
                      className="h-1.5 rounded-full bg-brand"
                      style={{ width: `${det.confidence * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-slate-600">
              Aucune détection de ce type aujourd'hui.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
