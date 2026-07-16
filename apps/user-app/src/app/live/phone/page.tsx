"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DetectionOverlay } from "@/components/DetectionOverlay";
import { useYoloDetection, type DetectionMode } from "@/lib/hooks/useYoloDetection";

export default function PhoneLivePage() {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active,  setActive]  = useState(false);
  const [facing,  setFacing]  = useState<"user"|"environment">("environment");
  const [error,   setError]   = useState<string | null>(null);
  const [aiOn,    setAiOn]    = useState(false);

  const { detections, isLoading, modelReady, fps }
    = useYoloDetection(videoRef, { mode: aiOn ? "browser" : "off", fps: 8, confidence: 0.45 });

  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);

  async function start(face: "user"|"environment" = facing) {
    setError(null);
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: face, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setActive(true);
    } catch (e: any) {
      setError(e.name === "NotAllowedError" ? "Accès refusé — autorisez la caméra." : "Caméra introuvable.");
    }
  }

  function flip() {
    const next = facing === "environment" ? "user" : "environment" as typeof facing;
    setFacing(next); start(next);
  }

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-12 pb-3">
        <Link href="/live" className="text-slate-400 text-lg">←</Link>
        <div className="flex items-center gap-2 text-sm font-medium">
          Caméra téléphone
          {active && aiOn && modelReady && (
            <span className="rounded-full bg-emerald-900/50 border border-emerald-700 px-2 py-0.5 text-xs text-emerald-400">
              🤖 IA {fps}fps
            </span>
          )}
        </div>
        {active && <button onClick={flip} className="text-slate-400 text-lg">🔄</button>}
        {!active && <div className="w-6" />}
      </div>

      {/* Flux */}
      <div className="relative flex-1 bg-slate-950">
        {active ? (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            <DetectionOverlay detections={detections} videoRef={videoRef} />

            {/* Badge LIVE */}
            <div className="absolute top-4 left-4 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              <span className="text-xs">LIVE</span>
            </div>

            {/* Détections */}
            {aiOn && detections.length > 0 && (
              <div className="absolute top-4 right-4 flex flex-col gap-1">
                {detections.slice(0, 4).map((d, i) => (
                  <div key={i} className="flex items-center gap-1.5 rounded-lg bg-black/70 px-2 py-1">
                    <div className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="text-xs text-white capitalize">{d.class}</span>
                    <span className="text-xs font-medium" style={{ color: d.color }}>
                      {Math.round(d.score * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Loading IA */}
            {aiOn && isLoading && (
              <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-xl bg-black/70 px-4 py-2 text-xs text-slate-300">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                Chargement modèle IA...
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-5 px-6 text-center">
            {error ? (
              <>
                <p className="text-4xl">🚫</p>
                <p className="text-sm text-red-400">{error}</p>
                <button onClick={() => start()} className="rounded-xl bg-brand px-6 py-2.5 text-sm font-medium">
                  Réessayer
                </button>
              </>
            ) : (
              <>
                <p className="text-6xl">📱</p>
                <p className="text-sm text-slate-400">Utilisez votre téléphone comme caméra de surveillance avec détection IA</p>
                <button onClick={() => start()} className="rounded-2xl bg-brand px-10 py-4 text-base font-medium">
                  Activer la caméra
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Contrôles */}
      {active && (
        <div className="grid grid-cols-4 gap-2 bg-slate-900 px-4 py-3">
          <button onClick={() => setAiOn(!aiOn)}
            className={`flex flex-col items-center gap-1 rounded-xl border py-3 text-xs ${
              aiOn ? "border-brand bg-brand/10 text-brand" : "border-slate-700 text-slate-400"
            }`}>
            <span className="text-xl">{aiOn ? "🤖" : "🤖"}</span>
            <span>{aiOn ? "IA ON" : "IA OFF"}</span>
          </button>
          <button onClick={flip}
            className="flex flex-col items-center gap-1 rounded-xl border border-slate-700 py-3 text-xs text-slate-400">
            <span className="text-xl">🔄</span><span>Flip</span>
          </button>
          <button className="flex flex-col items-center gap-1 rounded-xl border border-slate-700 py-3 text-xs text-slate-400">
            <span className="text-xl">📷</span><span>Capture</span>
          </button>
          <button onClick={() => { streamRef.current?.getTracks().forEach((t) => t.stop()); setActive(false); setAiOn(false); }}
            className="flex flex-col items-center gap-1 rounded-xl border border-slate-700 py-3 text-xs text-slate-400">
            <span className="text-xl">⏹</span><span>Arrêter</span>
          </button>
        </div>
      )}
    </div>
  );
}
