"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DetectionOverlay } from "@/components/DetectionOverlay";
import { useYoloDetection, type Detection, type DetectionMode } from "@/lib/hooks/useYoloDetection";
import { runDetectionPipeline } from "@/lib/services/pipelineService";
import { checkSetup, quickSetup, createCameraDirectly, type SetupStatus } from "@/lib/services/setupService";
import { CATEGORY_LABELS } from "@/lib/detection/classMap";
import { auth } from "@/lib/firebase/client";

interface Alert {
  id: string; class: string; label: string; score: number;
  color: string; severity: string; time: string;
  saved: boolean; snapshotUrl?: string;
}

export default function PhoneCameraPage() {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [screen,      setScreen]      = useState<"check"|"setup"|"live"|"done">("check");
  const [status,      setStatus]      = useState<SetupStatus | null>(null);
  const [orgName,     setOrgName]     = useState("Ma maison");
  const [cameraName,  setCameraName]  = useState("Mon téléphone");
  const [cameraId,    setCameraId]    = useState<string | null>(null);
  const [facing,      setFacing]      = useState<"user"|"environment">("environment");
  const [detMode,     setDetMode]     = useState<DetectionMode>("off");
  const [alerts,      setAlerts]      = useState<Alert[]>([]);
  const [pipeStatus,  setPipeStatus]  = useState<"idle"|"saving"|"ok"|"err">("idle");
  const [setupBusy,   setSetupBusy]   = useState(false);
  const [streamError, setStreamError] = useState<string|null>(null);
  const [autoSave,    setAutoSave]    = useState(true);

  // Vérifier le setup au montage
  useEffect(() => {
    checkSetup().then((s) => {
      setStatus(s);
      if (!s.authenticated) setScreen("check");
      else if (!s.hasOrganization) setScreen("setup");
      else setScreen("live");
    });
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  // ── Pipeline de détection ───────────────────────────────────────────
  const handleDetection = useCallback(async (dets: Detection[]) => {
    const now = new Date().toLocaleTimeString("fr-CA");
    const orgId = status?.organizationId;

    setAlerts((prev) => [
      ...dets.map((d) => ({ id:`${Date.now()}-${d.class}`, ...d, label:d.label, time:now, saved:false })),
      ...prev,
    ].slice(0, 30));

    if (!autoSave || !orgId || !cameraId || !videoRef.current) return;

    setPipeStatus("saving");
    let saved = 0;
    for (const det of dets) {
      try {
        const result = await runDetectionPipeline({
          organizationId: orgId,
          cameraId,
          detection:      det,
          videoElement:   videoRef.current,
        });
        if (result) {
          saved++;
          setAlerts((prev) => prev.map((a) =>
            a.class === det.class && !a.saved ? { ...a, saved:true, snapshotUrl: result.snapshotUrl ?? undefined } : a
          ));
        }
      } catch (err) { console.warn("[pipeline]", err); }
    }
    setPipeStatus(saved > 0 ? "ok" : "idle");
    if (saved > 0) setTimeout(() => setPipeStatus("idle"), 3000);
  }, [status?.organizationId, cameraId, autoSave]);

  const { detections, isLoading, modelReady, fps, error: detError }
    = useYoloDetection(videoRef, { mode:detMode, fps:8, confidence:0.40, onDetection:handleDetection });

  // ── Setup ──────────────────────────────────────────────────────────
  async function doQuickSetup() {
    setSetupBusy(true);
    try {
      const result = await quickSetup(orgName);
      const newStatus = await checkSetup();
      setStatus(newStatus);
      setScreen("live");
    } catch (err: any) {
      alert("Erreur setup : " + err.message);
    } finally { setSetupBusy(false); }
  }

  // ── Caméra ─────────────────────────────────────────────────────────
  async function startCamera(face: "user"|"environment" = facing) {
    setStreamError(null);
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode:face, width:{ideal:1280}, height:{ideal:720} }, audio:false,
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
    } catch (e: any) {
      setStreamError(e.name === "NotAllowedError" ? "Accès refusé à la caméra." : "Caméra introuvable.");
    }
  }

  async function saveCam() {
    if (!status?.organizationId) return;
    try {
      const id = await createCameraDirectly({
        organizationId: status.organizationId,
        name:    cameraName,
        brand:   "WebRTC",
        connector: "phone_webcam",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setCameraId(id);
      setScreen("done");
    } catch (err: any) { alert(err.message); }
  }

  useEffect(() => { if (screen === "live") startCamera(); }, [screen]);

  const byCategory = detections.reduce<Record<string,number>>((acc,d) => {
    acc[d.category] = (acc[d.category] ?? 0) + 1; return acc;
  }, {});

  // ── Écran de vérification ──────────────────────────────────────────
  if (screen === "check") return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800 mx-auto text-3xl">🔍</div>
        <h1 className="text-xl font-semibold text-white mb-2">Vérification du setup</h1>
        <p className="text-sm text-slate-400 mb-8">Pour sauvegarder les détections, vous devez être connecté à Firebase.</p>
        <Link href="/login" className="block w-full rounded-xl bg-brand py-3 text-sm font-medium text-center">
          Se connecter →
        </Link>
        <button onClick={() => setScreen("live")} className="mt-3 w-full rounded-xl border border-slate-700 py-3 text-sm text-slate-400">
          Continuer sans sauvegarder
        </button>
      </div>
    </div>
  );

  // ── Écran de setup organisation ────────────────────────────────────
  if (screen === "setup") return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 mx-auto text-3xl">⚙️</div>
        <h1 className="text-xl font-semibold text-white mb-2 text-center">Configuration initiale</h1>
        <p className="text-sm text-slate-400 mb-6 text-center">
          Première utilisation — créons votre organisation Vision Guard.
        </p>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 mb-4">
          <h2 className="text-xs font-semibold text-slate-400 mb-3">VOTRE ORGANISATION</h2>
          <input value={orgName} onChange={(e) => setOrgName(e.target.value)}
            placeholder="Ex: Ma maison, Bureau, Chalet..."
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-brand focus:outline-none mb-2" />
          <p className="text-xs text-slate-600">Vous pourrez ajouter d'autres organisations plus tard.</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 mb-4 text-xs text-slate-500">
          <p className="font-medium text-slate-400 mb-2">Ce setup va créer dans Firebase :</p>
          {["Organisation Firestore", "Plan Free (1 caméra)", "Rôle Owner", "Site par défaut", "Module Home activé"].map((item) => (
            <div key={item} className="flex items-center gap-2 py-0.5">
              <span className="text-brand">✓</span> {item}
            </div>
          ))}
        </div>

        <button onClick={doQuickSetup} disabled={setupBusy || !orgName.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-medium disabled:opacity-50">
          {setupBusy
            ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Configuration...</>
            : "🚀 Créer mon espace Vision Guard"}
        </button>

        <button onClick={() => setScreen("live")} className="mt-2 w-full py-2 text-xs text-slate-600">
          Ignorer (sans sauvegarde)
        </button>
      </div>
    </div>
  );

  // ── Écran Live principal ───────────────────────────────────────────
  if (screen === "live") return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <Link href="/cameras" className="text-slate-400 hover:text-white">←</Link>
        <div className="flex items-center gap-2 text-sm font-medium">
          Vision Guard · Webcam
          {detMode !== "off" && modelReady && (
            <span className="rounded-full bg-brand/20 border border-brand/30 px-2 py-0.5 text-xs text-brand">
              🤖 {fps}fps
            </span>
          )}
        </div>
        {/* Status Firebase */}
        <div className="flex items-center gap-1.5 text-xs">
          <div className={`h-2 w-2 rounded-full ${status?.hasOrganization ? "bg-emerald-500" : "bg-red-500"}`} />
          <span className="text-slate-400">{status?.organizationName ?? "Non configuré"}</span>
        </div>
      </div>

      {/* Bannière si pas de setup */}
      {!status?.hasOrganization && (
        <div className="border-b border-amber-800/40 bg-amber-900/10 px-6 py-3 flex items-center justify-between">
          <p className="text-xs text-amber-400">⚠️ Aucune organisation — les détections ne seront PAS sauvegardées</p>
          <button onClick={() => setScreen("setup")} className="text-xs text-brand underline">Configurer →</button>
        </div>
      )}

      {/* Bannière si caméra pas enregistrée */}
      {status?.hasOrganization && !cameraId && (
        <div className="border-b border-blue-800/40 bg-blue-900/10 px-6 py-2 flex items-center justify-between">
          <p className="text-xs text-brand">📝 Enregistrez la caméra pour activer la sauvegarde</p>
          <button onClick={() => document.getElementById("save-cam-input")?.focus()} className="text-xs text-brand underline">↓</button>
        </div>
      )}

      <div className="mx-auto max-w-5xl px-4 py-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

          {/* Flux + Overlay */}
          <div className="lg:col-span-2 space-y-3">
            <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
              <DetectionOverlay detections={detections} videoRef={videoRef} />

              {/* LIVE badge */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                <span className="text-xs font-medium">LIVE</span>
              </div>

              {/* IA status */}
              <div className="absolute bottom-3 right-3 rounded-lg bg-black/70 px-2 py-1 text-xs">
                {detMode === "off"   ? <span className="text-slate-500">IA désactivée</span>
                 : isLoading         ? <span className="text-brand flex gap-1.5"><span className="h-3 w-3 animate-spin rounded-full border border-brand border-t-transparent" /> Chargement...</span>
                 : modelReady        ? <span className="text-emerald-400">🤖 TF.js · {fps}fps · {detections.length} obj</span>
                 :                    <span className="text-slate-500">En attente...</span>}
              </div>

              {/* Pipeline status */}
              {pipeStatus === "saving" && (
                <div className="absolute top-3 right-3 rounded-lg bg-brand/80 px-2 py-1 text-xs flex gap-1">
                  <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" /> Sauvegarde...
                </div>
              )}
              {pipeStatus === "ok" && (
                <div className="absolute top-3 right-3 rounded-lg bg-emerald-600/80 px-2 py-1 text-xs">✅ Enregistré</div>
              )}

              {streamError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                  <div className="text-center">
                    <p className="text-red-400 text-sm mb-3">{streamError}</p>
                    <button onClick={() => startCamera()} className="rounded-lg bg-brand px-4 py-2 text-xs">Réessayer</button>
                  </div>
                </div>
              )}
            </div>

            {/* Contrôles */}
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setDetMode(detMode === "off" ? "browser" : "off")}
                className={`flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${detMode !== "off" ? "border-brand bg-brand/10 text-brand" : "border-slate-700 text-slate-400 hover:border-brand hover:text-brand"}`}>
                🤖 {detMode !== "off" ? "IA active" : "Activer l'IA"}
              </button>
              <button onClick={() => { const n = facing === "environment" ? "user" : "environment" as typeof facing; setFacing(n); startCamera(n); }}
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400">🔄 Retourner</button>
              <label className="ml-auto flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                <input type="checkbox" checked={autoSave} onChange={(e) => setAutoSave(e.target.checked)} className="accent-brand" />
                Sauvegarder auto
              </label>
            </div>

            {detError && <p className="text-xs text-amber-400">⚠️ {detError}</p>}
          </div>

          {/* Panel droit */}
          <div className="space-y-4">
            {/* Status pipeline */}
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <h3 className="mb-3 text-xs font-semibold text-slate-400">PIPELINE FIREBASE</h3>
              <div className="space-y-2">
                {[
                  { label:"Authentification",   ok: !!auth.currentUser  },
                  { label:"Organisation",        ok: !!status?.hasOrganization },
                  { label:"Caméra enregistrée", ok: !!cameraId          },
                  { label:"Sauvegarde auto",     ok: autoSave && !!cameraId },
                ].map(({ label, ok }) => (
                  <div key={label} className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">{label}</span>
                    <span className={ok ? "text-emerald-400" : "text-red-400"}>{ok ? "✅" : "❌"}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Détecté maintenant */}
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <h3 className="mb-3 text-xs font-semibold text-slate-400">DÉTECTÉ MAINTENANT</h3>
              {Object.keys(byCategory).length === 0 ? (
                <p className="text-xs text-slate-600 text-center py-3">
                  {detMode === "off" ? "Activez l'IA ↑" : "Aucune détection"}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {Object.entries(byCategory).map(([cat, count]) => {
                    const catDef = CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? { label:cat, icon:"📦", color:"#64748B" };
                    return (
                      <div key={cat} className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: catDef.color + "18" }}>
                        <span className="text-lg">{catDef.icon}</span>
                        <span className="flex-1 text-xs text-white">{catDef.label}</span>
                        <span className="rounded-full px-1.5 py-0.5 text-xs font-bold" style={{ background: catDef.color + "30", color: catDef.color }}>×{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Historique alertes */}
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-400">ALERTES ({alerts.filter(a=>a.saved).length} sauvegardées)</h3>
                {alerts.length > 0 && <button onClick={() => setAlerts([])} className="text-xs text-slate-600 hover:text-slate-400">Effacer</button>}
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {alerts.length === 0
                  ? <p className="text-xs text-slate-600 text-center py-2">Aucune alerte</p>
                  : alerts.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 rounded px-2 py-1.5"
                      style={{ background: a.color + "10" }}>
                      <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: a.color }} />
                      <span className="flex-1 text-xs text-white truncate">{a.label}</span>
                      <span className="text-xs text-slate-600 shrink-0">{a.time}</span>
                      <span className="shrink-0 text-xs">{a.saved ? "✅" : "⏳"}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Enregistrer la caméra */}
            {status?.hasOrganization && !cameraId && (
              <div className="rounded-xl border border-brand/30 bg-brand/5 p-4">
                <h3 className="mb-3 text-xs font-semibold text-brand">ENREGISTRER DANS FIREBASE</h3>
                <input id="save-cam-input" value={cameraName} onChange={(e) => setCameraName(e.target.value)}
                  placeholder="Nom de la caméra"
                  className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-brand focus:outline-none" />
                <button onClick={saveCam} className="w-full rounded-lg bg-brand py-2.5 text-sm font-medium">
                  ✅ Enregistrer la caméra
                </button>
              </div>
            )}

            {cameraId && (
              <div className="rounded-xl border border-emerald-800/40 bg-emerald-900/10 p-4 text-center">
                <p className="text-xs text-emerald-400">✅ Caméra active dans Firebase</p>
                <p className="text-xs text-slate-600 mt-1">ID: {cameraId.slice(0,12)}...</p>
                <div className="mt-2 flex justify-center gap-2">
                  <Link href="/events" className="text-xs text-brand hover:underline">🚨 Events</Link>
                  <span className="text-slate-700">·</span>
                  <Link href="/notifications" className="text-xs text-brand hover:underline">🔔 Notifications</Link>
                  <span className="text-slate-700">·</span>
                  <Link href={`/cameras`} className="text-xs text-brand hover:underline">📷 Caméras</Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // ── Done ──────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-500/10 text-4xl">✅</div>
        <h2 className="mb-2 text-xl font-semibold text-white">{cameraName} dans Firebase !</h2>
        <p className="mb-2 text-sm text-slate-400">Pipeline actif : détection → snapshot → Firestore → events → notifications</p>
        <div className="flex justify-center gap-3 mt-6">
          <Link href="/events" className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium">🚨 Voir les events</Link>
          <button onClick={() => setScreen("live")} className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm text-slate-300">← Retour live</button>
        </div>
      </div>
    </div>
  );
}
