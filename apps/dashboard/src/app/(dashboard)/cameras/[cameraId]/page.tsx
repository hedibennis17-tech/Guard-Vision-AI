"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { doc, onSnapshot, collection, query, orderBy, limit, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useOrganization } from "@/lib/context/OrganizationContext";
import { DetectionOverlay } from "@/components/DetectionOverlay";
import { useYoloDetection } from "@/lib/hooks/useYoloDetection";
import { useMediaRecorder } from "@/lib/hooks/useMediaRecorder";
import { runDetectionPipeline } from "@/lib/services/pipelineService";
import { checkSetup } from "@/lib/services/setupService";
import type { CameraDoc } from "@visionguard/shared";

const SERVER = process.env.NEXT_PUBLIC_AI_SERVER_URL ?? "";

export default function CameraDetailPage() {
  const { cameraId } = useParams() as { cameraId: string };
  const { currentOrg } = useOrganization();

  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream|null>(null);
  const orgIdRef  = useRef<string|null>(null);
  const ppeInterval = useRef<NodeJS.Timeout|null>(null);

  const [camera,    setCamera]    = useState<CameraDoc|null>(null);
  const [loading,   setLoading]   = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [facing,    setFacing]    = useState<"user"|"environment">("environment");
  const [aiOn,      setAiOn]      = useState(false);
  const [events,    setEvents]    = useState<any[]>([]);
  const [log,       setLog]       = useState("▶ Démarrer la caméra");
  const [ppeDets,   setPpeDets]   = useState<any[]>([]);
  const [ppeWorkers,setPpeWorkers]= useState<any[]>([]);
  const [orgId,     setOrgId]     = useState<string|null>(null);

  // Récupérer orgId stable
  useEffect(() => {
    checkSetup().then(s => {
      if (s.organizationId) { orgIdRef.current = s.organizationId; setOrgId(s.organizationId); }
    });
  }, []);

  // Charger caméra
  useEffect(() => {
    if (!currentOrg?.id || !cameraId) return;
    return onSnapshot(
      doc(db,"organizations",currentOrg.id,"cameras",cameraId),
      snap => { if (snap.exists()) setCamera({id:snap.id,...snap.data()} as CameraDoc); setLoading(false); },
      () => setLoading(false)
    );
  }, [currentOrg?.id, cameraId]);

  // Events de cette caméra
  useEffect(() => {
    if (!currentOrg?.id) return;
    return onSnapshot(
      query(collection(db,"organizations",currentOrg.id,"events"), orderBy("createdAt","desc"), limit(20)),
      snap => setEvents(snap.docs.map(d=>({id:d.id,...d.data()})).filter((e:any)=>e.cameraId===cameraId)),
      () => {}
    );
  }, [currentOrg?.id, cameraId]);

  // Cleanup
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(t=>t.stop());
    if (ppeInterval.current) clearInterval(ppeInterval.current);
  }, []);

  async function startCam(face: "user"|"environment" = facing) {
    streamRef.current?.getTracks().forEach(t=>t.stop());
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: face==="environment"
            ? { facingMode:{exact:"environment"}, width:{ideal:1280}, height:{ideal:720} }
            : { facingMode:"user", width:{ideal:1280}, height:{ideal:720} },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: face }, audio: false });
      }
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(()=>{}); }
      setStreaming(true); setFacing(face);
      setLog(`✅ ${camera?.name ?? "Caméra"} — flux actif`);
    } catch(e:any) {
      setLog(`❌ ${e.name==="NotAllowedError"?"Permission refusée":e.message}`);
    }
  }

  function stopCam() {
    streamRef.current?.getTracks().forEach(t=>t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setStreaming(false); setAiOn(false); setLog("Caméra arrêtée");
    if (ppeInterval.current) clearInterval(ppeInterval.current);
  }

  function toggleFacing() {
    const next = facing==="environment"?"user":"environment";
    setFacing(next);
    if (streaming) startCam(next);
  }

  // PPE Detection via Railway
  const captureFrame = useCallback((): string|null => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    const c = document.createElement("canvas");
    c.width = Math.min(v.videoWidth, 640); c.height = Math.min(v.videoHeight, 480);
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.7).split(",")[1];
  }, []);

  const isPPE = camera ? (
    ["construction","industrial","defense"].some(s =>
      cameraId.toLowerCase().includes(s) ||
      (camera.name??'').toLowerCase().includes(s) ||
      (camera.location??'').toLowerCase().includes(s)
    )
  ) : false;

  useEffect(() => {
    if (ppeInterval.current) clearInterval(ppeInterval.current);
    if (!aiOn || !streaming || !SERVER) return;
    const run = async () => {
      const frame = captureFrame(); if (!frame) return;
      const endpoint = isPPE ? "/detect/ppe" : "/detect";
      try {
        const r = await fetch(`${SERVER}${endpoint}`, {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ image:frame, module_id:"construction", sector:"construction", organization_id:orgIdRef.current??"", camera_id:cameraId, confidence:0.40 }),
          signal: AbortSignal.timeout(7000),
        });
        if (!r.ok) return;
        const data = await r.json();
        if (data.workers) { setPpeWorkers(data.workers??[]); setPpeDets(data.detections??[]); }
      } catch {}
    };
    run();
    ppeInterval.current = setInterval(run, 2000);
    return () => { if (ppeInterval.current) clearInterval(ppeInterval.current); };
  }, [aiOn, streaming, isPPE, captureFrame, cameraId]);

  // PPE Canvas overlay
  const ppeCanvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ppeCanvasRef.current; const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    canvas.width = video.clientWidth; canvas.height = video.clientHeight;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if (!ppeWorkers.length && !ppeDets.length) return;
    const sx = canvas.width/(video.videoWidth||canvas.width);
    const sy = canvas.height/(video.videoHeight||canvas.height);
    for (const w of ppeWorkers) {
      if (!w.bbox) continue;
      const [x1,y1,x2,y2]=w.bbox; const color=w.compliant?"#10B981":"#EF4444";
      ctx.strokeStyle=color; ctx.lineWidth=3; ctx.strokeRect(x1*sx,y1*sy,(x2-x1)*sx,(y2-y1)*sy);
      ctx.fillStyle=color; ctx.fillRect(x1*sx,y1*sy-22,(x2-x1)*sx,22);
      ctx.fillStyle="#FFF"; ctx.font="bold 12px sans-serif";
      ctx.fillText(`#${w.worker_id} ${w.score}%`,x1*sx+4,y1*sy-6);
      for (const e of w.epi_present??[]) {
        if (!e.bbox) continue; const [a,b,c,d]=e.bbox;
        ctx.strokeStyle="#10B981"; ctx.lineWidth=2; ctx.strokeRect(a*sx,b*sy,(c-a)*sx,(d-b)*sy);
        ctx.fillStyle="#10B981"; ctx.fillRect(a*sx,b*sy-16,(c-a)*sx,16);
        ctx.fillStyle="#FFF"; ctx.font="10px sans-serif"; ctx.fillText(`✅ ${e.label}`,a*sx+2,b*sy-4);
      }
      for (const ab of w.epi_absent??[]) {
        if (!ab.bbox) continue; const [a,b,c,d]=ab.bbox;
        ctx.strokeStyle="#EF4444"; ctx.lineWidth=3; ctx.setLineDash([5,3]);
        ctx.strokeRect(a*sx,b*sy,(c-a)*sx,(d-b)*sy); ctx.setLineDash([]);
        ctx.fillStyle="#EF4444"; ctx.fillRect(a*sx,b*sy-16,(c-a)*sx,16);
        ctx.fillStyle="#FFF"; ctx.font="bold 10px sans-serif"; ctx.fillText(`🚨 ${ab.label}`,a*sx+2,b*sy-4);
      }
    }
    for (const det of ppeDets) {
      if (ppeWorkers.length || !det.bbox) continue;
      const [x1,y1,x2,y2]=det.bbox; const color=det.color||(det.alert?"#EF4444":"#10B981");
      ctx.strokeStyle=color; ctx.lineWidth=2; ctx.strokeRect(x1*sx,y1*sy,(x2-x1)*sx,(y2-y1)*sy);
    }
  }, [ppeDets, ppeWorkers]);

  // Throttle — max 1 event par classe par 60 secondes
  const lastEventTime = useRef<Record<string,number>>({});
  function canSendEvent(cls: string): boolean {
    const now = Date.now();
    if ((now - (lastEventTime.current[cls] ?? 0)) < 60000) return false;
    lastEventTime.current[cls] = now;
    return true;
  }

  // COCO-SSD — désactivé si PPE actif
  const { startClip, recording, uploading, lastLog: clipLog } = useMediaRecorder(videoRef);
  const { detections, isLoading, modelReady, fps } = useYoloDetection(videoRef, {
    mode: aiOn && streaming && !isPPE ? "browser" : "off",
    fps:3, confidence:0.60, voteFrames:3,
    onDetection: async dets => {
      if (!currentOrg?.id || !videoRef.current) return;
      for (const det of dets.slice(0,1)) {
        if (!canSendEvent(det.class)) continue; // throttle
        const result = await runDetectionPipeline({ organizationId:currentOrg.id, cameraId, detection:det, videoElement:videoRef.current }).catch(()=>null);
        if (result?.eventId && !recording)
          startClip({ organizationId:currentOrg.id, cameraId, eventId:result.eventId, durationSec:12 });
      }
    },
  });

  async function handleRecord() {
    if (!streaming) { setLog("❌ Démarrez la caméra d'abord"); return; }
    if (!currentOrg?.id) { setLog("❌ Organisation non chargée"); return; }
    const evId = doc(collection(db,"_")).id;
    const now = new Date().toISOString();
    await setDoc(doc(db,"organizations",currentOrg.id,"events",evId),{
      id:evId,organizationId:currentOrg.id,cameraId,siteId:"default",
      primaryType:"manual_recording",label:"Enregistrement manuel",
      category:"manual",severity:"info",durationSeconds:0,
      thumbnailUrl:null,videoClipUrl:null,clipStatus:"recording",
      acknowledged:false,createdAt:now,updatedAt:now,
    });
    setLog("🔴 Enregistrement 15s...");
    const result = await startClip({ organizationId:currentOrg.id, cameraId, eventId:evId, durationSec:15 });
    if (result) setLog(`✅ Clip ${result.durationSeconds}s sauvegardé`);
  }

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent"/></div>;
  if (!camera) return <div className="text-center py-20"><p className="text-slate-400 mb-4">Caméra introuvable</p><Link href="/cameras" className="text-brand">← Retour</Link></div>;

  return (
    <div className="space-y-5 pb-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/cameras" className="hover:text-slate-300">← Caméras</Link>
        <span>/</span>
        <span className="text-slate-300 truncate">{camera.name}</span>
      </div>

      {/* ── Flux vidéo — UNE SEULE FOIS ── */}
      <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-900 border border-slate-800">
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover"/>
        <DetectionOverlay detections={detections} videoRef={videoRef}/>
        <canvas ref={ppeCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none"/>

        {streaming && (
          <>
            <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500"/>
              <span className="text-xs text-white font-medium">LIVE · {camera.name}</span>
            </div>
            <div className="absolute top-3 right-3 text-xs text-white bg-black/70 rounded-full px-2.5 py-1">
              {facing==="user"?"🤳 Avant":"📷 Arrière"}
            </div>
            {aiOn && (
              <div className="absolute bottom-3 right-3 rounded-lg bg-black/70 px-2.5 py-1.5 text-xs">
                {isPPE
                  ? <span className="text-emerald-400">🚀 PPE · {ppeWorkers.length} travailleur(s)</span>
                  : isLoading ? <span className="text-amber-400">⏳ Chargement IA...</span>
                  : modelReady ? <span className="text-emerald-400">🎯 {detections.length} obj · {fps}fps</span>
                  : <span className="text-slate-500">IA en attente</span>}
              </div>
            )}
          </>
        )}

        {recording && (
          <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full border border-red-600 bg-red-900/80 px-3 py-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-400"/>
            <span className="text-xs font-bold text-red-300">🔴 REC</span>
          </div>
        )}

        {!streaming && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/90">
            <span className="text-5xl">📷</span>
            <p className="text-white font-semibold">{camera.name}</p>
            <button onClick={()=>startCam()} className="rounded-xl bg-brand px-6 py-2.5 text-sm font-bold text-white">▶ Démarrer</button>
          </div>
        )}
      </div>

      {/* ── Boutons de contrôle ── */}
      <div className="grid grid-cols-2 gap-2">
        {!streaming
          ? <button onClick={()=>startCam()} className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-bold text-white">▶ Démarrer la caméra</button>
          : <button onClick={stopCam} className="flex items-center justify-center gap-2 rounded-xl border border-red-700 bg-red-900/20 py-3 text-sm font-bold text-red-400">⏹ Arrêter</button>
        }
        <button onClick={toggleFacing}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-bold text-white hover:border-slate-500 transition-colors">
          {facing==="environment"?"🤳 Vue avant":"📷 Vue arrière"}
        </button>
        <button onClick={handleRecord} disabled={!streaming||uploading}
          className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors disabled:opacity-40 ${recording?"border border-red-500 bg-red-900/20 text-red-400":"bg-red-600 text-white hover:bg-red-700"}`}>
          {recording?<><span className="h-2 w-2 animate-pulse rounded-full bg-red-400"/>⏹ Stop</>:uploading?"⏳ Upload...":"🔴 Enregistrer"}
        </button>
        <button onClick={()=>setAiOn(!aiOn)} disabled={!streaming}
          className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-colors disabled:opacity-40 ${aiOn?"bg-brand text-white":"border border-slate-700 bg-slate-800 text-slate-300"}`}>
          🤖 IA {aiOn?"ON":"OFF"}
        </button>
      </div>

      {/* Log */}
      <div className={`rounded-xl border px-4 py-3 text-xs font-mono ${log.startsWith("✅")?"border-emerald-800 bg-emerald-900/10 text-emerald-400":log.startsWith("❌")?"border-red-800 bg-red-900/10 text-red-400":"border-slate-800 bg-slate-900 text-slate-500"}`}>
        {clipLog || log}
      </div>

      {/* PPE Workers */}
      {isPPE && ppeWorkers.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-400">👷 TRAVAILLEURS DÉTECTÉS</h3>
          {ppeWorkers.map((w:any) => (
            <div key={w.worker_id} className={`rounded-xl border p-3.5 ${w.compliant?"border-emerald-800/40 bg-emerald-900/10":"border-red-800/40 bg-red-900/10"}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-white">👷 Travailleur #{w.worker_id}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${w.compliant?"bg-emerald-900 text-emerald-400":"bg-red-900 text-red-400"}`}>
                  {w.compliant?"✅ Conforme":"❌ Non conforme"} · {w.score}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 mb-2 overflow-hidden">
                <div className="h-full rounded-full" style={{width:`${w.score}%`,background:w.color}}/>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(w.epi_present??[]).map((e:any,i:number)=><span key={i} className="rounded-full bg-emerald-900/40 border border-emerald-800/40 px-2 py-0.5 text-xs text-emerald-400">✅ {e.label}</span>)}
                {(w.epi_absent??[]).map((a:any,i:number)=><span key={i} className="rounded-full bg-red-900/40 border border-red-800/40 px-2 py-0.5 text-xs text-red-400 font-bold">🚨 {a.label}</span>)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Events */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="border-b border-slate-800 px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-300">🚨 Events ({events.length})</h3>
          <Link href="/events" className="text-xs text-brand">Voir tout →</Link>
        </div>
        {events.length===0
          ? <div className="px-4 py-8 text-center text-xs text-slate-600">Activez l'IA pour commencer la détection</div>
          : <div className="divide-y divide-slate-800">
              {events.map((ev:any)=>(
                <div key={ev.id} className={`flex items-center gap-3 px-4 py-3 ${ev.severity==="critical"?"bg-red-900/10":ev.severity==="warning"?"bg-amber-900/10":""}`}>
                  <span className={`h-2 w-2 rounded-full shrink-0 ${ev.severity==="critical"?"bg-red-500":ev.severity==="warning"?"bg-amber-500":"bg-slate-500"}`}/>
                  <span className="text-sm text-white flex-1 truncate">{ev.label??ev.primaryType}</span>
                  {ev.videoClipUrl && <span className="text-brand shrink-0">🎬</span>}
                  <span className="text-xs text-slate-500 shrink-0">{new Date(ev.createdAt).toLocaleTimeString("fr-CA")}</span>
                  {!ev.acknowledged && currentOrg?.id && (
                    <button onClick={()=>updateDoc(doc(db,"organizations",currentOrg.id,"events",ev.id),{acknowledged:true}).catch(()=>{})}
                      className="shrink-0 rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-500 hover:text-emerald-400">✓</button>
                  )}
                </div>
              ))}
            </div>
        }
      </div>

      {/* Infos caméra */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-2">
        <h3 className="text-xs font-bold text-slate-400 mb-3">ℹ️ INFOS CAMÉRA</h3>
        {[["Nom",camera.name],["Connecteur",camera.connector],["Emplacement",camera.location??"—"],["Timezone",camera.timezone]].map(([l,v])=>(
          <div key={l} className="flex justify-between text-xs">
            <span className="text-slate-500">{l}</span>
            <span className="text-slate-300 truncate max-w-48">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
