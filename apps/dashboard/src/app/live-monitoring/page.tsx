"use client";

import { useState } from "react";
import type { GridLayout } from "@visionguard/shared";

const GRID_LAYOUTS: GridLayout[] = [
  { id: "1x1",  label: "1 caméra",   cols: 1, rows: 1, maxCameras: 1  },
  { id: "1x2",  label: "2 caméras",  cols: 2, rows: 1, maxCameras: 2  },
  { id: "2x2",  label: "4 caméras",  cols: 2, rows: 2, maxCameras: 4  },
  { id: "3x3",  label: "9 caméras",  cols: 3, rows: 3, maxCameras: 9  },
  { id: "4x4",  label: "16 caméras", cols: 4, rows: 4, maxCameras: 16 },
];

const MOCK_CAMERAS = [
  { id: "cam1", name: "Entrée principale",  status: "live" },
  { id: "cam2", name: "Parking",            status: "live" },
  { id: "cam3", name: "Couloir A",          status: "live" },
  { id: "cam4", name: "Salle serveurs",     status: "offline" },
  { id: "cam5", name: "Réception",          status: "live" },
  { id: "cam6", name: "Sortie de secours",  status: "live" },
  { id: "cam7", name: "Entrepôt",           status: "live" },
  { id: "cam8", name: "Bureau direction",   status: "live" },
  { id: "cam9", name: "Cour arrière",       status: "live" },
];

type Quality = "auto" | "hd" | "sd" | "low";

export default function LiveMonitoringPage() {
  const [layoutId, setLayoutId] = useState("2x2");
  const [quality, setQuality] = useState<Quality>("auto");
  const [fullscreenCam, setFullscreenCam] = useState<string | null>(null);
  const [mutedCams, setMutedCams] = useState<Set<string>>(new Set());

  const layout = GRID_LAYOUTS.find((l) => l.id === layoutId) ?? GRID_LAYOUTS[2];
  const visibleCameras = MOCK_CAMERAS.slice(0, layout.maxCameras);

  function toggleMute(camId: string) {
    setMutedCams((prev) => {
      const next = new Set(prev);
      next.has(camId) ? next.delete(camId) : next.add(camId);
      return next;
    });
  }

  // Vue plein écran — une seule caméra
  if (fullscreenCam) {
    const cam = MOCK_CAMERAS.find((c) => c.id === fullscreenCam)!;
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black">
        {/* Header */}
        <div className="flex items-center justify-between bg-black/80 px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            <span className="text-sm font-medium text-white">{cam.name}</span>
            <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400">LIVE</span>
          </div>
          <button
            onClick={() => setFullscreenCam(null)}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-white"
          >
            ✕ Quitter plein écran
          </button>
        </div>

        {/* Stream */}
        <div className="flex flex-1 items-center justify-center bg-slate-950">
          <div className="relative h-full w-full">
            <div className="flex h-full items-center justify-center text-slate-600 text-sm">
              {/* En production : <video src={hlsUrl} autoPlay playsInline /> */}
              Flux HLS — {cam.name}
            </div>
            {/* Overlay IA (Phase 5) */}
            <div className="absolute bottom-4 left-4 rounded-lg bg-black/60 px-3 py-2 text-xs text-slate-300">
              🤖 IA Detection — Phase 5
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-6 bg-black/80 py-4">
          <button className="flex flex-col items-center gap-1 text-slate-400 hover:text-white">
            <span>⏸</span><span className="text-xs">Pause</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-slate-400 hover:text-white">
            <span>📷</span><span className="text-xs">Capture</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-slate-400 hover:text-white">
            <span>⏺</span><span className="text-xs">Enregistrer</span>
          </button>
          <button
            onClick={() => toggleMute(fullscreenCam)}
            className={`flex flex-col items-center gap-1 ${mutedCams.has(fullscreenCam) ? "text-red-400" : "text-slate-400 hover:text-white"}`}
          >
            <span>{mutedCams.has(fullscreenCam) ? "🔇" : "🔊"}</span>
            <span className="text-xs">Audio</span>
          </button>
          <div className="flex flex-col items-center gap-1">
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value as Quality)}
              className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300"
            >
              <option value="auto">Auto</option>
              <option value="hd">HD 720p</option>
              <option value="sd">SD 480p</option>
              <option value="low">Low 240p</option>
            </select>
            <span className="text-xs text-slate-500">Qualité</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-white">Live Monitor</h1>
        <div className="ml-2 flex items-center gap-1">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          <span className="text-xs text-red-400 font-medium">LIVE</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Sélecteur de grille */}
          <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
            {GRID_LAYOUTS.map((l) => (
              <button
                key={l.id}
                onClick={() => setLayoutId(l.id)}
                className={`rounded px-2.5 py-1 text-xs transition-colors ${
                  layoutId === l.id
                    ? "bg-brand text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* Qualité globale */}
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value as Quality)}
            className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-slate-300"
          >
            <option value="auto">Auto</option>
            <option value="hd">HD 720p</option>
            <option value="sd">SD 480p</option>
            <option value="low">Low 240p</option>
          </select>
        </div>
      </div>

      {/* Grille de caméras */}
      <div
        className="flex-1 grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${layout.cols}, 1fr)` }}
      >
        {visibleCameras.map((cam) => (
          <div
            key={cam.id}
            className="group relative flex flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-950"
          >
            {/* Stream */}
            <div className="flex flex-1 items-center justify-center bg-black text-xs text-slate-700">
              {cam.status === "offline"
                ? "📵 Hors ligne"
                : `Flux HLS — ${cam.name}`
              }
              {/* En production : <video src={hlsUrl} autoPlay playsInline muted={mutedCams.has(cam.id)} /> */}
            </div>

            {/* Overlay header */}
            <div className="absolute top-0 left-0 right-0 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-2 py-1.5 opacity-0 transition-opacity group-hover:opacity-100">
              <div className="flex items-center gap-1.5">
                {cam.status === "live" && (
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                )}
                <span className="text-xs text-white">{cam.name}</span>
              </div>
              <button
                onClick={() => setFullscreenCam(cam.id)}
                className="text-slate-400 hover:text-white text-xs"
                title="Plein écran"
              >
                ⛶
              </button>
            </div>

            {/* Overlay controls (bas) */}
            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 opacity-0 transition-opacity group-hover:opacity-100">
              <div className="flex gap-2">
                <button
                  onClick={() => toggleMute(cam.id)}
                  className={`text-xs ${mutedCams.has(cam.id) ? "text-red-400" : "text-slate-300 hover:text-white"}`}
                >
                  {mutedCams.has(cam.id) ? "🔇" : "🔊"}
                </button>
                <button className="text-xs text-slate-300 hover:text-white">📷</button>
                <button className="text-xs text-slate-300 hover:text-white">⏺</button>
              </div>
              {/* Badge IA Phase 5 */}
              <span className="rounded bg-brand/20 px-1.5 py-0.5 text-xs text-brand">🤖 IA</span>
            </div>

            {/* Badge statut */}
            {cam.status === "offline" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <span className="rounded-lg bg-red-900/40 px-3 py-1.5 text-xs text-red-400">
                  Caméra hors ligne
                </span>
              </div>
            )}
          </div>
        ))}

        {/* Cases vides si moins de caméras que la grille */}
        {Array.from({ length: Math.max(0, layout.maxCameras - visibleCameras.length) }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="flex items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-950 text-xs text-slate-700"
          >
            + Ajouter une caméra
          </div>
        ))}
      </div>
    </div>
  );
}
