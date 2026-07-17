"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useOrganization } from "@/lib/context/OrganizationContext";
import { DetectionOverlay } from "@/components/DetectionOverlay";
import { useYoloDetection, type DetectionMode } from "@/lib/hooks/useYoloDetection";
import { runDetectionPipeline } from "@/lib/services/pipelineService";
import Link from "next/link";
import type { CameraDoc } from "@visionguard/shared";

// Grilles disponibles
const GRIDS = [
  { id:"1x1",  label:"1",  cols:1, max:1  },
  { id:"1x2",  label:"2",  cols:2, max:2  },
  { id:"2x2",  label:"4",  cols:2, max:4  },
  { id:"3x3",  label:"9",  cols:3, max:9  },
  { id:"4x4",  label:"16", cols:4, max:16 },
];

// ── Composant flux d'une caméra ─────────────────────────────────────────────
function CameraCell({
  camera,
  orgId,
  isFullscreen,
  onFullscreen,
  aiEnabled,
}: {
  camera:       CameraDoc;
  orgId:        string;
  isFullscreen: boolean;
  onFullscreen: () => void;
  aiEnabled:    boolean;
}) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [error,     setError]    = useState<string | null>(null);
  const [saved,     setSaved]    = useState(0);

  const isPhone = camera.connector === "phone_webcam";

  // Démarrer le stream WebRTC pour les caméras phone
  async function startStream() {
    if (!isPhone) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode:"environment", width:{ideal:1280}, height:{ideal:720} },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStreaming(true);
    } catch (e: any) {
      setError("Accès caméra refusé");
    }
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setStreaming(false);
  }

  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);

  // IA
  const onDetection = useCallback(async (dets: any[]) => {
    if (!videoRef.current) return;
    for (const det of dets) {
      const result = await runDetectionPipeline({
        organizationId: orgId,
        cameraId:       camera.id,
        detection:      det,
        videoElement:   videoRef.current,
      }).catch(() => null);
      if (result) setSaved((n) => n + 1);
    }
  }, [orgId, camera.id]);

  const { detections, modelReady, fps } = useYoloDetection(videoRef, {
    mode:        aiEnabled && streaming ? "browser" : "off",
    fps:         6,
    confidence:  0.55,
    voteFrames:  2,
    onDetection,
  });

  return (
    <div className={`group relative flex flex-col overflow-hidden rounded-lg border bg-slate-950 ${
      camera.status === "online" ? "border-slate-700" : "border-slate-800"
    }`}>
      {/* Flux vidéo */}
      <div className="relative flex-1 bg-black min-h-0">
        {isPhone ? (
          <>
            <video ref={videoRef} autoPlay playsInline muted
              className="h-full w-full object-cover" />
            {streaming && <DetectionOverlay detections={detections} videoRef={videoRef} />}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-700 p-2 text-center">
            {camera.connector === "rtsp" || camera.connector === "onvif"
              ? `RTSP — serveur Python requis`
              : `${camera.connector.toUpperCase()} — connecteur Cloud`}
          </div>
        )}

        {/* Overlay offline */}
        {camera.status === "offline" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <span className="text-xs text-red-400">📵 Hors ligne</span>
          </div>
        )}

        {/* Phone non démarré */}
        {isPhone && !streaming && camera.status !== "offline" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
            {error
              ? <span className="text-xs text-red-400">{error}</span>
              : <span className="text-xs text-slate-400">Flux arrêté</span>
            }
            <button onClick={startStream}
              className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium">
              ▶ Démarrer
            </button>
          </div>
        )}

        {/* Badge LIVE */}
        {streaming && (
          <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
            <span className="text-xs text-white">LIVE</span>
          </div>
        )}

        {/* Badge IA */}
        {aiEnabled && streaming && modelReady && (
          <div className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-xs text-brand">
            🤖 {fps}fps{saved > 0 ? ` · ${saved} ✓` : ""}
          </div>
        )}

        {/* Contrôles hover */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {isPhone && streaming && (
            <button onClick={stopStream}
              className="rounded bg-black/60 px-1.5 py-0.5 text-xs text-slate-300 hover:text-white">
              ⏹
            </button>
          )}
          <button onClick={onFullscreen}
            className="rounded bg-black/60 px-1.5 py-0.5 text-xs text-slate-300 hover:text-white">
            ⛶
          </button>
          <Link href={`/cameras/${camera.id}`}
            className="rounded bg-black/60 px-1.5 py-0.5 text-xs text-slate-300 hover:text-white">
            ↗
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-slate-800 px-2 py-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            camera.status === "online" ? "bg-emerald-500" : "bg-slate-600"
          }`} />
          <span className="text-xs text-slate-300 truncate">{camera.name}</span>
        </div>
        <span className="text-xs text-slate-600 shrink-0 ml-1">
          {camera.connector === "phone_webcam" ? "📱" : "📹"}
        </span>
      </div>
    </div>
  );
}

// ── Page principale ─────────────────────────────────────────────────────────
export default function LiveMonitoringPage() {
  const { currentOrg } = useOrganization();
  const [cameras,  setCameras]  = useState<CameraDoc[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [gridId,   setGridId]   = useState("2x2");
  const [aiOn,     setAiOn]     = useState(false);
  const [fullCam,  setFullCam]  = useState<CameraDoc | null>(null);

  // Charger les caméras en temps réel
  useEffect(() => {
    if (!currentOrg?.id) { setLoading(false); return; }
    const unsub = onSnapshot(
      collection(db, "organizations", currentOrg.id, "cameras"),
      (snap) => {
        setCameras(snap.docs.map((d) => ({ id:d.id, ...d.data() } as CameraDoc)));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [currentOrg?.id]);

  const grid    = GRIDS.find((g) => g.id === gridId) ?? GRIDS[2];
  const visible = cameras.slice(0, grid.max);
  const online  = cameras.filter((c) => c.status === "online").length;

  // ── Vue plein écran ──────────────────────────────────────────────────────
  if (fullCam) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="flex items-center justify-between bg-black/80 px-6 py-3 shrink-0">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            <span className="text-sm font-medium text-white">{fullCam.name}</span>
            <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400">LIVE</span>
          </div>
          <button onClick={() => setFullCam(null)}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-white">
            ✕ Quitter
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <CameraCell
            camera={fullCam}
            orgId={currentOrg?.id ?? ""}
            isFullscreen={true}
            onFullscreen={() => setFullCam(null)}
            aiEnabled={aiOn}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col">
      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-white">Live Monitor</h1>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            <span className="text-xs text-red-400 font-medium">LIVE</span>
          </div>
          <span className="text-xs text-slate-500">
            {online}/{cameras.length} caméra{cameras.length !== 1 ? "s" : ""} en ligne
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Toggle IA */}
          <button onClick={() => setAiOn(!aiOn)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              aiOn ? "border-brand bg-brand/10 text-brand" : "border-slate-700 text-slate-400"
            }`}>
            🤖 IA {aiOn ? "ON" : "OFF"}
          </button>

          {/* Sélecteur grille */}
          <div className="flex items-center gap-0.5 rounded-lg border border-slate-800 bg-slate-900 p-1">
            {GRIDS.map((g) => (
              <button key={g.id} onClick={() => setGridId(g.id)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  gridId === g.id ? "bg-brand text-white" : "text-slate-400 hover:text-white"
                }`}>
                {g.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* États */}
      {loading && (
        <div className="flex flex-1 items-center justify-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <span className="text-sm text-slate-400">Chargement des caméras...</span>
        </div>
      )}

      {!loading && !currentOrg && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <span className="text-4xl">📺</span>
          <p className="text-slate-400">Aucune organisation configurée.</p>
          <Link href="/cameras/phone" className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium">
            → Configurer via Caméra Phone
          </Link>
        </div>
      )}

      {!loading && currentOrg && cameras.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-slate-700">
          <span className="text-4xl">📷</span>
          <p className="text-slate-400">Aucune caméra dans ton organisation.</p>
          <div className="flex gap-3">
            <Link href="/cameras/add" className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium">
              + Ajouter une caméra
            </Link>
            <Link href="/cameras/phone" className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm text-slate-300">
              📱 Caméra téléphone
            </Link>
          </div>
        </div>
      )}

      {/* Grille de caméras */}
      {!loading && cameras.length > 0 && (
        <div className="flex-1 min-h-0"
          style={{ display:"grid", gridTemplateColumns:`repeat(${grid.cols}, 1fr)`, gap:"6px" }}>
          {visible.map((cam) => (
            <CameraCell
              key={cam.id}
              camera={cam}
              orgId={currentOrg?.id ?? ""}
              isFullscreen={false}
              onFullscreen={() => setFullCam(cam)}
              aiEnabled={aiOn}
            />
          ))}
          {/* Cases vides */}
          {Array.from({ length: Math.max(0, grid.max - visible.length) }).map((_, i) => (
            <div key={`empty-${i}`}
              className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-950 gap-2">
              <span className="text-slate-700 text-xs">Slot vide</span>
              <Link href="/cameras/add" className="text-xs text-brand hover:underline">+ Ajouter</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
