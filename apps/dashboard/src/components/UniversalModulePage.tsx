"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  collection, query, orderBy, limit, getDocs,
  onSnapshot, doc, setDoc, updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useYoloDetection, type Detection } from "@/lib/hooks/useYoloDetection";
import { useMediaRecorder } from "@/lib/hooks/useMediaRecorder";
import { runDetectionPipeline } from "@/lib/services/pipelineService";
import { checkSetup, quickSetup, createCameraDirectly } from "@/lib/services/setupService";
import { DetectionOverlay } from "@/components/DetectionOverlay";
import { ModuleLocationPicker } from "@/components/ModuleLocationPicker";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ModuleDetectionClass {
  id: string; cocoClass: string; label: string; icon: string;
  color: string; severity: "critical"|"warning"|"info";
  alertOn: boolean; category: string;
  sendToEvents: boolean; sendToNotif: boolean; description: string;
}
export interface ModulePageConfig {
  id: string; name: string; icon: string; color: string;
  sector: string; plan: string; status: string;
  tagline: string; description: string; browserNote: string;
  aiModels: string[];
  detections: ModuleDetectionClass[];
  locations: { cat: string; locs: string[] }[];
  analyticsKPIs: { id:string; label:string; icon:string; unit:string }[];
  reports: { id:string; label:string; icon:string; freq:string }[];
}

interface FirestoreEvent {
  id:string; label:string; severity:string; category?:string;
  createdAt:string; videoClipUrl?:string; thumbnailUrl?:string; acknowledged?:boolean;
}
interface FirestoreNotif {
  id:string; title:string; body:string; severity:string; createdAt:string; read:boolean;
}

type Tab = "camera"|"ai"|"events"|"notifications"|"analytics"|"reports";

const TABS: { id:Tab; label:string; icon:string }[] = [
  { id:"camera",        label:"Caméra",       icon:"📷" },
  { id:"ai",            label:"AI Détection", icon:"🤖" },
  { id:"events",        label:"Events",       icon:"🚨" },
  { id:"notifications", label:"Notifs",       icon:"🔔" },
  { id:"analytics",     label:"Analytics",    icon:"📊" },
  { id:"reports",       label:"Rapports",     icon:"📄" },
];

const SEV_COLOR = (s:string) =>
  s==="critical"?"#EF4444":s==="warning"?"#F59E0B":"#64748B";

const formatDate = (iso:string) => {
  try { return new Date(iso).toLocaleString("fr-CA",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}); }
  catch { return iso?.slice(0,16)??"-"; }
};

const SERVER = process.env.NEXT_PUBLIC_AI_SERVER_URL ?? "";
const PPE_MODULES = new Set(["construction","industrial","defense"]);

export function UniversalModulePage({ config }: { config: ModulePageConfig }) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream|null>(null);
  const orgRef    = useRef<string|null>(null);
  const camRef    = useRef<string|null>(null);
  const unsubsRef = useRef<(()=>void)[]>([]);
  const ppeIntervalRef = useRef<NodeJS.Timeout|null>(null);

  const [facing,    setFacing]    = useState<"user"|"environment">("environment");
  const [streaming, setStreaming] = useState(false);
  const [aiOn,      setAiOn]      = useState(false);
  const [log,       setLog]       = useState("▶ Démarrez la caméra pour commencer");
  const [orgId,     setOrgId]     = useState<string|null>(null);
  const [showPicker,setShowPicker]= useState(false);
  const [location,  setLocation]  = useState<string|null>(null);
  const [tab,       setTab]       = useState<Tab>("camera");
  const [liveDets,  setLiveDets]  = useState<{label:string;icon:string;severity:string;time:string;score:number}[]>([]);
  const [ppeDets,   setPpeDets]   = useState<any[]>([]);
  const [ppeWorkers,setPpeWorkers]= useState<any[]>([]);
  const [events,    setEvents]    = useState<FirestoreEvent[]>([]);
  const [notifs,    setNotifs]    = useState<FirestoreNotif[]>([]);
  const [railwayOk, setRailwayOk] = useState(false);

  useEffect(() => {
    let cancelled = false;
    checkSetup().then(s => {
      if (cancelled) return;
      if (s.organizationId) { orgRef.current = s.organizationId; setOrgId(s.organizationId); }
    });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
      unsubsRef.current.forEach(u => u());
      unsubsRef.current = [];
      if (ppeIntervalRef.current) clearInterval(ppeIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (!orgId) return;
    unsubsRef.current.forEach(u => u());
    unsubsRef.current = [];

    const evUnsub = onSnapshot(
      query(collection(db,"organizations",orgId,"events"), orderBy("createdAt","desc"), limit(50)),
      snap => setEvents(snap.docs.map(d=>({id:d.id,...d.data()}as FirestoreEvent))),
      () => getDocs(collection(db,"organizations",orgId,"events"))
          .then(snap => { const docs=snap.docs.map(d=>({id:d.id,...d.data()}as FirestoreEvent)); docs.sort((a,b)=>(b.createdAt??"").localeCompare(a.createdAt??"")); setEvents(docs.slice(0,50)); })
          .catch(()=>{})
    );

    const notifUnsub = onSnapshot(
      query(collection(db,"organizations",orgId,"notifications"), orderBy("createdAt","desc"), limit(30)),
      snap => setNotifs(snap.docs.map(d=>({id:d.id,...d.data()}as FirestoreNotif))),
      () => {}
    );

    unsubsRef.current = [evUnsub, notifUnsub];
    return () => { unsubsRef.current.forEach(u => u()); unsubsRef.current = []; };
  }, [orgId]);

  // ── PPE Detection via Railway ─────────────────────────────────────────────
  const captureFrame = useCallback((): string|null => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    const c = document.createElement("canvas");
    c.width  = Math.min(v.videoWidth, 640);
    c.height = Math.min(v.videoHeight, 480);
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.7).split(",")[1];
  }, []);

  const runPPE = useCallback(async () => {
    if (!SERVER || !aiOn || !streaming) return;
    const frame = captureFrame();
    if (!frame) return;
    try {
      const endpoint = PPE_MODULES.has(config.id) ? "/detect/ppe" : "/detect";
      const r = await fetch(`${SERVER}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: frame,
          module_id: config.id,
          sector: config.id,
          organization_id: orgRef.current ?? "",
          camera_id: camRef.current ?? "",
          confidence: 0.40,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) return;
      const data = await r.json();
      setRailwayOk(true);

      if (PPE_MODULES.has(config.id) && data.workers) {
        setPpeWorkers(data.workers ?? []);
        setPpeDets(data.detections ?? []);
        const time = new Date().toLocaleTimeString("fr-CA");
        // Alertes violations
        for (const w of data.workers ?? []) {
          for (const a of w.epi_absent ?? []) {
            setLiveDets(prev => [{label:a.label,icon:"🚨",severity:"critical",time,score:0.9},...prev].slice(0,60));
            setLog(`🚨 ${a.label} — Travailleur #${w.worker_id}`);
            // Pipeline Firebase
            const org = orgRef.current; const cam = camRef.current;
            if (org && cam && videoRef.current) {
              runDetectionPipeline({
                organizationId:org, cameraId:cam,
                detection:{ class:"ppe_violation", label:a.label, severity:"critical", category:"ppe", score:0.9, bbox:[0,0,0,0] },
                videoElement:videoRef.current,
              }).catch(()=>{});
            }
          }
          for (const p of w.epi_present ?? []) {
            const time2 = new Date().toLocaleTimeString("fr-CA");
            setLiveDets(prev => [{label:p.label,icon:"✅",severity:"info",time:time2,score:0.9},...prev].slice(0,60));
          }
        }
      } else {
        const dets = data.detections ?? [];
        const classMap2 = Object.fromEntries(config.detections.map((c:any) => [c.cocoClass, c]));
        const filtered = dets.filter((d:any) => classMap2[d.class]);
        if (filtered.length) {
          const time = new Date().toLocaleTimeString("fr-CA");
          const newDets = filtered.map((d:any) => {
            const mc = classMap2[d.class];
            return {label:mc?.label??d.label,icon:mc?.icon??"📦",severity:mc?.severity??"info",time,score:d.score};
          });
          setLiveDets(prev => [...newDets,...prev].slice(0,60));
        }
      }
    } catch { setRailwayOk(false); }
  }, [aiOn, streaming, config, captureFrame]);

  useEffect(() => {
    if (ppeIntervalRef.current) clearInterval(ppeIntervalRef.current);
    if (aiOn && streaming && SERVER) {
      runPPE();
      ppeIntervalRef.current = setInterval(runPPE, 2000);
    }
    return () => { if (ppeIntervalRef.current) clearInterval(ppeIntervalRef.current); };
  }, [aiOn, streaming, runPPE]);

  // ── Caméra ────────────────────────────────────────────────────────────────
  async function startCam(face:"user"|"environment" = facing) {
    try {
      streamRef.current?.getTracks().forEach(t => t.stop());
      const constraints = face === "environment"
        ? { video: { facingMode: { exact: "environment" }, width:{ideal:1280}, height:{ideal:720} }, audio: false }
        : { video: { facingMode: "user", width:{ideal:1280}, height:{ideal:720} }, audio: false };
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch {
        // Fallback si exact échoue
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: face }, audio: false });
      }
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(()=>{}); }
      setStreaming(true);
      let org = orgRef.current;
      if (!org) { const r = await quickSetup(config.name); org=r.organizationId; orgRef.current=org; setOrgId(org); }
      if (org && !camRef.current) {
        const name = location ? `${config.name} — ${location}` : `${config.name} Caméra`;
        const id = await createCameraDirectly({ organizationId:org, name, brand:"WebRTC", connector:"phone_webcam", timezone:Intl.DateTimeFormat().resolvedOptions().timeZone, location:location??config.name });
        camRef.current = id;
        setLog(`✅ ${name} — flux actif`);
      } else setLog(`✅ ${location??config.name} — flux actif`);
    } catch(e:any) {
      setLog(`❌ ${e.name==="NotAllowedError"?"Permission caméra refusée":e.message}`);
    }
  }

  async function toggleFacing() {
    const next = facing==="environment"?"user":"environment";
    setFacing(next);
    if (streaming) await startCam(next);
  }

  function stopCam() {
    streamRef.current?.getTracks().forEach(t=>t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStreaming(false); setAiOn(false);
    setLog("Caméra arrêtée");
  }

  // ── Enregistrement ─────────────────────────────────────────────────────────
  const { startClip, recording, uploading, lastLog: clipLog } = useMediaRecorder(videoRef);

  async function handleRecord() {
    if (!streaming) { setLog("❌ Démarrez la caméra d'abord"); return; }
    if (recording || uploading) return;
    const org = orgRef.current; const cam = camRef.current;
    if (!org || !cam) { setLog("❌ Caméra non initialisée"); return; }
    const now = new Date().toISOString();
    const evId = doc(collection(db,"_")).id;
    try {
      await setDoc(doc(db,"organizations",org,"events",evId), {
        id:evId, organizationId:org, cameraId:cam, siteId:"default",
        detectionIds:[], primaryType:"manual_recording", category:"manual",
        label:`Enregistrement ${config.name}`, severity:"info",
        durationSeconds:0, thumbnailUrl:null, videoClipUrl:null,
        clipStatus:"recording", acknowledged:false, createdAt:now, updatedAt:now,
      });
      setLog("🔴 Enregistrement 15s...");
      const result = await startClip({ organizationId:org, cameraId:cam, eventId:evId, durationSec:15 });
      if (result) setLog(`✅ Clip ${result.durationSeconds}s → Storage`);
      else setLog("⚠️ Enregistrement terminé");
    } catch(e:any) { setLog(`❌ ${e.message}`); }
  }

  // ── COCO-SSD fallback ──────────────────────────────────────────────────────
  const classMap = useRef(Object.fromEntries(config.detections.map(c=>[c.cocoClass,c]))).current;

  // Throttle — max 1 event par classe par 60 secondes
  const lastEvTime = useRef<Record<string,number>>({});
  function canSend(cls: string): boolean {
    const now = Date.now();
    if ((now-(lastEvTime.current[cls]??0)) < 60000) return false;
    lastEvTime.current[cls] = now; return true;
  }

  const handleDetection = useCallback(async (dets: Detection[]) => {
    if (railwayOk) return; // Railway actif = on utilise Railway
    const modDets = dets.filter(d=>classMap[d.class]);
    if (!modDets.length) return;
    const time = new Date().toLocaleTimeString("fr-CA");
    setLiveDets(prev=>[...modDets.map(d=>{const mc=classMap[d.class]; return {label:mc?.label??d.label,icon:mc?.icon??"📦",severity:mc?.severity??"info",time,score:d.score};}), ...prev].slice(0,60));
    const first = classMap[modDets[0].class];
    setLog(`${first?.icon??""} ${first?.label??modDets[0].label} — ${time}`);
    const org=orgRef.current; const cam=camRef.current;
    if (!org||!cam||!videoRef.current) return;
    for (const det of modDets.slice(0,2)) {
      const mc=classMap[det.class];
      if (!mc?.sendToEvents) continue;
      if (!canSend(det.class)) continue; // throttle 60s
      try {
        const result = await runDetectionPipeline({ organizationId:org, cameraId:cam, detection:{...det,label:mc.label,severity:mc.severity,category:mc.category}, videoElement:videoRef.current });
        if (result?.eventId&&result.eventId!=="error"&&!recording&&(mc.severity==="critical"||mc.severity==="warning")) {
          startClip({organizationId:org,cameraId:cam,eventId:result.eventId,durationSec:12});
        }
      } catch {}
    }
  }, [classMap, railwayOk, recording, startClip]);

  const { detections, isLoading, modelReady, fps } = useYoloDetection(videoRef, {
    mode: aiOn && streaming && !railwayOk ? "browser" : "off",
    fps:8, confidence:0.42, voteFrames:2, onDetection:handleDetection,
  });

  const visibleDets = detections.filter(d=>classMap[d.class]);

  // ── PPE Overlay canvas ────────────────────────────────────────────────────
  const ppeCanvasRef = useRef<HTMLCanvasElement>(null);

  // PPE Canvas — dessin continu requestAnimationFrame
  const animRef = useRef<number>(0);
  const lastWorkersRef = useRef<any[]>([]);
  const lastDetsRef    = useRef<any[]>([]);

  useEffect(() => { lastWorkersRef.current = ppeWorkers; }, [ppeWorkers]);
  useEffect(() => { lastDetsRef.current    = ppeDets; },    [ppeDets]);

  useEffect(() => {
    const canvas = ppeCanvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;

    function draw() {
      const ctx = canvas!.getContext("2d");
      if (!ctx || !video) { animRef.current = requestAnimationFrame(draw); return; }
      canvas!.width  = video.clientWidth  || canvas!.width;
      canvas!.height = video.clientHeight || canvas!.height;
      ctx.clearRect(0, 0, canvas!.width, canvas!.height);
      const sx = canvas!.width  / (video.videoWidth  || canvas!.width);
      const sy = canvas!.height / (video.videoHeight || canvas!.height);
      const workers = lastWorkersRef.current;
      const dets    = lastDetsRef.current;

      for (const w of workers) {
        if (!w.bbox?.length) continue;
        const [x1,y1,x2,y2] = w.bbox;
        const color = w.compliant ? "#10B981" : "#EF4444";
        ctx.strokeStyle = color; ctx.lineWidth = 3;
        ctx.strokeRect(x1*sx, y1*sy, (x2-x1)*sx, (y2-y1)*sy);
        ctx.fillStyle = color + "CC";
        ctx.fillRect(x1*sx, y1*sy - 24, (x2-x1)*sx, 24);
        ctx.fillStyle = "#FFF"; ctx.font = "bold 13px sans-serif";
        ctx.fillText(`👷 #${w.worker_id}  ${w.score}%  ${w.compliant?"✅":"❌"}`, x1*sx + 4, y1*sy - 6);
        for (const e of w.epi_present ?? []) {
          if (!e.bbox?.length) continue;
          const [a,b,c,d] = e.bbox;
          ctx.strokeStyle = "#10B981"; ctx.lineWidth = 2;
          ctx.strokeRect(a*sx, b*sy, (c-a)*sx, (d-b)*sy);
          ctx.fillStyle = "#10B981CC"; ctx.fillRect(a*sx, b*sy - 18, (c-a)*sx, 18);
          ctx.fillStyle = "#FFF"; ctx.font = "bold 11px sans-serif";
          ctx.fillText(`✅ ${e.label}`, a*sx + 3, b*sy - 4);
        }
        for (const ab of w.epi_absent ?? []) {
          if (!ab.bbox?.length) continue;
          const [a,b,c,d] = ab.bbox;
          ctx.strokeStyle = "#EF4444"; ctx.lineWidth = 3;
          ctx.setLineDash([6,3]); ctx.strokeRect(a*sx, b*sy, (c-a)*sx, (d-b)*sy); ctx.setLineDash([]);
          ctx.fillStyle = "#EF4444CC"; ctx.fillRect(a*sx, b*sy - 18, (c-a)*sx, 18);
          ctx.fillStyle = "#FFF"; ctx.font = "bold 11px sans-serif";
          ctx.fillText(`🚨 ${ab.label}`, a*sx + 3, b*sy - 4);
        }
      }
      if (!workers.length) {
        for (const det of dets) {
          if (!det.bbox?.length) continue;
          const [x1,y1,x2,y2] = det.bbox;
          const color = det.color || (det.alert ? "#EF4444" : "#10B981");
          ctx.strokeStyle = color; ctx.lineWidth = 2;
          ctx.strokeRect(x1*sx, y1*sy, (x2-x1)*sx, (y2-y1)*sy);
          ctx.fillStyle = color + "CC"; ctx.fillRect(x1*sx, y1*sy - 18, (x2-x1)*sx, 18);
          ctx.fillStyle = "#FFF"; ctx.font = "11px sans-serif";
          ctx.fillText(`${det.icon||""} ${det.label}`, x1*sx + 3, y1*sy - 4);
        }
      }
      animRef.current = requestAnimationFrame(draw);
    }
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [videoRef]);


  // ── Render ────────────────────────────────────────────────────────────────
  const unreadEvents = events.filter(e=>!e.acknowledged).length;
  const unreadNotifs = notifs.filter(n=>!n.read).length;
  const isPPE = PPE_MODULES.has(config.id);

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-white">
      {showPicker && (
        <ModuleLocationPicker moduleId={config.id} moduleName={config.name} moduleIcon={config.icon} moduleColor={config.color}
          onConfirm={loc=>{setLocation(loc.name);setShowPicker(false);camRef.current=null;startCam(facing);}}
          onSkip={()=>{setShowPicker(false);startCam(facing);}}/>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href="/modules" className="flex items-center justify-center h-8 w-8 rounded-lg border border-slate-800 text-slate-400 hover:text-white">←</Link>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xl" style={{background:`${config.color}20`,border:`1px solid ${config.color}40`}}>{config.icon}</div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-white">{config.name}</h1>
            <p className="text-xs text-slate-500 truncate">{location?`📍 ${location}`:config.tagline}</p>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            {railwayOk && <span className="text-xs text-emerald-400">🚀 Railway</span>}
            {recording && <span className="text-xs font-bold text-red-400">REC</span>}
          </div>
        </div>
        <div className="flex gap-0.5 px-3 pb-2 overflow-x-auto scrollbar-none">
          {TABS.map(t=>{
            const badge=t.id==="events"?unreadEvents:t.id==="notifications"?unreadNotifs:0;
            return (
              <button key={t.id} onClick={()=>setTab(t.id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition-all ${tab===t.id?"text-white":"text-slate-500 hover:text-slate-300"}`}
                style={tab===t.id?{background:`${config.color}20`,color:config.color}:{}}>
                {t.icon} {t.label}
                {badge>0&&<span className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white" style={{background:config.color}}>{badge}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4">

        {/* ═══ TAB CAMÉRA ═══ */}
        {tab==="camera" && <>
          {/* Flux vidéo — UNE SEULE FOIS */}
          <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-900 border border-slate-800">
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover"/>
            {/* Overlay COCO-SSD */}
            <DetectionOverlay detections={visibleDets} videoRef={videoRef}/>
            {/* Overlay PPE */}
            <canvas ref={ppeCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none"/>

            {streaming && (
              <>
                <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500"/>
                  <span className="text-xs text-white font-medium">LIVE · {location??config.name}</span>
                </div>
                <div className="absolute top-3 right-3 rounded-full bg-black/70 px-2.5 py-1 text-xs text-slate-300">
                  {facing==="user"?"🤳 Avant":"📷 Arrière"}
                </div>
                {aiOn && (
                  <div className="absolute bottom-3 right-3 rounded-lg bg-black/70 px-2.5 py-1.5 text-xs">
                    {railwayOk
                      ? <span className="text-emerald-400">🚀 {isPPE?"PPE":"YOLOv11"} · {PPE_MODULES.has(config.id)?ppeWorkers.length+" travailleur(s)":liveDets.length+" détection(s)"}</span>
                      : isLoading ? <span className="text-amber-400">⏳ Chargement IA...</span>
                      : modelReady ? <span className="text-blue-400">🌐 COCO · {visibleDets.length} obj · {fps}fps</span>
                      : <span className="text-slate-500">IA en attente</span>}
                  </div>
                )}
              </>
            )}

            {recording && (
              <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full border border-red-600 bg-red-900/80 px-3 py-1.5">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-400"/>
                <span className="text-xs font-bold text-red-300">🔴 ENREGISTREMENT</span>
              </div>
            )}

            {!streaming && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/90">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl text-5xl" style={{background:`${config.color}20`,border:`2px solid ${config.color}40`}}>{config.icon}</div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-white">{config.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{config.tagline}</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={()=>setShowPicker(true)} className="rounded-xl px-5 py-2.5 text-sm font-bold text-white" style={{background:config.color}}>📍 Emplacement</button>
                  <button onClick={()=>startCam()} className="rounded-xl border border-slate-600 bg-slate-800 px-5 py-2.5 text-sm font-bold text-white">▶ Démarrer</button>
                </div>
              </div>
            )}
          </div>

          {/* Boutons */}
          <div className="grid grid-cols-2 gap-2">
            {!streaming
              ? <button onClick={()=>startCam()} className="col-span-2 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white" style={{background:config.color}}>▶ Démarrer la caméra</button>
              : <button onClick={stopCam} className="flex items-center justify-center gap-2 rounded-xl border border-red-700 bg-red-900/20 py-3 text-sm font-bold text-red-400">⏹ Arrêter</button>
            }
            <button onClick={toggleFacing}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-bold text-white hover:border-slate-500 transition-colors">
              {facing==="environment"?"🤳 Vue avant":"📷 Vue arrière"}
            </button>
            <button onClick={handleRecord} disabled={!streaming||uploading}
              className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors disabled:opacity-40 ${recording?"border border-red-500 bg-red-900/20 text-red-400":"bg-red-600 text-white hover:bg-red-700"}`}>
              {recording?<><span className="h-2 w-2 animate-pulse rounded-full bg-red-400"/>⏹ Arrêter</>:uploading?"⏳ Upload...":"🔴 Enregistrer"}
            </button>
            <button onClick={()=>setAiOn(!aiOn)} disabled={!streaming}
              className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-colors disabled:opacity-40 ${aiOn?"text-white":"border border-slate-700 bg-slate-800 text-slate-300"}`}
              style={aiOn?{background:config.color}:{}}>
              🤖 IA {aiOn?"ON":"OFF"}
            </button>
            <button onClick={()=>setShowPicker(true)}
              className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900 py-2.5 text-xs text-slate-400 hover:text-white hover:border-slate-600 transition-colors">
              📍 {location?`Emplacement: ${location}`:"Choisir l'emplacement"}
            </button>
          </div>

          {/* Log */}
          <div className={`rounded-xl border px-4 py-3 text-xs font-mono ${log.startsWith("✅")?"border-emerald-800 bg-emerald-900/10 text-emerald-400":log.startsWith("❌")?"border-red-800 bg-red-900/10 text-red-400":"border-slate-800 bg-slate-900/50 text-slate-500"}`}>
            {clipLog || log}
          </div>

          {/* Badge Railway/PPE */}
          {isPPE && (
            <div className={`rounded-xl border p-3 text-xs ${railwayOk?"border-emerald-800/40 bg-emerald-900/10 text-emerald-400":"border-amber-800/40 bg-amber-900/10 text-amber-400"}`}>
              {railwayOk
                ? `✅ PPE Engine actif — helmet/no_helmet/vest/no_vest détectés avec boxes colorées`
                : `⚠️ Railway hors ligne — fallback COCO-SSD navigateur`}
            </div>
          )}
        </>}

        {/* ═══ TAB AI DÉTECTION ═══ */}
        {tab==="ai" && <>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">🤖 AI Détection — {liveDets.length} détections</h2>
            {liveDets.length>0&&<button onClick={()=>setLiveDets([])} className="text-xs text-slate-600 hover:text-slate-400">Effacer</button>}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              {l:"Détections",v:liveDets.length,c:"text-white"},
              {l:"Alertes",v:liveDets.filter(d=>d.severity!=="info").length,c:"text-amber-400"},
              {l:"Critiques",v:liveDets.filter(d=>d.severity==="critical").length,c:"text-red-400"},
            ].map(k=>(
              <div key={k.l} className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-center">
                <p className={`text-2xl font-bold ${k.c}`}>{k.v}</p>
                <p className="text-xs text-slate-500 mt-0.5">{k.l}</p>
              </div>
            ))}
          </div>

          {isPPE && ppeWorkers.length>0 && (
            <div className="space-y-2">
              {ppeWorkers.map((w:any)=>(
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
                    {(w.epi_present??[]).map((e:any,i:number)=>(
                      <span key={i} className="rounded-full bg-emerald-900/40 border border-emerald-800/40 px-2 py-0.5 text-xs text-emerald-400">✅ {e.label}</span>
                    ))}
                    {(w.epi_absent??[]).map((a:any,i:number)=>(
                      <span key={i} className="rounded-full bg-red-900/40 border border-red-800/40 px-2 py-0.5 text-xs text-red-400 font-bold">🚨 {a.label}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
            <div className="border-b border-slate-800 px-4 py-2.5">
              <h3 className="text-xs font-bold text-slate-400">LOG TEMPS RÉEL ({liveDets.length})</h3>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-800">
              {liveDets.length===0
                ? <p className="py-8 text-center text-xs text-slate-600">{streaming&&aiOn?"Aucune détection":"Activez la caméra + IA"}</p>
                : liveDets.map((d,i)=>(
                  <div key={i} className={`flex items-center gap-3 px-4 py-2.5 ${d.severity==="critical"?"bg-red-900/15":d.severity==="warning"?"bg-amber-900/10":""}`}>
                    <span className="text-xl shrink-0">{d.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{d.label}</p>
                      <div className="flex gap-2 mt-0.5">
                        <span className="text-xs font-medium" style={{color:SEV_COLOR(d.severity)}}>{d.severity==="critical"?"🔴 Critique":d.severity==="warning"?"🟡 Alerte":"ℹ️ Info"}</span>
                        <span className="text-xs text-slate-600">{Math.round(d.score*100)}% · {d.time}</span>
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>

          {!streaming&&<div className="rounded-xl border border-slate-800 bg-slate-900 py-10 text-center">
            <p className="text-3xl mb-2">🤖</p>
            <p className="text-sm text-slate-400 mb-3">Démarrez la caméra pour détecter</p>
            <button onClick={()=>{setTab("camera");startCam();}} className="rounded-xl px-5 py-2 text-sm font-bold text-white" style={{background:config.color}}>▶ Activer →</button>
          </div>}
        </>}

        {/* ═══ TAB EVENTS ═══ */}
        {tab==="events" && <>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">🚨 Events — {events.length} total</h2>
            <Link href="/events" className="text-xs text-brand hover:underline">Voir tout →</Link>
          </div>
          {events.length===0
            ? <div className="rounded-xl border border-slate-800 bg-slate-900 py-12 text-center">
                <p className="text-4xl mb-3">📭</p>
                <p className="text-sm text-slate-400">Aucun event — activez la caméra + IA</p>
              </div>
            : <div className="space-y-2">
                {events.map(ev=>(
                  <div key={ev.id} className={`rounded-xl border p-3.5 ${ev.severity==="critical"?"border-red-800/40 bg-red-900/10":ev.severity==="warning"?"border-amber-800/40 bg-amber-900/10":"border-slate-800 bg-slate-900"}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xl" style={{background:`${SEV_COLOR(ev.severity)}20`}}>
                        {ev.severity==="critical"?"🚨":ev.severity==="warning"?"⚠️":"ℹ️"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{ev.label}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-semibold" style={{color:SEV_COLOR(ev.severity)}}>{ev.severity==="critical"?"Critique":ev.severity==="warning"?"Alerte":"Info"}</span>
                          <span className="text-xs text-slate-600">{formatDate(ev.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {ev.videoClipUrl&&<span className="text-brand">🎬</span>}
                        {!ev.acknowledged&&orgId&&(
                          <button onClick={()=>updateDoc(doc(db,"organizations",orgId,"events",ev.id),{acknowledged:true}).catch(()=>{})}
                            className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-500 hover:border-emerald-700 hover:text-emerald-400">✓</button>
                        )}
                      </div>
                    </div>
                    {ev.videoClipUrl&&<video src={ev.videoClipUrl} controls className="mt-3 w-full rounded-lg max-h-48 bg-black"/>}
                  </div>
                ))}
              </div>
          }
        </>}

        {/* ═══ TAB NOTIFICATIONS ═══ */}
        {tab==="notifications" && <>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">🔔 Notifications — {unreadNotifs} non-lues</h2>
            {unreadNotifs>0&&orgId&&(
              <button onClick={()=>notifs.filter(n=>!n.read).forEach(n=>updateDoc(doc(db,"organizations",orgId,"notifications",n.id),{read:true}).catch(()=>{}))}
                className="text-xs text-brand">Tout lire</button>
            )}
          </div>
          {notifs.length===0
            ? <div className="rounded-xl border border-slate-800 bg-slate-900 py-12 text-center"><p className="text-4xl mb-3">🔕</p><p className="text-sm text-slate-400">Aucune notification</p></div>
            : <div className="space-y-2">
                {notifs.map(n=>(
                  <div key={n.id} className={`flex items-start gap-3 rounded-xl border p-3.5 transition-all ${!n.read?"border-slate-700 bg-slate-900":"border-slate-800 bg-slate-950 opacity-50"}`}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xl" style={{background:`${SEV_COLOR(n.severity)}20`}}>
                      {n.severity==="critical"?"🚨":n.severity==="warning"?"⚠️":"ℹ️"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white">{n.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{n.body}</p>
                      <p className="text-xs text-slate-600 mt-1">{formatDate(n.createdAt)}</p>
                    </div>
                    {!n.read&&orgId&&<button onClick={()=>updateDoc(doc(db,"organizations",orgId,"notifications",n.id),{read:true}).catch(()=>{})} className="shrink-0 h-2.5 w-2.5 rounded-full mt-1" style={{background:config.color}}/>}
                  </div>
                ))}
              </div>
          }
        </>}

        {/* ═══ TAB ANALYTICS ═══ */}
        {tab==="analytics" && <>
          <h2 className="text-sm font-bold text-white">📊 Analytics — {config.name}</h2>
          <div className="grid grid-cols-2 gap-3">
            {config.analyticsKPIs.map(kpi=>{
              const value=kpi.id==="total_events"?events.length:kpi.id==="critical_alerts"?events.filter(e=>e.severity==="critical").length:kpi.id==="clips"?events.filter(e=>e.videoClipUrl).length:kpi.id==="session_dets"?liveDets.length:"—";
              return (
                <div key={kpi.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <span className="text-3xl block mb-2">{kpi.icon}</span>
                  <p className="text-xs text-slate-500 mb-1">{kpi.label}</p>
                  <p className="text-2xl font-bold" style={{color:config.color}}>{value}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{kpi.unit}</p>
                </div>
              );
            })}
          </div>
        </>}

        {/* ═══ TAB RAPPORTS ═══ */}
        {tab==="reports" && <>
          <h2 className="text-sm font-bold text-white">📄 Rapports — {config.name}</h2>
          <div className="rounded-xl border border-amber-800/30 bg-amber-900/10 p-3 text-xs text-amber-400">
            📋 Génération PDF disponible après déploiement complet
          </div>
          <div className="space-y-2">
            {config.reports.map(r=>(
              <div key={r.id} className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-2xl">{r.icon}</div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">{r.label}</p>
                  <p className="text-xs text-slate-500">{r.freq==="daily"?"Quotidien":r.freq==="weekly"?"Hebdomadaire":r.freq==="monthly"?"Mensuel":"À la demande"}</p>
                </div>
                <button className="shrink-0 rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:border-brand hover:text-brand">Générer</button>
              </div>
            ))}
          </div>
        </>}

      </div>
    </div>
  );
}
