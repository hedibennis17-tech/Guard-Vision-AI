"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DetectionOverlay } from "@/components/DetectionOverlay";
import { useYoloDetection, type Detection, type DetectionMode } from "@/lib/hooks/useYoloDetection";
import { saveDetection, saveCameraToFirestore } from "@/lib/detection/detectionSaver";
import { getClassDef, CATEGORY_LABELS } from "@/lib/detection/classMap";
import { useOrganization } from "@/lib/context/OrganizationContext";

type Step = "intro" | "live" | "saving" | "done";

// Historique des alertes récentes (en mémoire — pour la session)
interface Alert {
  id:        string;
  class:     string;
  label:     string;
  score:     number;
  color:     string;
  severity:  string;
  time:      string;
  saved:     boolean;
}

export default function PhoneCameraPage() {
  const router     = useRouter();
  const { currentOrg } = useOrganization();

  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraId  = useRef<string | null>(null);

  const [step,        setStep]        = useState<Step>("intro");
  const [facing,      setFacing]      = useState<"user"|"environment">("environment");
  const [cameraName,  setCameraName]  = useState("Mon téléphone");
  const [streamError, setStreamError] = useState<string | null>(null);
  const [detMode,     setDetMode]     = useState<DetectionMode>("off");
  const [serverUrl,   setServerUrl]   = useState("http://localhost:8000");
  const [alerts,      setAlerts]      = useState<Alert[]>([]);
  const [saveStatus,  setSaveStatus]  = useState<"idle"|"saving_det"|"saved_det">("idle");
  const [autoSave,    setAutoSave]    = useState(true);

  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);

  // ── Callback quand une détection arrive ───────────────────────────────
  const handleDetection = useCallback(async (dets: Detection[]) => {
    const now = new Date().toLocaleTimeString("fr-CA", { hour:"2-digit", minute:"2-digit", second:"2-digit" });

    setAlerts((prev) => {
      const newAlerts: Alert[] = dets.map((d) => ({
        id:       `${Date.now()}-${d.class}`,
        class:    d.class,
        label:    d.label,
        score:    d.score,
        color:    d.color,
        severity: d.severity,
        time:     now,
        saved:    false,
      }));
      return [...newAlerts, ...prev].slice(0, 20); // garder 20 alertes max
    });

    // Sauvegarder dans Firebase si auto-save activé
    if (autoSave && currentOrg?.id && cameraId.current && videoRef.current) {
      setSaveStatus("saving_det");
      for (const det of dets) {
        await saveDetection({
          organizationId: currentOrg.id,
          cameraId:       cameraId.current,
          detection:      det,
          videoElement:   videoRef.current,
        });
      }
      setSaveStatus("saved_det");
      setTimeout(() => setSaveStatus("idle"), 2000);

      // Marquer les alertes comme sauvegardées
      setAlerts((prev) => prev.map((a) =>
        dets.some((d) => d.class === a.class) ? { ...a, saved: true } : a
      ));
    }
  }, [autoSave, currentOrg?.id]);

  const { detections, isLoading, modelReady, fps, error: detError }
    = useYoloDetection(videoRef, { mode:detMode, serverUrl, fps:8, confidence:0.40, onDetection:handleDetection });

  // ── Démarrer la caméra ────────────────────────────────────────────────
  async function startCamera(face: "user"|"environment" = facing) {
    setStreamError(null);
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode:face, width:{ideal:1280}, height:{ideal:720} }, audio:false,
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setStep("live");
    } catch (e: any) {
      setStreamError(e.name === "NotAllowedError" ? "Accès refusé." : "Caméra introuvable.");
    }
  }

  function flip() {
    const next = facing === "environment" ? "user" : "environment" as typeof facing;
    setFacing(next); startCamera(next);
  }

  // ── Enregistrer la caméra dans Firebase ──────────────────────────────
  async function saveCameraToDb() {
    if (!currentOrg?.id) {
      router.push("/login");
      return;
    }
    setStep("saving");
    try {
      const result = await saveCameraToFirestore({
        organizationId: currentOrg.id,
        name:           cameraName,
        connector:      "phone_webcam",
        brand:          navigator.userAgent.includes("iPhone") ? "Apple" :
                        navigator.userAgent.includes("Android") ? "Android" : "Webcam",
        timezone:       Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      cameraId.current = result.cameraId;
      setStep("done");
    } catch (err: any) {
      alert(err.message);
      setStep("live");
    }
  }

  // Comptage par catégorie
  const byCategory = detections.reduce<Record<string, number>>((acc, d) => {
    acc[d.category] = (acc[d.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <Link href="/cameras/add" className="text-slate-400 hover:text-white">←</Link>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Vision Guard · Webcam</span>
          {detMode !== "off" && modelReady && (
            <span className="rounded-full bg-brand/20 border border-brand/30 px-2 py-0.5 text-xs text-brand">
              🤖 {detMode === "browser" ? "TF.js" : "YOLOv11"} · {fps}fps
            </span>
          )}
        </div>
        <Link href="/cameras" className="text-xs text-slate-400 hover:text-white">Mes caméras</Link>
      </div>

      {/* ── Intro ── */}
      {step === "intro" && (
        <div className="mx-auto max-w-lg px-6 py-12 text-center">
          <span className="text-6xl">📱</span>
          <h1 className="mt-4 mb-2 text-2xl font-semibold">Caméra Téléphone / Webcam</h1>
          <p className="mb-2 text-slate-400">Détection IA en temps réel sur votre flux vidéo.</p>
          {!currentOrg && (
            <div className="my-4 rounded-xl border border-amber-800 bg-amber-900/10 p-3 text-sm text-amber-400">
              ⚠️ Connectez-vous pour sauvegarder les détections dans Firebase.
              <Link href="/login" className="ml-2 underline">Se connecter →</Link>
            </div>
          )}
          {streamError && (
            <div className="my-4 rounded-xl border border-red-800 bg-red-900/10 p-3 text-sm text-red-400">
              {streamError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 mt-6">
            <button onClick={() => { setFacing("user"); startCamera("user"); }}
              className="rounded-xl border border-slate-700 bg-slate-900 p-5 hover:border-brand text-center">
              <span className="text-4xl block mb-2">🖥️</span>
              <span className="text-sm font-medium block">Webcam / Avant</span>
              <span className="text-xs text-slate-500">Face</span>
            </button>
            <button onClick={() => { setFacing("environment"); startCamera("environment"); }}
              className="rounded-xl bg-brand p-5 text-center">
              <span className="text-4xl block mb-2">📱</span>
              <span className="text-sm font-medium block">Caméra arrière</span>
              <span className="text-xs text-white/70">Mobile</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Live ── */}
      {step === "live" && (
        <div className="mx-auto max-w-5xl px-4 py-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

            {/* Flux + overlay */}
            <div className="lg:col-span-2 space-y-3">
              <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
                <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                <DetectionOverlay detections={detections} videoRef={videoRef} />

                {/* Badges */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                  <span className="text-xs font-medium">LIVE</span>
                </div>

                {/* IA status */}
                <div className="absolute bottom-3 right-3 rounded-lg bg-black/70 px-2 py-1 text-xs">
                  {detMode === "off" ? <span className="text-slate-500">IA désactivée</span>
                    : isLoading ? <span className="text-brand flex gap-1"><span className="h-3 w-3 animate-spin rounded-full border border-brand border-t-transparent" /> Chargement modèle...</span>
                    : modelReady ? <span className="text-emerald-400">🤖 {fps} fps · {detections.length} obj</span>
                    : <span className="text-slate-500">En attente...</span>}
                </div>

                {/* Save status */}
                {saveStatus === "saving_det" && (
                  <div className="absolute top-3 right-3 rounded-lg bg-brand/80 px-2 py-1 text-xs text-white">
                    💾 Sauvegarde...
                  </div>
                )}
                {saveStatus === "saved_det" && (
                  <div className="absolute top-3 right-3 rounded-lg bg-emerald-600/80 px-2 py-1 text-xs text-white">
                    ✅ Enregistré
                  </div>
                )}
              </div>

              {/* Contrôles IA */}
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setDetMode(detMode === "off" ? "browser" : "off")}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    detMode !== "off" ? "border-brand bg-brand/10 text-brand" : "border-slate-700 text-slate-400 hover:border-brand hover:text-brand"
                  }`}>
                  🤖 {detMode !== "off" ? "IA active" : "Activer l'IA"}
                </button>
                {detMode !== "off" && (
                  <button onClick={() => setDetMode(detMode === "browser" ? "server" : "browser")}
                    className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:border-slate-500">
                    {detMode === "browser" ? "🌐 TF.js" : "🐍 YOLOv11"}
                  </button>
                )}
                <button onClick={flip}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400">
                  🔄 Retourner
                </button>
                <label className="ml-auto flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                  <input type="checkbox" checked={autoSave} onChange={(e) => setAutoSave(e.target.checked)}
                    className="accent-brand" />
                  Sauvegarder dans Firebase
                </label>
              </div>

              {detError && (
                <div className="rounded-lg border border-amber-800/50 bg-amber-900/10 px-3 py-2 text-xs text-amber-400">
                  ⚠️ {detError}
                </div>
              )}
            </div>

            {/* Panel droit */}
            <div className="space-y-4">
              {/* Catégories en temps réel */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <h3 className="mb-3 text-xs font-semibold text-slate-400">DÉTECTÉ MAINTENANT</h3>
                {Object.keys(byCategory).length === 0 ? (
                  <p className="text-xs text-slate-600 text-center py-3">
                    {detMode === "off" ? "Activez l'IA pour voir les détections" : "Aucune détection"}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {Object.entries(byCategory).map(([cat, count]) => {
                      const catDef = CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? { label: cat, icon: "📦", color: "#64748B" };
                      return (
                        <div key={cat} className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                          style={{ background: catDef.color + "15" }}>
                          <span className="text-lg">{catDef.icon}</span>
                          <span className="flex-1 text-xs text-white">{catDef.label}</span>
                          <span className="rounded-full px-1.5 py-0.5 text-xs font-semibold"
                            style={{ background: catDef.color + "30", color: catDef.color }}>
                            ×{count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Historique des alertes */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-400">HISTORIQUE SESSION</h3>
                  {alerts.length > 0 && (
                    <button onClick={() => setAlerts([])} className="text-xs text-slate-600 hover:text-slate-400">Effacer</button>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {alerts.length === 0 ? (
                    <p className="text-xs text-slate-600 text-center py-2">Aucune alerte</p>
                  ) : alerts.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 rounded px-2 py-1">
                      <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: a.color }} />
                      <span className="flex-1 text-xs text-white truncate">{a.label}</span>
                      <span className="text-xs text-slate-600">{a.time}</span>
                      {a.saved && <span className="text-xs text-emerald-500">✓</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Enregistrer caméra */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <h3 className="mb-3 text-xs font-semibold text-slate-400">ENREGISTRER</h3>
                {!currentOrg ? (
                  <Link href="/login" className="block w-full rounded-lg border border-amber-700 py-2 text-center text-xs text-amber-400">
                    Connexion requise →
                  </Link>
                ) : (
                  <>
                    <input value={cameraName} onChange={(e) => setCameraName(e.target.value)}
                      placeholder="Nom de la caméra"
                      className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-brand focus:outline-none" />
                    <p className="mb-3 text-xs text-slate-500">
                      Org : <span className="text-slate-300">{currentOrg.name}</span>
                    </p>
                    <button onClick={saveCameraToDb}
                      className="w-full rounded-lg bg-brand py-2.5 text-sm font-medium">
                      ✅ Enregistrer dans Firebase
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Saving ── */}
      {step === "saving" && (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <p className="text-slate-400">Enregistrement dans Firebase...</p>
        </div>
      )}

      {/* ── Done ── */}
      {step === "done" && (
        <div className="mx-auto max-w-sm px-6 py-16 text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-500/10 text-4xl">✅</div>
          <h2 className="mb-2 text-xl font-semibold">{cameraName} enregistrée !</h2>
          <p className="mb-2 text-sm text-slate-400">Les détections sont sauvegardées dans Firestore.</p>
          <p className="mb-8 text-xs text-slate-600">
            Chat, personne, voiture... → snapshot → Firebase Storage → EventDoc → Notification push
          </p>
          <div className="flex justify-center gap-3">
            <Link href="/cameras" className="rounded-lg bg-brand px-6 py-2.5 text-sm font-medium">Mes caméras →</Link>
            <Link href="/events"  className="rounded-lg border border-slate-700 px-6 py-2.5 text-sm text-slate-300">🚨 Events</Link>
          </div>
        </div>
      )}
    </div>
  );
}

