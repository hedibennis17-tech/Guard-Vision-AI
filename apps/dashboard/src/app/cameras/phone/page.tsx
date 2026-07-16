"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DetectionOverlay } from "@/components/DetectionOverlay";
import { useYoloDetection, type DetectionMode } from "@/lib/hooks/useYoloDetection";

type Step   = "intro" | "live" | "saving" | "done";
type Facing = "user" | "environment";

export default function PhoneCameraPage() {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);

  const [step,        setStep]        = useState<Step>("intro");
  const [facing,      setFacing]      = useState<Facing>("environment");
  const [cameraName,  setCameraName]  = useState("Mon téléphone");
  const [streamError, setStreamError] = useState<string | null>(null);
  const [detMode,     setDetMode]     = useState<DetectionMode>("off");
  const [serverUrl,   setServerUrl]   = useState("http://localhost:8000");
  const [showSettings, setShowSettings] = useState(false);
  const [resolution,  setResolution]  = useState({ w: 0, h: 0 });

  // Moteur de détection IA
  const { detections, isLoading, modelReady, fps: detFps, error: detError, mode }
    = useYoloDetection(videoRef, {
        mode:       detMode,
        serverUrl,
        fps:        8,
        confidence: 0.45,
      });

  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  async function startCamera(face: Facing = facing) {
    setStreamError(null);
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
        const s = stream.getVideoTracks()[0].getSettings();
        setResolution({ w: s.width ?? 0, h: s.height ?? 0 });
      }
      setStep("live");
    } catch (err: any) {
      setStreamError(
        err.name === "NotAllowedError"
          ? "Accès à la caméra refusé — autorisez-le dans les paramètres du navigateur."
          : "Impossible d'accéder à la caméra."
      );
    }
  }

  function flip() {
    const next: Facing = facing === "environment" ? "user" : "environment";
    setFacing(next);
    startCamera(next);
  }

  async function save() {
    setStep("saving");
    await new Promise((r) => setTimeout(r, 1000));
    setStep("done");
  }

  // ── Stats des détections ────────────────────────────────────────────────
  const detByClass = detections.reduce<Record<string, number>>((acc, d) => {
    acc[d.class] = (acc[d.class] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <Link href="/cameras/add" className="text-slate-400 hover:text-white">←</Link>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Caméra Téléphone / Webcam</span>
          {step === "live" && modelReady && detMode !== "off" && (
            <span className="rounded-full bg-emerald-500/10 border border-emerald-800 px-2 py-0.5 text-xs text-emerald-400">
              🤖 IA active
            </span>
          )}
        </div>
        <button onClick={() => setShowSettings(!showSettings)}
          className="text-slate-400 hover:text-white text-sm">⚙️</button>
      </div>

      {/* Panneau paramètres IA */}
      {showSettings && (
        <div className="border-b border-slate-800 bg-slate-900 px-6 py-4">
          <p className="mb-3 text-xs font-medium text-slate-400">Moteur de détection</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {[
              { id: "off",     label: "⛔ Désactivé" },
              { id: "browser", label: "🌐 Navigateur (TF.js)" },
              { id: "server",  label: "🐍 Python AI Engine" },
            ].map((opt) => (
              <button key={opt.id} onClick={() => setDetMode(opt.id as DetectionMode)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  detMode === opt.id
                    ? "border-brand bg-brand text-white"
                    : "border-slate-700 text-slate-400 hover:border-slate-500"
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
          {detMode === "server" && (
            <div>
              <label className="mb-1 block text-xs text-slate-500">URL du serveur Python AI Engine</label>
              <input value={serverUrl} onChange={(e) => setServerUrl(e.target.value)}
                placeholder="http://localhost:8000"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white" />
              <p className="mt-1 text-xs text-slate-600">
                Déployer le service sur Railway ou GCP Cloud Run pour l'utiliser en production.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Intro ── */}
      {step === "intro" && (
        <div className="mx-auto max-w-lg px-6 py-12 text-center">
          <span className="text-6xl">📱</span>
          <h1 className="mt-4 mb-2 text-2xl font-semibold">Caméra téléphone / webcam</h1>
          <p className="mb-8 text-slate-400">Testez Vision Guard avec votre caméra — aucun matériel requis.</p>
          {streamError && (
            <div className="mb-6 rounded-xl border border-red-800 bg-red-900/10 p-4 text-sm text-red-400">
              {streamError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button onClick={() => { setFacing("user"); startCamera("user"); }}
              className="rounded-xl border border-slate-700 bg-slate-900 p-4 hover:border-brand">
              <span className="text-3xl block mb-2">🖥️</span>
              <span className="text-sm font-medium">Webcam / caméra avant</span>
            </button>
            <button onClick={() => { setFacing("environment"); startCamera("environment"); }}
              className="rounded-xl bg-brand p-4">
              <span className="text-3xl block mb-2">📱</span>
              <span className="text-sm font-medium">Caméra arrière (mobile)</span>
            </button>
          </div>
          <p className="text-xs text-slate-600">Le navigateur demandera l'accès à votre caméra</p>
        </div>
      )}

      {/* ── Live ── */}
      {step === "live" && (
        <div className="mx-auto max-w-4xl px-6 py-6">
          <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Flux vidéo */}
            <div className="lg:col-span-2">
              <div className="relative overflow-hidden rounded-xl bg-black aspect-video">
                <video ref={videoRef} autoPlay playsInline muted
                  className="h-full w-full object-cover" />

                {/* Overlay détections YOLO */}
                <DetectionOverlay detections={detections} videoRef={videoRef} />

                {/* Badge LIVE */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                  <span className="text-xs font-medium">LIVE</span>
                </div>

                {/* Résolution */}
                {resolution.w > 0 && (
                  <div className="absolute bottom-3 left-3 rounded-lg bg-black/60 px-2 py-1 text-xs text-slate-400">
                    {resolution.w}×{resolution.h}
                  </div>
                )}

                {/* Stats IA */}
                {detMode !== "off" && (
                  <div className="absolute bottom-3 right-3 rounded-lg bg-black/70 px-2 py-1 text-xs">
                    {isLoading ? (
                      <span className="text-slate-400 flex items-center gap-1">
                        <span className="h-3 w-3 animate-spin rounded-full border border-brand border-t-transparent" />
                        Chargement modèle IA...
                      </span>
                    ) : modelReady ? (
                      <span className="text-emerald-400">
                        🤖 {detMode === "browser" ? "TF.js" : "YOLOv11"} · {detFps} FPS · {detections.length} détection{detections.length !== 1 ? "s" : ""}
                      </span>
                    ) : (
                      <span className="text-slate-500">IA en attente...</span>
                    )}
                  </div>
                )}

                {/* Bouton flip */}
                <button onClick={flip}
                  className="absolute top-3 right-3 rounded-full bg-black/60 p-2 hover:bg-black/80">
                  🔄
                </button>
              </div>

              {/* Contrôles */}
              <div className="mt-3 flex items-center justify-between">
                <div className="flex gap-2">
                  <button onClick={() => setDetMode(detMode === "off" ? "browser" : "off")}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      detMode !== "off"
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-slate-700 text-slate-400 hover:border-slate-500"
                    }`}>
                    🤖 {detMode !== "off" ? "IA active" : "Activer l'IA"}
                  </button>
                  <button onClick={flip}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:border-slate-500">
                    🔄 Retourner
                  </button>
                </div>
                <button
                  onClick={() => { streamRef.current?.getTracks().forEach((t) => t.stop()); setStep("intro"); setDetMode("off"); }}
                  className="text-xs text-slate-500 hover:text-slate-300">
                  ✕ Arrêter
                </button>
              </div>

              {/* Erreur détection */}
              {detError && (
                <div className="mt-2 rounded-lg border border-amber-800/50 bg-amber-900/10 px-3 py-2 text-xs text-amber-400">
                  ⚠️ {detError}
                  {detMode === "server" && (
                    <button onClick={() => setDetMode("browser")} className="ml-2 underline">
                      Passer en mode navigateur
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Panel droit */}
            <div className="space-y-4">
              {/* Détections en temps réel */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-400">DÉTECTIONS</h3>
                  {detMode !== "off" && modelReady && (
                    <span className="text-xs text-slate-600">{detFps} fps</span>
                  )}
                </div>

                {detMode === "off" ? (
                  <div className="text-center py-4">
                    <p className="text-xs text-slate-600 mb-2">IA désactivée</p>
                    <button onClick={() => setDetMode("browser")}
                      className="rounded-lg bg-brand/10 border border-brand/30 px-3 py-1.5 text-xs text-brand hover:bg-brand/20">
                      🤖 Activer la détection IA
                    </button>
                  </div>
                ) : isLoading ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-500">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                    Chargement du modèle IA...
                  </div>
                ) : detections.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-600">
                    Aucune détection pour l'instant —<br />déplacez-vous devant la caméra
                  </div>
                ) : (
                  <div className="space-y-2">
                    {detections.map((det, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-800 px-3 py-2">
                        <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: det.color }} />
                        <span className="flex-1 text-xs text-white capitalize">{det.class}</span>
                        <span className="text-xs font-medium" style={{ color: det.color }}>
                          {Math.round(det.score * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Mode IA sélectionné */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <h3 className="mb-3 text-xs font-semibold text-slate-400">MOTEUR IA</h3>
                <div className="space-y-2">
                  {[
                    { id:"browser" as DetectionMode, icon:"🌐", label:"TF.js (navigateur)", desc:"MobileNet · Rapide · Hors ligne" },
                    { id:"server"  as DetectionMode, icon:"🐍", label:"YOLOv11 (serveur)",  desc:"Précis · Nécessite le serveur Python" },
                  ].map((opt) => (
                    <button key={opt.id} onClick={() => setDetMode(detMode === opt.id ? "off" : opt.id)}
                      className={`w-full rounded-lg border p-3 text-left text-xs transition-colors ${
                        detMode === opt.id
                          ? "border-brand bg-brand/10"
                          : "border-slate-800 hover:border-slate-700"
                      }`}>
                      <p className="font-medium text-white">{opt.icon} {opt.label}</p>
                      <p className="mt-0.5 text-slate-500">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Ajouter comme caméra */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <h3 className="mb-3 text-xs font-semibold text-slate-400">ENREGISTRER</h3>
                <input value={cameraName} onChange={(e) => setCameraName(e.target.value)}
                  placeholder="Nom de la caméra"
                  className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-brand focus:outline-none" />
                <button onClick={save}
                  className="w-full rounded-lg bg-brand py-2.5 text-sm font-medium">
                  ✅ Enregistrer comme caméra permanente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Saving ── */}
      {step === "saving" && (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <p className="text-slate-400">Enregistrement...</p>
        </div>
      )}

      {/* ── Done ── */}
      {step === "done" && (
        <div className="mx-auto max-w-sm px-6 py-16 text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-500/10 text-4xl">✅</div>
          <h2 className="mb-2 text-xl font-semibold">{cameraName} ajoutée !</h2>
          <p className="mb-8 text-slate-400 text-sm">
            Disponible dans le Dashboard et le Live Monitor.
          </p>
          <div className="flex justify-center gap-3">
            <Link href="/cameras" className="rounded-lg bg-brand px-6 py-2.5 text-sm font-medium">
              Voir mes caméras →
            </Link>
            <Link href="/live-monitoring" className="rounded-lg border border-slate-700 px-6 py-2.5 text-sm text-slate-300">
              📺 Live Monitor
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
