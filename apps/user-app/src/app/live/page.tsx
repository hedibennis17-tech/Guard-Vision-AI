"use client";

import { useState } from "react";

type Quality = "auto" | "hd" | "sd" | "low";

const CAMERAS = [
  { id: "cam1", name: "Salon" },
  { id: "cam2", name: "Garage" },
  { id: "cam3", name: "Entrée" },
  { id: "cam4", name: "Cour arrière" },
];

export default function LivePage() {
  const [selectedCam, setSelectedCam] = useState(CAMERAS[0]);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused]     = useState(false);
  const [isMuted, setIsMuted]       = useState(true);
  const [quality, setQuality]       = useState<Quality>("auto");
  const [showCamList, setShowCamList] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-black">

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-12 pb-2">
        <button
          onClick={() => setShowCamList(!showCamList)}
          className="flex items-center gap-2 text-white"
        >
          <span className="text-sm font-medium">{selectedCam.name}</span>
          <span className="text-xs text-slate-400">▾</span>
        </button>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          <span className="text-xs font-medium text-red-400">LIVE</span>
        </div>
      </div>

      {/* Camera switcher dropdown */}
      {showCamList && (
        <div className="mx-4 mb-2 overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          {CAMERAS.map((cam) => (
            <button
              key={cam.id}
              onClick={() => { setSelectedCam(cam); setShowCamList(false); }}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm border-b border-slate-800 last:border-0 ${
                cam.id === selectedCam.id ? "text-brand" : "text-slate-300"
              }`}
            >
              <span className="h-8 w-12 rounded bg-slate-800 flex-shrink-0" />
              {cam.name}
              {cam.id === selectedCam.id && <span className="ml-auto text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}

      {/* Stream principal */}
      <div className="relative mx-4 overflow-hidden rounded-2xl bg-slate-950 aspect-video">
        <div className="flex h-full items-center justify-center text-xs text-slate-700">
          {/* En production : <video src={hlsUrl} autoPlay playsInline muted={isMuted} /> */}
          Flux HLS — {selectedCam.name}
        </div>

        {/* Overlay pause */}
        {isPaused && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="text-4xl text-white opacity-60">⏸</span>
          </div>
        )}

        {/* Badge enregistrement */}
        {isRecording && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            <span className="text-xs text-white font-medium">REC</span>
          </div>
        )}

        {/* Badge qualité */}
        <div className="absolute bottom-3 left-3 rounded-lg bg-black/60 px-2 py-1 text-xs text-slate-400">
          {quality.toUpperCase()}
        </div>
      </div>

      {/* Contrôles principaux */}
      <div className="mx-4 mt-4 grid grid-cols-5 gap-2">
        {[
          { icon: isPaused ? "▶️" : "⏸", label: isPaused ? "Play" : "Pause", action: () => setIsPaused(!isPaused) },
          { icon: "📷", label: "Capture", action: () => {} },
          { icon: isRecording ? "⏹" : "⏺", label: isRecording ? "Stop" : "Rec", action: () => setIsRecording(!isRecording), active: isRecording },
          { icon: isMuted ? "🔇" : "🔊", label: isMuted ? "Activé" : "Muet", action: () => setIsMuted(!isMuted) },
        ].map((ctrl) => (
          <button
            key={ctrl.label}
            onClick={ctrl.action}
            className={`flex flex-col items-center gap-1 rounded-xl border py-3 text-xs ${
              ctrl.active
                ? "border-red-500 bg-red-500/10 text-red-400"
                : "border-slate-800 bg-slate-900 text-slate-400"
            }`}
          >
            <span className="text-lg">{ctrl.icon}</span>
            <span>{ctrl.label}</span>
          </button>
        ))}

        {/* Qualité */}
        <div className="flex flex-col items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 py-2">
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value as Quality)}
            className="w-full bg-transparent text-center text-xs text-slate-400"
          >
            <option value="auto">Auto</option>
            <option value="hd">HD</option>
            <option value="sd">SD</option>
            <option value="low">Low</option>
          </select>
          <span className="text-xs text-slate-600">Qualité</span>
        </div>
      </div>

      {/* Miniatures autres caméras */}
      <div className="mx-4 mt-4">
        <p className="mb-2 text-xs text-slate-600">Autres caméras</p>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {CAMERAS.filter((c) => c.id !== selectedCam.id).map((cam) => (
            <button
              key={cam.id}
              onClick={() => setSelectedCam(cam)}
              className="flex flex-col items-center gap-1 flex-shrink-0"
            >
              <div className="h-16 w-24 rounded-lg border border-slate-800 bg-slate-900 flex items-center justify-center text-xs text-slate-700">
                Live
              </div>
              <span className="text-xs text-slate-500">{cam.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
