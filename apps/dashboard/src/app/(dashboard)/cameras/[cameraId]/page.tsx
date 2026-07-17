"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, onSnapshot, collection, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useOrganization } from "@/lib/context/OrganizationContext";
import { DetectionOverlay } from "@/components/DetectionOverlay";
import { useYoloDetection, type DetectionMode } from "@/lib/hooks/useYoloDetection";
import { runDetectionPipeline } from "@/lib/services/pipelineService";
import { STATUS_LABELS, STATUS_COLORS, CONNECTOR_LABELS } from "@/lib/services/cameraService";
import type { CameraDoc } from "@visionguard/shared";

export default function CameraDetailPage() {
  const { cameraId } = useParams() as { cameraId: string };
  const { currentOrg } = useOrganization();

  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [camera,    setCamera]    = useState<CameraDoc | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [events,    setEvents]    = useState<any[]>([]);
  const [detMode,   setDetMode]   = useState<DetectionMode>("off");
  const [streaming, setStreaming] = useState(false);
  const [saved,     setSaved]     = useState(0);

  // Charger la caméra en temps réel
  useEffect(() => {
    if (!currentOrg?.id || !cameraId) return;
    const unsub = onSnapshot(
      doc(db, "organizations", currentOrg.id, "cameras", cameraId),
      (snap) => {
        if (snap.exists()) setCamera({ id:snap.id, ...snap.data() } as CameraDoc);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [currentOrg?.id, cameraId]);

  // Events récents de cette caméra
  useEffect(() => {
    if (!currentOrg?.id || !cameraId) return;
    const q = query(
      collection(db, "organizations", currentOrg.id, "events"),
      orderBy("createdAt", "desc"),
      limit(10),
    );
    const unsub = onSnapshot(q, (snap) => {
      setEvents(snap.docs
        .map((d) => ({ id:d.id, ...d.data() }))
        .filter((e: any) => e.cameraId === cameraId)
      );
    });
    return unsub;
  }, [currentOrg?.id, cameraId]);

  // Auto-start si c'est une caméra phone_webcam
  useEffect(() => {
    if (camera?.connector === "phone_webcam") startWebcam();
  }, [camera?.connector]);

  async function startWebcam() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width:{ideal:1280}, height:{ideal:720} }, audio:false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStreaming(true);
    } catch (e: any) {
      console.warn("Webcam:", e.message);
    }
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setStreaming(false);
    setDetMode("off");
  }

  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);

  const { detections, isLoading, modelReady, fps }
    = useYoloDetection(videoRef, {
        mode:        detMode,
        fps:         8,
        confidence:  0.55,
        voteFrames:  2,
        onDetection: async (dets) => {
          if (!currentOrg?.id || !videoRef.current) return;
          for (const det of dets) {
            const result = await runDetectionPipeline({
              organizationId: currentOrg.id,
              cameraId,
              detection:      det,
              videoElement:   videoRef.current,
            }).catch(() => null);
            if (result) setSaved((n) => n + 1);
          }
        },
      });

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
    </div>
  );

  if (!camera) return (
    <div className="text-center py-20">
      <p className="text-slate-400 mb-4">Caméra introuvable.</p>
      <Link href="/cameras" className="text-brand hover:underline">← Retour aux caméras</Link>
    </div>
  );

  const isPhone     = camera.connector === "phone_webcam";
  const statusStyle = STATUS_COLORS[camera.status];

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-5 flex items-center gap-2 text-sm text-slate-500">
        <Link href="/cameras" className="hover:text-slate-300">Caméras</Link>
        <span>/</span>
        <span className="text-slate-300">{camera.name}</span>
      </div>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">{camera.name}</h1>
          <p className="text-sm text-slate-400 mt-1">
            {camera.brand} {camera.model && `· ${camera.model}`} · {CONNECTOR_LABELS[camera.connector]}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusStyle}`}>
            {camera.status === "online" && <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />}
            {STATUS_LABELS[camera.status]}
          </span>
          {isPhone && !streaming && (
            <button onClick={startWebcam}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium">
              ▶ Démarrer
            </button>
          )}
          {isPhone && streaming && (
            <button onClick={stopStream}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300">
              ⏹ Arrêter
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Flux vidéo */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative aspect-video rounded-xl border border-slate-800 bg-black overflow-hidden">
            {isPhone ? (
              <>
                <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                <DetectionOverlay detections={detections} videoRef={videoRef} />
                {streaming && (
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                    <span className="text-xs text-white">LIVE</span>
                  </div>
                )}
                {detMode !== "off" && (
                  <div className="absolute bottom-3 right-3 rounded-lg bg-black/70 px-2 py-1 text-xs">
                    {isLoading ? <span className="text-brand">Chargement IA...</span>
                     : modelReady ? <span className="text-emerald-400">🤖 {fps}fps · {detections.length} obj · {saved} sauvegardés</span>
                     : <span className="text-slate-500">IA en attente</span>}
                  </div>
                )}
                {!streaming && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <span className="text-4xl">📱</span>
                    <button onClick={startWebcam} className="rounded-xl bg-brand px-6 py-2.5 text-sm font-medium">
                      ▶ Démarrer la caméra
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-600 text-sm">
                {camera.streamUrl
                  ? `Flux: ${camera.streamUrl.slice(0,50)}...`
                  : "Connecter le flux RTSP via le Camera Connector Engine"}
              </div>
            )}
          </div>

          {/* Contrôles IA */}
          {isPhone && streaming && (
            <div className="flex gap-2">
              <button onClick={() => setDetMode(detMode === "off" ? "browser" : "off")}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium ${
                  detMode !== "off" ? "border-brand bg-brand/10 text-brand" : "border-slate-700 text-slate-300"
                }`}>
                🤖 {detMode !== "off" ? "IA active" : "Activer l'IA"}
              </button>
              {detMode !== "off" && (
                <div className="flex items-center gap-2 text-xs text-slate-500 ml-2">
                  <span className="h-2 w-2 rounded-full bg-brand animate-pulse" />
                  Motion detection + vote 2 frames · seuil personne 65%
                </div>
              )}
            </div>
          )}

          {/* Events récents de cette caméra */}
          <div className="rounded-xl border border-slate-800 bg-slate-900">
            <div className="border-b border-slate-800 px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-300">Events récents</h3>
              <span className="text-xs text-slate-600">{events.length} events</span>
            </div>
            {events.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-slate-600">
                Aucun event — activez l'IA pour commencer la détection
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {events.map((ev: any) => (
                  <div key={ev.id} className="flex items-center gap-3 px-4 py-3">
                    <div className={`h-2 w-2 rounded-full shrink-0 ${
                      ev.severity === "critical" ? "bg-red-500" : ev.severity === "warning" ? "bg-amber-500" : "bg-slate-500"
                    }`} />
                    <span className="text-sm text-white flex-1">{ev.label ?? ev.primaryType}</span>
                    <span className="text-xs text-slate-500">
                      {new Date(ev.createdAt).toLocaleTimeString("fr-CA")}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      ev.acknowledged ? "border-slate-700 text-slate-600" : "border-amber-800 text-amber-400"
                    }`}>{ev.acknowledged ? "✓" : "ouvert"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Fiche technique */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Identité</h2>
            <div className="space-y-3">
              {[
                ["Nom",         camera.name],
                ["Marque",      camera.brand],
                ["Modèle",      camera.model ?? "—"],
                ["Connecteur",  CONNECTOR_LABELS[camera.connector]],
                ["Emplacement", camera.location ?? "—"],
                ["Timezone",    camera.timezone],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between text-xs">
                  <span className="text-slate-500">{l}</span>
                  <span className="text-slate-300 text-right max-w-32 truncate">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {(camera.batteryLevel !== undefined || camera.signalQuality !== undefined) && (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">État</h2>
              {camera.batteryLevel !== undefined && (
                <div className="mb-3">
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-slate-500">Batterie</span>
                    <span className={camera.batteryLevel < 20 ? "text-red-400" : "text-slate-300"}>{camera.batteryLevel}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800">
                    <div className={`h-1.5 rounded-full ${camera.batteryLevel < 20 ? "bg-red-500" : "bg-emerald-500"}`}
                      style={{width:`${camera.batteryLevel}%`}} />
                  </div>
                </div>
              )}
              {camera.signalQuality !== undefined && (
                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-slate-500">Signal</span>
                    <span className="text-slate-300">{camera.signalQuality}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800">
                    <div className="h-1.5 rounded-full bg-brand" style={{width:`${camera.signalQuality}%`}} />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Détection IA</h2>
            {camera.enabledDetectionTypes?.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {camera.enabledDetectionTypes.map((t) => (
                  <span key={t} className="rounded-full bg-brand/10 border border-brand/30 px-2 py-0.5 text-xs text-brand">{t}</span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-600">Aucun type configuré</p>
            )}
          </div>

          <a href={`https://console.firebase.google.com/project/ai-guard-vision-8ef41/firestore/data/organizations/${currentOrg?.id}/cameras/${cameraId}`}
            target="_blank"
            className="block w-full rounded-lg border border-slate-700 py-2 text-center text-xs text-slate-400 hover:text-brand hover:border-brand">
            Voir dans Firestore ↗
          </a>
        </div>
      </div>
    </div>
  );
}
