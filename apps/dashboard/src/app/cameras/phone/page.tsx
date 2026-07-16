"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DetectionOverlay } from "@/components/DetectionOverlay";
import { useYoloDetection, type Detection, type DetectionMode } from "@/lib/hooks/useYoloDetection";
import { useMediaRecorder } from "@/lib/hooks/useMediaRecorder";
import { runDetectionPipeline, updateEventWithClip } from "@/lib/services/pipelineService";
import { quickSetup, createCameraDirectly, checkSetup } from "@/lib/services/setupService";
import { CATEGORY_LABELS } from "@/lib/detection/classMap";
import { auth } from "@/lib/firebase/client";

interface SavedItem {
  label: string; time: string; color: string;
  eventId: string | null; snapshotUrl?: string;
}

export default function PhoneCameraPage() {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const orgIdRef  = useRef<string | null>(null);
  const camIdRef  = useRef<string | null>(null);

  const [facing,      setFacing]      = useState<"user"|"environment">("environment");
  const [ready,       setReady]       = useState(false);
  const [detMode,     setDetMode]     = useState<DetectionMode>("off");
  const [streamError, setStreamError] = useState<string | null>(null);
  const [saved,       setSaved]       = useState<SavedItem[]>([]);
  const [pipeLog,     setPipeLog]     = useState("En attente...");
  const [totalSaved,  setTotalSaved]  = useState(0);

  const { startClip, stopClip, isRecording } = useMediaRecorder();

  // Auto-init
  useEffect(() => {
    (async () => {
      try {
        const status = await checkSetup();
        let orgId = status.organizationId;
        if (!orgId) {
          setPipeLog("Création de l'organisation...");
          const r = await quickSetup("Ma maison");
          orgId = r.organizationId;
        }
        orgIdRef.current = orgId;
        setPipeLog("Création de la caméra...");
        const camId = await createCameraDirectly({
          organizationId: orgId,
          name:    "Caméra téléphone",
          brand:   "WebRTC",
          connector: "phone_webcam",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        camIdRef.current = camId;
        setPipeLog(`✅ Prêt — org: ${orgId.slice(0,8)}... cam: ${camId.slice(0,8)}...`);
        setReady(true);
      } catch (err: any) {
        setPipeLog(`❌ ${err.message}`);
      }
    })();
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  // Pipeline de détection
  const handleDetection = useCallback(async (dets: Detection[]) => {
    const orgId = orgIdRef.current;
    const camId = camIdRef.current;
    if (!orgId || !camId || !videoRef.current) return;

    const now = new Date().toLocaleTimeString("fr-CA");

    for (const det of dets) {
      try {
        const result = await runDetectionPipeline({
          organizationId: orgId,
          cameraId:       camId,
          detection:      det,
          videoElement:   videoRef.current,
        });

        if (result) {
          setSaved((prev) => [{
            label:       det.label,
            time:        now,
            color:       det.color,
            eventId:     result.eventId,
            snapshotUrl: result.snapshotUrl ?? undefined,
          }, ...prev].slice(0, 30));
          setTotalSaved((n) => n + 1);
          setPipeLog(`✅ ${det.label} → Firestore · snapshot${result.snapshotUrl ? " ✓" : " (Storage requis)"}`);

          // Lancer un clip vidéo de 6s si c'est une détection importante
          if (result.eventId && streamRef.current &&
              (det.severity === "critical" || det.severity === "warning") &&
              !isRecording) {
            const clip = await startClip(streamRef.current, orgId, camId, result.eventId, 6);
            if (clip?.url && result.eventId) {
              await updateEventWithClip(orgId, result.eventId, clip.url);
              setPipeLog(`✅ Clip vidéo ${clip.durationS}s (${clip.sizeKb}kb) → Firebase`);
            }
          }
        }
      } catch (err: any) {
        setPipeLog(`⚠️ ${err.message}`);
      }
    }
  }, [isRecording, startClip]);

  const { detections, isLoading, modelReady, fps }
    = useYoloDetection(videoRef, {
        mode:        detMode,
        fps:         8,
        confidence:  0.55,
        voteFrames:  2,
        onDetection: handleDetection,
      });

  async function startCamera(face: "user"|"environment" = facing) {
    setStreamError(null);
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode:face, width:{ideal:1280}, height:{ideal:720} },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (e: any) {
      setStreamError("Accès caméra refusé — vérifiez les permissions.");
    }
  }

  const byCategory = detections.reduce<Record<string,number>>((acc,d) => {
    acc[d.category] = (acc[d.category] ?? 0) + 1; return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <Link href="/cameras" className="text-slate-400 hover:text-white">← Caméras</Link>
        <div className="flex items-center gap-2 text-sm font-medium">
          Vision Guard · Webcam
          {isRecording && <span className="rounded-full bg-red-500/20 border border-red-700 px-2 py-0.5 text-xs text-red-400 flex items-center gap-1"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />REC</span>}
          {detMode !== "off" && modelReady && <span className="rounded-full bg-brand/20 border border-brand/30 px-2 py-0.5 text-xs text-brand">🤖 {fps}fps</span>}
        </div>
        <span className={`text-xs ${ready ? "text-emerald-400" : "text-amber-400"}`}>
          {ready ? "✅ Firebase" : "⏳ Init..."}
        </span>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Flux vidéo */}
          <div className="lg:col-span-2 space-y-3">
            <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
              <DetectionOverlay detections={detections} videoRef={videoRef} />

              <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                <span className="text-xs font-medium">LIVE</span>
              </div>

              {detMode !== "off" && (
                <div className="absolute bottom-3 right-3 rounded-lg bg-black/70 px-2 py-1 text-xs">
                  {isLoading ? <span className="text-brand flex gap-1"><span className="h-3 w-3 animate-spin rounded-full border border-brand border-t-transparent" /> Chargement IA...</span>
                   : modelReady ? <span className="text-emerald-400">🤖 {fps}fps · {detections.length} obj</span>
                   : <span className="text-slate-500">En attente...</span>}
                </div>
              )}

              {streamError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                  <div className="text-center">
                    <p className="text-red-400 text-sm mb-3">{streamError}</p>
                    <button onClick={() => startCamera()} className="rounded-lg bg-brand px-4 py-2 text-sm">Réessayer</button>
                  </div>
                </div>
              )}
            </div>

            {/* Contrôles */}
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => { setFacing("environment"); startCamera("environment"); }}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${facing==="environment" ? "border-brand bg-brand/10 text-brand" : "border-slate-700 text-slate-300 hover:border-slate-500"}`}>
                📷 Caméra arrière
              </button>
              <button onClick={() => { setFacing("user"); startCamera("user"); }}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${facing==="user" ? "border-brand bg-brand/10 text-brand" : "border-slate-700 text-slate-300 hover:border-slate-500"}`}>
                🤳 Caméra avant
              </button>
              <button onClick={() => setDetMode(detMode==="off" ? "browser" : "off")} disabled={!ready}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40 ${detMode!=="off" ? "border-brand bg-brand/10 text-brand" : "border-slate-700 text-slate-300 hover:border-brand hover:text-brand"}`}>
                🤖 {detMode !== "off" ? "IA active" : "Activer l'IA"}
              </button>
            </div>

            {/* Log pipeline */}
            <div className={`rounded-lg border px-3 py-2 text-xs font-mono ${
              pipeLog.startsWith("✅") ? "border-emerald-800 bg-emerald-900/10 text-emerald-400"
              : pipeLog.startsWith("❌") ? "border-red-800 bg-red-900/10 text-red-400"
              : pipeLog.startsWith("⚠️") ? "border-amber-800 bg-amber-900/10 text-amber-400"
              : "border-slate-800 bg-slate-900 text-slate-400"}`}>
              {pipeLog}
            </div>
          </div>

          {/* Panel droit */}
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-center">
                <p className="text-2xl font-bold text-white">{totalSaved}</p>
                <p className="text-xs text-slate-500">Détections</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-center">
                <p className="text-2xl font-bold text-brand">{detections.length}</p>
                <p className="text-xs text-slate-500">En live</p>
              </div>
            </div>

            {/* Segmentations live */}
            {Object.keys(byCategory).length > 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <h3 className="mb-3 text-xs font-semibold text-slate-400">SEGMENTATIONS</h3>
                <div className="space-y-1.5">
                  {Object.entries(byCategory).map(([cat, count]) => {
                    const c = CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? { label:cat, icon:"📦", color:"#64748B" };
                    return (
                      <div key={cat} className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ background:c.color+"18" }}>
                        <span>{c.icon}</span>
                        <span className="flex-1 text-xs text-white">{c.label}</span>
                        <span className="text-xs font-bold" style={{ color:c.color }}>×{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Historique */}
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <h3 className="mb-3 text-xs font-semibold text-slate-400">
                SAUVEGARDÉS ({totalSaved})
              </h3>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {saved.length === 0 ? (
                  <p className="text-xs text-slate-600 text-center py-3">
                    {detMode === "off" ? "Active l'IA pour commencer" : "En attente..."}
                  </p>
                ) : saved.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 rounded px-2 py-1.5">
                    {s.snapshotUrl
                      ? <img src={s.snapshotUrl} alt="" className="h-6 w-8 shrink-0 rounded object-cover" />
                      : <div className="h-2 w-2 shrink-0 rounded-full" style={{ background:s.color }} />}
                    <span className="flex-1 text-xs text-white truncate">{s.label}</span>
                    <span className="text-xs text-slate-600 shrink-0">{s.time}</span>
                    <span className="text-xs text-emerald-500 shrink-0">✅</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Liens */}
            {totalSaved > 0 && (
              <div className="space-y-1.5">
                {[
                  { href:"/events",       label:"🚨 Voir les Events" },
                  { href:"/ai-detection", label:"🤖 AI Détections" },
                  { href:"/notifications",label:"🔔 Notifications" },
                ].map((l) => (
                  <Link key={l.href} href={l.href}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300 hover:border-brand hover:text-brand">
                    {l.label} <span>→</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
