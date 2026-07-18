"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DetectionOverlay } from "@/components/DetectionOverlay";
import { useYoloDetection, type Detection } from "@/lib/hooks/useYoloDetection";
import { useMediaRecorder } from "@/lib/hooks/useMediaRecorder";
import { runDetectionPipeline } from "@/lib/services/pipelineService";
import { quickSetup, createCameraDirectly, checkSetup } from "@/lib/services/setupService";
import { CameraLocationPicker } from "@/components/CameraLocationPicker";
import { useActiveModules } from "@/lib/orchestrator/useActiveModules";
import { auth } from "@/lib/firebase/client";

interface SavedItem { label:string; time:string; color:string; }

export default function PhoneCameraPage() {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const orgIdRef  = useRef<string | null>(null);
  const camIdRef  = useRef<string | null>(null);

  const [facing,       setFacing]       = useState<"user"|"environment">("environment");
  const [ready,        setReady]        = useState(false);
  const [streaming,    setStreaming]     = useState(false);
  const [detMode,      setDetMode]      = useState<"off"|"browser">("off");
  const [streamError,  setStreamError]  = useState<string|null>(null);
  const [saved,        setSaved]        = useState<SavedItem[]>([]);
  const [pipeLog,      setPipeLog]      = useState("Appuyez sur Démarrer pour activer la caméra");
  const [pipeLogs,     setPipeLogs]     = useState<string[]>([]);
  const [totalSaved,   setTotalSaved]   = useState(0);
  const [orgIdState,   setOrgIdState]   = useState<string|undefined>(undefined);
  const [showPicker,   setShowPicker]   = useState(false);
  const [locationLabel,setLocationLabel]= useState<string>("Caméra téléphone");

  const { modules: activeModules } = useActiveModules(orgIdState);

  // Init org au montage
  useEffect(()=>{
    (async()=>{
      try {
        const status = await checkSetup();
        if(status.organizationId){
          orgIdRef.current = status.organizationId;
          setOrgIdState(status.organizationId);
          setReady(true);
          setPipeLog("✅ Organisation prête — choisissez l'emplacement");
        } else {
          const r = await quickSetup("Ma maison");
          orgIdRef.current = r.organizationId;
          setOrgIdState(r.organizationId);
          setReady(true);
          setPipeLog("✅ Organisation créée — choisissez l'emplacement");
        }
      } catch(e:any) {
        setPipeLog(`❌ Erreur init: ${e.message}`);
      }
    })();
    return ()=>{ streamRef.current?.getTracks().forEach(t=>t.stop()); };
  },[]);

  // Démarrer flux vidéo
  async function startStream(face:"user"|"environment"=facing) {
    setStreamError(null);
    try {
      streamRef.current?.getTracks().forEach(t=>t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video:{ facingMode:face, width:{ideal:1280}, height:{ideal:720} }, audio:false,
      });
      streamRef.current = stream;
      if(videoRef.current){ videoRef.current.srcObject=stream; await videoRef.current.play(); }
      setStreaming(true);

      // Créer la caméra dans Firestore
      if(!camIdRef.current && orgIdRef.current){
        const camId = await createCameraDirectly({
          organizationId: orgIdRef.current,
          name:    locationLabel,
          brand:   "WebRTC",
          connector:"phone_webcam",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        camIdRef.current = camId;
        setOrgIdState(orgIdRef.current);
        setPipeLog(`✅ ${locationLabel} — caméra prête`);
      } else {
        setPipeLog(`✅ ${locationLabel} — flux actif`);
      }
    } catch(e:any) {
      const msg = e.name==="NotAllowedError" ? "Permission caméra refusée" : e.message;
      setStreamError(msg);
      setPipeLog(`❌ ${msg}`);
    }
  }

  // Basculer avant / arrière
  async function toggleFacing() {
    const next = facing==="environment" ? "user" : "environment";
    setFacing(next);
    if(streaming) await startStream(next);
  }

  // Confirmer le nom d'emplacement depuis le picker
  async function handlePickerConfirm(val:{ cameraName:string; cameraId:string }) {
    setLocationLabel(val.cameraName);
    setShowPicker(false);
    camIdRef.current = null; // forcer la recréation avec le bon nom
    await startStream(facing);
  }

  const { startClip, recording } = useMediaRecorder(videoRef);

  // Pipeline détection
  const handleDetection = useCallback(async(dets: Detection[])=>{
    const orgId = orgIdRef.current;
    const camId = camIdRef.current;
    if(!orgId||!camId||!videoRef.current) return;

    const now = new Date().toLocaleTimeString("fr-CA");
    setSaved(prev=>[
      ...dets.slice(0,3).map(d=>({ label:d.label, time:now, color:d.color })),
      ...prev,
    ].slice(0,30));
    setTotalSaved(t=>t+dets.length);

    for(const det of dets){
      try {
        const result = await runDetectionPipeline({
          organizationId:orgId, cameraId:camId,
          detection:det, videoElement:videoRef.current,
        });
        if(result?.eventId && result.eventId!=="error"){
          const logMsg = `✅ ${det.label} → Event${result.snapshotUrl?" + 📷":""}`;
          setPipeLog(logMsg);
          setPipeLogs(prev=>[`${now} ${logMsg}`,...prev].slice(0,15));
          // Clip pour les alertes critiques
          if(videoRef.current?.srcObject && !recording && det.severity==="critical"){
            startClip({organizationId:orgId,cameraId:camId,eventId:result.eventId,durationSec:12})
              .then(clip=>{ if(clip) setPipeLog(`🎬 Clip ${clip.durationSeconds}s → Storage`); });
          }
        }
      } catch(err:any) {
        setPipeLog(`⚠️ ${err.message?.slice(0,40)}`);
      }
    }
  },[recording, startClip]);

  const { detections, isLoading, modelReady, fps } = useYoloDetection(videoRef,{
    mode:       detMode,
    fps:        8,
    confidence: 0.55,
    voteFrames: 2,
    onDetection:handleDetection,
  });

  return (
    <div>
      {/* Picker d'emplacement */}
      {showPicker && (
        <CameraLocationPicker
          onConfirm={handlePickerConfirm}
          onCancel={()=>setShowPicker(false)}
        />
      )}

      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">📱 Caméra téléphone</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {streaming ? `📍 ${locationLabel}` : "Activez la caméra pour surveiller"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {streaming && modelReady && detMode==="browser" && (
            <span className="rounded-full border border-emerald-700 bg-emerald-900/20 px-2 py-0.5 text-xs text-emerald-400">
              🤖 {fps}fps
            </span>
          )}
          {recording && (
            <span className="flex items-center gap-1 rounded-full border border-red-700 bg-red-900/20 px-2 py-0.5 text-xs text-red-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500"/>REC
            </span>
          )}
          <span className="text-xs text-slate-500">{totalSaved} enregistrés</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

        {/* Flux vidéo — 2/3 */}
        <div className="lg:col-span-2 space-y-3">

          {/* Video */}
          <div className="relative aspect-video overflow-hidden rounded-xl bg-black border border-slate-800">
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover"/>
            <DetectionOverlay detections={detections} videoRef={videoRef}/>

            {/* Badges status */}
            {streaming && (
              <>
                <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500"/>
                  <span className="text-xs text-white font-medium">LIVE · {locationLabel}</span>
                </div>
                <div className="absolute top-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs text-slate-300">
                  {facing==="user"?"🤳 Avant":"📷 Arrière"}
                </div>
              </>
            )}

            {/* IA overlay */}
            {streaming && (
              <div className="absolute bottom-3 right-3 rounded-lg bg-black/70 px-2.5 py-1.5 text-xs">
                {isLoading
                  ? <span className="text-amber-400">⏳ Chargement IA...</span>
                  : detMode==="browser" && modelReady
                  ? <span className="text-emerald-400">🎯 {detections.length} détection(s)</span>
                  : <span className="text-slate-500">IA désactivée</span>}
              </div>
            )}

            {/* Écran inactif */}
            {!streaming && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <span className="text-6xl">📱</span>
                <button onClick={()=>setShowPicker(true)}
                  className="rounded-2xl bg-brand px-8 py-3 text-base font-bold text-white hover:bg-brand/90">
                  📷 Démarrer la caméra
                </button>
                <p className="text-xs text-slate-600">Vous choisirez l'emplacement</p>
              </div>
            )}

            {/* Erreur */}
            {streamError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="rounded-xl border border-red-800 bg-red-900/20 p-4 text-center max-w-xs">
                  <p className="text-red-400 text-sm font-medium mb-2">❌ {streamError}</p>
                  <button onClick={()=>startStream(facing)}
                    className="rounded-lg bg-red-600 px-4 py-2 text-xs text-white">Réessayer</button>
                </div>
              </div>
            )}
          </div>

          {/* Contrôles */}
          <div className="flex flex-wrap gap-2">
            {/* Démarrer / Arrêter */}
            {!streaming ? (
              <button onClick={()=>setShowPicker(true)}
                className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand/90">
                ▶ Démarrer
              </button>
            ) : (
              <button onClick={()=>{
                streamRef.current?.getTracks().forEach(t=>t.stop());
                setStreaming(false); setDetMode("off");
                if(videoRef.current) videoRef.current.srcObject=null;
                setPipeLog("Caméra arrêtée");
              }} className="rounded-xl border border-red-700 bg-red-900/10 px-5 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-900/20">
                ⏹ Arrêter
              </button>
            )}

            {/* Toggle caméra avant / arrière */}
            <button onClick={toggleFacing}
              className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-white hover:border-brand transition-colors">
              {facing==="environment" ? "🤳 Vue avant" : "📷 Vue arrière"}
            </button>

            {/* IA ON/OFF */}
            {streaming && (
              <button onClick={()=>setDetMode(d=>d==="off"?"browser":"off")}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                  detMode==="browser"
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-slate-700 text-slate-300 hover:border-slate-500"
                }`}>
                🤖 IA {detMode==="browser"?"ON":"OFF"}
              </button>
            )}

            {/* Changer emplacement */}
            <button onClick={()=>setShowPicker(true)}
              className="flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:text-white hover:border-slate-500">
              📍 {locationLabel!=="Caméra téléphone" ? locationLabel : "Emplacement"}
            </button>
          </div>

          {/* Modules actifs */}
          {activeModules.length>0 && (
            <div className="flex flex-wrap gap-2">
              {activeModules.map(m=>(
                <Link key={m.id} href={`/modules/${m.id}`}
                  className="flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs text-brand hover:bg-brand/20">
                  {m.config.icon} {m.config.name} actif
                </Link>
              ))}
            </div>
          )}

          {/* Log pipeline */}
          <div className={`rounded-xl border px-3 py-2.5 text-xs font-mono ${
            pipeLog.startsWith("✅")?"border-emerald-800 bg-emerald-900/10 text-emerald-400"
            :pipeLog.startsWith("❌")?"border-red-800 bg-red-900/10 text-red-400"
            :pipeLog.startsWith("🎬")?"border-brand/40 bg-brand/5 text-brand"
            :"border-slate-800 bg-slate-900 text-slate-400"
          }`}>{pipeLog}</div>

          {/* Historique logs */}
          {pipeLogs.length>0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 max-h-24 overflow-y-auto space-y-0.5">
              {pipeLogs.map((l,i)=>(
                <p key={i} className={`text-xs font-mono ${l.includes("✅")?"text-emerald-600":l.includes("🎬")?"text-brand":l.includes("⚠️")?"text-amber-600":"text-slate-600"}`}>{l}</p>
              ))}
            </div>
          )}
        </div>

        {/* Panel droit — 1/3 */}
        <div className="space-y-4">

          {/* Détections live */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-400">DÉTECTIONS ({saved.length})</h3>
              {saved.length>0&&<button onClick={()=>setSaved([])} className="text-xs text-slate-600 hover:text-slate-400">Effacer</button>}
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {saved.length===0
                ? <p className="text-xs text-slate-600 text-center py-6">Activez l'IA pour détecter</p>
                : saved.map((s,i)=>(
                  <div key={i} className="flex items-center gap-2">
                    <div className="h-2 w-2 shrink-0 rounded-full" style={{background:s.color}}/>
                    <span className="flex-1 text-xs text-white truncate">{s.label}</span>
                    <span className="text-xs text-slate-600 shrink-0">{s.time}</span>
                  </div>
                ))
              }
            </div>
          </div>

          {/* Navigation rapide */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h3 className="mb-3 text-xs font-semibold text-slate-400">ACCÈS RAPIDE</h3>
            <div className="space-y-1.5">
              {[
                {href:"/events",         label:"🚨 Events",           desc:"Historique détections"},
                {href:"/notifications",  label:"🔔 Notifications",    desc:"Alertes en temps réel"},
                {href:"/analytics",      label:"📊 Analytics",        desc:"Stats et heatmaps"},
                {href:"/modules",        label:"🧩 Modules IA",       desc:"Gérer les modules"},
                {href:"/live-monitoring",label:"📺 Live Monitor",     desc:"Toutes les caméras"},
              ].map(l=>(
                <Link key={l.href} href={l.href}
                  className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2 hover:bg-slate-800 transition-colors">
                  <div>
                    <p className="text-xs text-white">{l.label}</p>
                    <p className="text-xs text-slate-600">{l.desc}</p>
                  </div>
                  <span className="text-slate-600">→</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Info caméra */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h3 className="mb-3 text-xs font-semibold text-slate-400">INFOS</h3>
            <div className="space-y-2 text-xs">
              {[
                ["Emplacement", locationLabel],
                ["Vue",         facing==="user"?"Avant (selfie)":"Arrière"],
                ["IA",          detMode==="browser"&&modelReady?`Actif · ${fps}fps`:"Inactive"],
                ["Enregistrement", `${totalSaved} total`],
              ].map(([l,v])=>(
                <div key={l} className="flex justify-between">
                  <span className="text-slate-500">{l}</span>
                  <span className="text-slate-300">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
