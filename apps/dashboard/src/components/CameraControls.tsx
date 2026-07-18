"use client";

import { useRef, useState, useCallback } from "react";
import { doc, setDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useMediaRecorder } from "@/lib/hooks/useMediaRecorder";
import { DetectionOverlay } from "@/components/DetectionOverlay";
import { useYoloDetection, type Detection } from "@/lib/hooks/useYoloDetection";
import { runDetectionPipeline } from "@/lib/services/pipelineService";

interface CameraControlsProps {
  organizationId: string;
  cameraId:       string;
  cameraName?:    string;
  onDetection?:   (dets: Detection[]) => void;
  showAI?:        boolean;
  compact?:       boolean;       // mode compact pour modules
}

export function CameraControls({
  organizationId, cameraId, cameraName = "Caméra",
  onDetection, showAI = true, compact = false,
}: CameraControlsProps) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facing,    setFacing]    = useState<"user"|"environment">("environment");
  const [streaming, setStreaming] = useState(false);
  const [aiOn,      setAiOn]      = useState(false);
  const [log,       setLog]       = useState("Prêt");
  const [manualEventId, setManualEventId] = useState<string|null>(null);

  const { startClip, stopClip, recording, uploading, lastLog } = useMediaRecorder(videoRef);

  // ── Démarrer le flux caméra ──────────────────────────────────────────────
  async function startStream(face: "user"|"environment" = facing) {
    try {
      streamRef.current?.getTracks().forEach(t=>t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video:{ facingMode:face, width:{ideal:1280}, height:{ideal:720} }, audio:false,
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setStreaming(true);
      setLog(`✅ ${cameraName} — flux actif`);
    } catch(e:any) {
      const msg = e.name==="NotAllowedError" ? "Permission refusée" : e.message;
      setLog(`❌ ${msg}`);
    }
  }

  // ── Arrêter ──────────────────────────────────────────────────────────────
  function stopStream() {
    streamRef.current?.getTracks().forEach(t=>t.stop());
    setStreaming(false); setAiOn(false);
    if (videoRef.current) videoRef.current.srcObject = null;
    setLog("Caméra arrêtée");
  }

  // ── Toggle avant / arrière ───────────────────────────────────────────────
  async function toggleFacing() {
    const next = facing==="environment" ? "user" : "environment";
    setFacing(next);
    if (streaming) await startStream(next);
  }

  // ── Enregistrement manuel ────────────────────────────────────────────────
  async function handleRecord() {
    if (recording) { stopClip(); return; }
    if (!videoRef.current?.srcObject) { setLog("❌ Démarrez la caméra d'abord"); return; }

    // Créer un event "manuel" pour stocker le clip
    try {
      const now = new Date().toISOString();
      const evId = doc(collection(db,"_")).id;
      await setDoc(doc(db,"organizations",organizationId,"events",evId),{
        id:evId, organizationId, cameraId, siteId:"default",
        detectionIds:[], primaryType:"manual_recording",
        category:"human", label:"Enregistrement manuel",
        severity:"info", durationSeconds:0,
        thumbnailUrl:null, videoClipUrl:null,
        clipStatus:"recording", acknowledged:false,
        createdAt:now, updatedAt:now,
      });
      setManualEventId(evId);
      setLog("🔴 Enregistrement démarré...");

      const result = await startClip({
        organizationId, cameraId, eventId:evId, durationSec:15,
      });
      if (result) {
        setLog(`✅ Clip ${result.durationSeconds}s (${result.sizeKb}KB) → Storage`);
      } else {
        setLog("⚠️ Enregistrement terminé sans clip");
      }
    } catch(e:any) {
      setLog(`❌ Erreur enregistrement: ${e.message}`);
    }
  }

  // ── Pipeline détection ───────────────────────────────────────────────────
  const handleDetection = useCallback(async(dets: Detection[])=>{
    if (onDetection) onDetection(dets);
    // Auto-clip sur détection critique
    if (!recording && videoRef.current?.srcObject) {
      const critical = dets.find(d=>d.severity==="critical"||d.severity==="warning");
      if (critical) {
        for (const det of dets) {
          const result = await runDetectionPipeline({
            organizationId, cameraId,
            detection:det, videoElement:videoRef.current,
          }).catch(()=>null);
          if (result?.eventId && result.eventId!=="error" && !recording) {
            startClip({organizationId,cameraId,eventId:result.eventId,durationSec:12});
          }
        }
      }
    }
  },[organizationId, cameraId, recording, startClip, onDetection]);

  const { detections, isLoading, modelReady, fps } = useYoloDetection(videoRef,{
    mode:      showAI && aiOn ? "browser" : "off",
    fps:       8, confidence:0.50, voteFrames:2,
    onDetection:handleDetection,
  });

  const logText = lastLog || log;

  return (
    <div className="space-y-3">
      {/* Flux vidéo */}
      <div className={`relative overflow-hidden rounded-xl bg-black border border-slate-800 ${compact?"aspect-video":"aspect-video"}`}>
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover"/>
        <DetectionOverlay detections={detections} videoRef={videoRef}/>

        {/* Badge LIVE */}
        {streaming && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500"/>
            <span className="text-xs text-white font-medium">{cameraName}</span>
          </div>
        )}

        {/* Badge caméra direction */}
        {streaming && (
          <div className="absolute top-3 right-3 rounded-full bg-black/70 px-2.5 py-1 text-xs text-slate-300">
            {facing==="user"?"🤳 Avant":"📷 Arrière"}
          </div>
        )}

        {/* Badge REC */}
        {recording && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-red-900/80 border border-red-700 px-3 py-1">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500"/>
            <span className="text-xs text-red-300 font-bold">REC</span>
          </div>
        )}

        {/* IA status */}
        {streaming && showAI && (
          <div className="absolute bottom-3 right-3 rounded-lg bg-black/70 px-2.5 py-1 text-xs">
            {isLoading ? <span className="text-amber-400">⏳ IA chargement...</span>
             : aiOn && modelReady ? <span className="text-emerald-400">🎯 {detections.length} détection(s) · {fps}fps</span>
             : <span className="text-slate-500">IA désactivée</span>}
          </div>
        )}

        {/* Écran inactif */}
        {!streaming && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950">
            <span className="text-5xl">📷</span>
            <button onClick={()=>startStream()}
              className="rounded-xl bg-brand px-6 py-2.5 text-sm font-bold text-white hover:bg-brand/90">
              ▶ Démarrer la caméra
            </button>
          </div>
        )}
      </div>

      {/* Barre de contrôles */}
      <div className="flex flex-wrap gap-2">

        {/* ── Démarrer / Arrêter ── */}
        {!streaming ? (
          <button onClick={()=>startStream()}
            className="rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white hover:bg-brand/90">
            ▶ Démarrer
          </button>
        ) : (
          <button onClick={stopStream}
            className="rounded-xl border border-red-700 bg-red-900/10 px-4 py-2.5 text-sm font-bold text-red-400 hover:bg-red-900/20">
            ⏹ Arrêter
          </button>
        )}

        {/* ── 🔄 Toggle avant / arrière ── TOUJOURS VISIBLE ── */}
        <button onClick={toggleFacing}
          className="flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:border-brand hover:bg-brand/10 transition-colors">
          {facing==="environment" ? "🤳 Vue avant" : "📷 Vue arrière"}
        </button>

        {/* ── 🔴 Enregistrer ── TOUJOURS VISIBLE ── */}
        <button
          onClick={handleRecord}
          disabled={!streaming || uploading}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors disabled:opacity-40 ${
            recording
              ? "border border-red-600 bg-red-900/20 text-red-400 hover:bg-red-900/30"
              : "border border-red-700 bg-red-600 text-white hover:bg-red-700"
          }`}>
          {recording
            ? <><span className="h-2 w-2 animate-pulse rounded-full bg-red-400"/>⏹ Arrêter le clip</>
            : uploading
            ? <><span className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white"/>Upload...</>
            : <>🔴 Enregistrer</>
          }
        </button>

        {/* ── IA ON/OFF ── */}
        {showAI && streaming && (
          <button onClick={()=>setAiOn(!aiOn)}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
              aiOn ? "border-brand bg-brand/10 text-brand" : "border-slate-700 text-slate-300 hover:border-slate-500"
            }`}>
            🤖 IA {aiOn?"ON":"OFF"}
          </button>
        )}
      </div>

      {/* Log status */}
      <div className={`rounded-xl border px-3 py-2.5 text-xs font-mono ${
        logText.startsWith("✅") ? "border-emerald-800 bg-emerald-900/10 text-emerald-400"
        : logText.startsWith("❌") ? "border-red-800 bg-red-900/10 text-red-400"
        : logText.startsWith("🔴") ? "border-red-700 bg-red-900/20 text-red-300"
        : logText.startsWith("⚠️") ? "border-amber-800 bg-amber-900/10 text-amber-400"
        : "border-slate-800 bg-slate-900 text-slate-400"
      }`}>
        {logText || "Prêt"}
      </div>
    </div>
  );
}
