"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Step = "intro" | "permission" | "live" | "saving" | "done";
type CameraFacing = "user" | "environment";

export default function PhoneCameraPage() {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);

  const [step,        setStep]        = useState<Step>("intro");
  const [facing,      setFacing]      = useState<CameraFacing>("environment");
  const [error,       setError]       = useState<string | null>(null);
  const [cameraName,  setCameraName]  = useState("Mon téléphone");
  const [snapshot,    setSnapshot]    = useState<string | null>(null);
  const [devices,     setDevices]     = useState<MediaDeviceInfo[]>([]);

  // Nettoyer le stream quand on quitte la page
  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  // Lister les caméras disponibles
  async function listDevices() {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(all.filter((d) => d.kind === "videoinput"));
    } catch {}
  }

  // Démarrer la caméra
  async function startCamera(facingMode: CameraFacing = facing) {
    setError(null);
    try {
      // Arrêter le stream précédent
      streamRef.current?.getTracks().forEach((t) => t.stop());

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode,
          width:  { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      await listDevices();
      setStep("live");
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        setError("Accès à la caméra refusé. Autorisez l'accès dans les paramètres de votre navigateur.");
      } else if (err.name === "NotFoundError") {
        setError("Aucune caméra trouvée sur cet appareil.");
      } else {
        setError(`Erreur : ${err.message}`);
      }
      setStep("permission");
    }
  }

  // Capturer un snapshot
  function takeSnapshot() {
    if (!videoRef.current || !canvasRef.current) return;
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setSnapshot(dataUrl);
  }

  // Retourner la caméra (avant / arrière)
  function flipCamera() {
    const next: CameraFacing = facing === "environment" ? "user" : "environment";
    setFacing(next);
    startCamera(next);
  }

  // Sauvegarder comme caméra permanente
  async function saveCamera() {
    setStep("saving");
    // En production : appeler addCamera() + connectCamera() via Cloud Functions
    await new Promise((r) => setTimeout(r, 1200));
    setStep("done");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-800 px-6 py-4">
        <Link href="/cameras/add" className="text-slate-400 hover:text-white">←</Link>
        <span className="text-sm font-medium">Caméra Téléphone / Webcam</span>
        <span className="ml-2 rounded-full bg-brand/20 border border-brand/40 px-2 py-0.5 text-xs text-brand">
          WebRTC
        </span>
      </div>

      <div className="mx-auto max-w-2xl px-6 py-8">

        {/* ── Intro ── */}
        {step === "intro" && (
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-slate-800 text-5xl">
              📱
            </div>
            <h1 className="mb-2 text-2xl font-semibold">Caméra téléphone / webcam</h1>
            <p className="mb-2 text-slate-400">
              Utilisez la caméra de votre téléphone ou de votre ordinateur directement dans Vision Guard.
            </p>
            <p className="mb-8 text-sm text-slate-500">
              Idéal pour tester la plateforme sans caméra IP dédiée.
            </p>

            {/* Deux modes */}
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 text-left">
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                <p className="mb-1 font-medium">🖥️ Webcam de cet appareil</p>
                <p className="text-xs text-slate-500 mb-3">
                  Utilise la caméra intégrée ou branchée à cet ordinateur via WebRTC.
                </p>
                <button onClick={() => { setFacing("user"); startCamera("user"); }}
                  className="w-full rounded-lg bg-brand py-2 text-sm font-medium">
                  Utiliser ma webcam
                </button>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                <p className="mb-1 font-medium">📱 Caméra arrière (mobile)</p>
                <p className="text-xs text-slate-500 mb-3">
                  Ouvrez cette page sur votre téléphone et utilisez la caméra arrière.
                </p>
                <button onClick={() => { setFacing("environment"); startCamera("environment"); }}
                  className="w-full rounded-lg border border-slate-700 py-2 text-sm font-medium text-slate-300 hover:border-brand hover:text-brand">
                  Caméra arrière
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Votre navigateur demandera l'autorisation d'accès à la caméra.
            </p>
          </div>
        )}

        {/* ── Permission / Erreur ── */}
        {step === "permission" && (
          <div className="text-center">
            {error ? (
              <div className="mb-6 rounded-xl border border-red-800 bg-red-900/10 p-6">
                <p className="text-3xl mb-3">🚫</p>
                <p className="text-sm text-red-400">{error}</p>
              </div>
            ) : (
              <div className="mb-6 flex items-center justify-center gap-3 text-slate-400">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                Demande d'accès à la caméra...
              </div>
            )}
            <button onClick={() => startCamera()}
              className="rounded-lg bg-brand px-6 py-2 text-sm font-medium">
              Réessayer
            </button>
          </div>
        )}

        {/* ── Live ── */}
        {step === "live" && (
          <div>
            {/* Flux vidéo */}
            <div className="relative mb-4 overflow-hidden rounded-xl bg-black aspect-video">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              {/* Badge LIVE */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                <span className="text-xs font-medium text-white">LIVE</span>
              </div>
              {/* Retourner caméra */}
              {devices.length > 1 && (
                <button onClick={flipCamera}
                  className="absolute top-3 right-3 rounded-full bg-black/60 p-2 text-white hover:bg-black/80">
                  🔄
                </button>
              )}
              {/* Snapshot preview */}
              {snapshot && (
                <img src={snapshot} alt="snapshot"
                  className="absolute bottom-3 right-3 h-16 w-24 rounded-lg border-2 border-white object-cover shadow-lg" />
              )}
            </div>
            {/* Canvas caché pour les snapshots */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Contrôles */}
            <div className="mb-6 flex justify-center gap-3">
              <button onClick={takeSnapshot}
                className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300 hover:border-slate-500">
                📷 Capture
              </button>
              {devices.length > 1 && (
                <button onClick={flipCamera}
                  className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300 hover:border-slate-500">
                  🔄 Retourner
                </button>
              )}
            </div>

            {/* Infos flux */}
            <div className="mb-6 rounded-xl border border-emerald-800/30 bg-emerald-900/10 p-4 text-sm text-emerald-400">
              ✅ Flux actif · WebRTC · {videoRef.current?.videoWidth ?? 0}×{videoRef.current?.videoHeight ?? 0}
            </div>

            {/* Sauvegarder comme caméra permanente */}
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="mb-1 font-medium">Ajouter comme caméra permanente</h2>
              <p className="mb-4 text-sm text-slate-500">
                La caméra sera enregistrée dans votre organisation et visible dans le Dashboard.
              </p>
              <div className="mb-4">
                <label className="mb-1 block text-xs text-slate-400">Nom de la caméra</label>
                <input value={cameraName} onChange={(e) => setCameraName(e.target.value)}
                  placeholder="ex: Bureau principal"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-brand focus:outline-none" />
              </div>
              <div className="flex gap-3">
                <button onClick={saveCamera}
                  className="flex-1 rounded-lg bg-brand py-2.5 text-sm font-medium">
                  ✅ Enregistrer cette caméra
                </button>
                <button onClick={() => { streamRef.current?.getTracks().forEach((t) => t.stop()); setStep("intro"); }}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:text-slate-200">
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Saving ── */}
        {step === "saving" && (
          <div className="py-16 text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-brand border-t-transparent" />
            <p className="text-slate-400">Enregistrement de la caméra...</p>
          </div>
        )}

        {/* ── Done ── */}
        {step === "done" && (
          <div className="py-10 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-500/10 text-4xl">
              ✅
            </div>
            <h2 className="mb-2 text-xl font-semibold">Caméra ajoutée !</h2>
            <p className="mb-8 text-slate-400">
              <strong className="text-white">{cameraName}</strong> est maintenant disponible dans votre Dashboard.
            </p>
            <div className="flex justify-center gap-3">
              <Link href="/cameras"
                className="rounded-lg bg-brand px-6 py-2.5 text-sm font-medium">
                Voir mes caméras →
              </Link>
              <Link href="/live-monitoring"
                className="rounded-lg border border-slate-700 px-6 py-2.5 text-sm text-slate-300 hover:border-slate-500">
                📺 Live Monitor
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
