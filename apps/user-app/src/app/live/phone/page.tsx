"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export default function PhoneLivePage() {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [active,    setActive]    = useState(false);
  const [facing,    setFacing]    = useState<"user"|"environment">("environment");
  const [error,     setError]     = useState<string | null>(null);
  const [snapshot,  setSnapshot]  = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [resolution, setResolution] = useState({ w: 0, h: 0 });

  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  async function start(face: "user" | "environment" = facing) {
    setError(null);
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: face, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings();
        setResolution({ w: settings.width ?? 0, h: settings.height ?? 0 });
      }
      setActive(true);
    } catch (err: any) {
      setError(err.name === "NotAllowedError"
        ? "Accès refusé — autorisez la caméra dans vos paramètres."
        : "Impossible d'accéder à la caméra.");
    }
  }

  function stop() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
    setSnapshot(null);
  }

  function flip() {
    const next = facing === "environment" ? "user" : "environment";
    setFacing(next);
    start(next);
  }

  function capture() {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    setSnapshot(c.toDataURL("image/jpeg", 0.85));
  }

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-12 pb-3">
        <Link href="/live" className="text-slate-400">←</Link>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Caméra téléphone</span>
          {active && <span className="flex items-center gap-1 text-xs text-red-400"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />LIVE</span>}
        </div>
        {active && (
          <button onClick={flip} className="text-slate-400 hover:text-white">🔄</button>
        )}
        {!active && <div className="w-6" />}
      </div>

      {/* Flux vidéo */}
      <div className="relative flex-1 bg-slate-950">
        {active ? (
          <video ref={videoRef} autoPlay playsInline muted
            className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
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
                <p className="text-5xl">📱</p>
                <p className="text-slate-400 text-sm">Utilisez votre téléphone comme caméra de surveillance</p>
                <button onClick={() => start()} className="rounded-xl bg-brand px-8 py-3 text-base font-medium">
                  Activer la caméra
                </button>
              </>
            )}
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />

        {/* Snapshot overlay */}
        {snapshot && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="rounded-xl border-2 border-white overflow-hidden shadow-2xl">
              <img src={snapshot} alt="snapshot" className="max-h-48 object-cover" />
            </div>
          </div>
        )}

        {/* Résolution */}
        {active && resolution.w > 0 && (
          <div className="absolute bottom-3 left-3 rounded-lg bg-black/50 px-2 py-1 text-xs text-slate-400">
            {resolution.w}×{resolution.h}
          </div>
        )}
      </div>

      {/* Contrôles */}
      {active && (
        <div className="grid grid-cols-4 gap-3 bg-slate-900/95 px-4 py-4">
          {[
            { icon: "📷", label: "Capture", action: capture },
            { icon: recording ? "⏹" : "⏺", label: recording ? "Stop" : "Rec", action: () => setRecording(!recording), red: recording },
            { icon: "🔄",  label: "Flip",    action: flip },
            { icon: "⏹",  label: "Arrêter", action: stop },
          ].map((ctrl) => (
            <button key={ctrl.label} onClick={ctrl.action}
              className={`flex flex-col items-center gap-1 rounded-xl border py-3 text-xs ${
                ctrl.red ? "border-red-800 bg-red-900/20 text-red-400" : "border-slate-800 bg-slate-800 text-slate-300"
              }`}>
              <span className="text-xl">{ctrl.icon}</span>
              <span>{ctrl.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
