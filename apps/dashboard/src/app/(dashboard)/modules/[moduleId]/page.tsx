"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useOrganization } from "@/lib/context/OrganizationContext";
import { DetectionOverlay } from "@/components/DetectionOverlay";
import { useYoloDetection, type Detection } from "@/lib/hooks/useYoloDetection";
import { useMediaRecorder } from "@/lib/hooks/useMediaRecorder";
import { runDetectionPipeline } from "@/lib/services/pipelineService";
import { quickSetup, createCameraDirectly, checkSetup } from "@/lib/services/setupService";
import { MODULE_CONFIGS } from "@/lib/orchestrator/moduleConfigs";
import { getBundleById } from "@/lib/orchestrator/bundles";
import { ModuleLocationPicker } from "@/components/ModuleLocationPicker";
import { auth } from "@/lib/firebase/client";

interface SessionItem {
  label:string; icon:string; severity:string; time:string; alertTriggered:boolean;
}

export default function ModuleTestPage({ params }: { params: { moduleId: string } }) {
  const { moduleId }   = params;
  const { currentOrg } = useOrganization();

  const config = MODULE_CONFIGS[moduleId];
  const bundle = getBundleById(moduleId);

  const videoRef   = useRef<HTMLVideoElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const orgIdRef   = useRef<string | null>(null);
  const camIdRef   = useRef<string | null>(null);

  // États caméra
  const [facing,       setFacing]       = useState<"user"|"environment">("environment");
  const [streaming,    setStreaming]     = useState(false);
  const [aiOn,         setAiOn]         = useState(false);
  const [autoSave,     setAutoSave]     = useState(true);
  const [pipeLog,      setPipeLog]      = useState("Sélectionnez l'emplacement pour démarrer");
  const [pipeLogs,     setPipeLogs]     = useState<string[]>([]);
  const [session,      setSession]      = useState<SessionItem[]>([]);
  const [tab,          setTab]          = useState<"live"|"stats"|"tips">("live");
  const [orgIdState,   setOrgIdState]   = useState<string|undefined>(undefined);

  // Picker emplacement
  const [showPicker,   setShowPicker]   = useState(false);
  const [locationName, setLocationName] = useState<string|null>(null);

  // Initialisation org
  useEffect(()=>{
    checkSetup().then(s=>{
      if(s.organizationId){
        orgIdRef.current = s.organizationId;
        setOrgIdState(s.organizationId);
      }
    });
    return ()=>{ streamRef.current?.getTracks().forEach(t=>t.stop()); };
  },[]);

  // Démarrer caméra
  async function startCamera(face: "user"|"environment" = facing) {
    try {
      streamRef.current?.getTracks().forEach(t=>t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video:{ facingMode:face, width:{ideal:1280}, height:{ideal:720} }, audio:false,
      });
      streamRef.current = stream;
      if(videoRef.current){ videoRef.current.srcObject=stream; await videoRef.current.play(); }
      setStreaming(true);

      // Créer la caméra dans Firestore si pas encore fait
      if(!orgIdRef.current){
        const r = await quickSetup(currentOrg?.name ?? "Mon organisation");
        orgIdRef.current = r.organizationId;
        setOrgIdState(r.organizationId);
      }
      if(!camIdRef.current && orgIdRef.current){
        const camName = locationName
          ? `${config?.name} — ${locationName}`
          : `${config?.name} — Caméra`;
        const id = await createCameraDirectly({
          organizationId: orgIdRef.current,
          name:           camName,
          brand:          "WebRTC",
          connector:      "phone_webcam",
          timezone:       Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        camIdRef.current = id;
        setPipeLog(`✅ Caméra "${camName}" créée`);
      } else {
        setPipeLog(`✅ Prêt · ${locationName ?? config?.name}`);
      }
    } catch(e:any) {
      setPipeLog(`❌ Caméra: ${e.message}`);
    }
  }

  // Basculer caméra avant/arrière
  async function toggleFacing() {
    const next = facing==="environment" ? "user" : "environment";
    setFacing(next);
    if(streaming) await startCamera(next);
  }

  // Confirmer l'emplacement et démarrer
  async function handleLocationConfirm(loc:{ category:string; name:string; fullName:string }) {
    setLocationName(loc.name);
    setShowPicker(false);
    await startCamera(facing);
  }

  const { startClip, recording } = useMediaRecorder(videoRef);

  // Pipeline de détection
  const handleDetection = useCallback(async(dets: Detection[])=>{
    const orgId = orgIdRef.current;
    const camId = camIdRef.current;

    // Filtrer aux classes du module
    const classMap: Record<string,any> = {};
    config?.classes.forEach(c=>{ classMap[c.cocoClass]=c; });
    const modDets = dets.filter(d=>classMap[d.class]);
    if(!modDets.length) return;

    const now = new Date().toLocaleTimeString("fr-CA");

    // Ajouter à la session
    setSession(prev=>[
      ...modDets.map(d=>{
        const mc = classMap[d.class];
        return { label:mc?.label??d.label, icon:mc?.icon??"📦", severity:mc?.severity??"info", time:now, alertTriggered:mc?.alertOn??false };
      }),
      ...prev,
    ].slice(0,80));

    const logMsg = `${modDets[0] ? classMap[modDets[0].class]?.icon : "📦"} ${modDets[0] ? classMap[modDets[0].class]?.label : "?"} · ${now}`;
    setPipeLog(logMsg);
    setPipeLogs(prev=>[logMsg,...prev].slice(0,20));

    // Sauvegarder dans Firebase
    if(autoSave && orgId && camId && videoRef.current){
      for(const det of modDets){
        const mc = classMap[det.class];
        if(!mc?.sendToEvents) continue;
        try {
          const result = await runDetectionPipeline({
            organizationId:orgId, cameraId:camId,
            detection:{...det, label:mc.label, severity:mc.severity, category:det.category},
            videoElement:videoRef.current,
          });
          if(result?.eventId && result.eventId!=="error" && mc.alertOn && !recording && videoRef.current?.srcObject){
            startClip({organizationId:orgId,cameraId:camId,eventId:result.eventId,durationSec:10});
          }
        } catch {}
      }
    }
  },[autoSave, recording, startClip, config]);

  const { detections, isLoading, modelReady, fps } = useYoloDetection(videoRef,{
    mode:      aiOn && streaming ? "browser" : "off",
    fps:       8,
    confidence:0.40,
    voteFrames:2,
    onDetection:handleDetection,
  });

  const moduleDetections = detections.filter(d=>{
    const classMap: Record<string,any> = {};
    config?.classes.forEach(c=>{ classMap[c.cocoClass]=c; });
    return classMap[d.class];
  });

  // Stats session
  const violations = session.filter(s=>s.severity==="critical"||s.severity==="warning").length;
  const statsVals: Record<string,string|number> = {};
  config?.stats.forEach(s=>{ statsVals[s.id]=s.compute(session.map(x=>({class:"person",score:0.8,severity:x.severity,alertOn:x.alertTriggered}))); });

  if(!config||!bundle) return (
    <div className="text-center py-20">
      <p className="text-slate-400">Module "{moduleId}" introuvable</p>
      <Link href="/modules" className="text-brand hover:underline mt-2 block">← Retour aux modules</Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* Picker emplacement */}
      {showPicker && (
        <ModuleLocationPicker
          moduleId={moduleId}
          moduleName={config.name}
          moduleIcon={bundle.icon}
          moduleColor={bundle.color}
          onConfirm={handleLocationConfirm}
          onSkip={()=>{ setShowPicker(false); startCamera(facing); }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <Link href="/modules" className="text-slate-400 hover:text-white">←</Link>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl text-xl"
            style={{background:bundle.color+"20",border:`1px solid ${bundle.color}30`}}>
            {bundle.icon}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{config.name}</p>
            <p className="text-xs text-slate-500">
              {locationName ? `📍 ${locationName}` : config.sector}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {streaming && modelReady && aiOn && (
            <span className="rounded-full border border-emerald-700 bg-emerald-900/20 px-2 py-0.5 text-xs text-emerald-400">
              🤖 {fps}fps
            </span>
          )}
          {recording && (
            <span className="flex items-center gap-1 rounded-full border border-red-700 bg-red-900/20 px-2 py-0.5 text-xs text-red-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500"/>REC
            </span>
          )}
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-400">
            <input type="checkbox" checked={autoSave} onChange={e=>setAutoSave(e.target.checked)} className="accent-brand"/>
            Firebase
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-3">

        {/* Flux vidéo */}
        <div className="lg:col-span-2 space-y-3">
          <div className="relative aspect-video overflow-hidden rounded-xl bg-black border border-slate-800">
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover"/>
            <DetectionOverlay detections={moduleDetections} videoRef={videoRef}/>

            {/* Badge LIVE */}
            {streaming && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500"/>
                <span className="text-xs text-white font-medium">{locationName ?? config.name}</span>
              </div>
            )}

            {/* Badge caméra */}
            {streaming && (
              <div className="absolute top-3 right-3 rounded-full bg-black/60 px-2 py-1 text-xs text-slate-300">
                {facing==="user"?"🤳 Avant":"📷 Arrière"}
              </div>
            )}

            {/* IA status */}
            <div className="absolute bottom-3 right-3 rounded-lg bg-black/70 px-2 py-1 text-xs">
              {!streaming ? (
                <span className="text-slate-500">Caméra inactive</span>
              ) : isLoading ? (
                <span className="text-amber-400">⏳ Chargement IA...</span>
              ) : aiOn && modelReady ? (
                <span className="text-emerald-400">🎯 {moduleDetections.length} détection(s)</span>
              ) : (
                <span className="text-slate-500">IA désactivée</span>
              )}
            </div>

            {/* Écran vide — inviter à démarrer */}
            {!streaming && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <span className="text-6xl">{bundle.icon}</span>
                <button onClick={()=>{
                  // Modules Industrial et Construction → picker d'emplacement
                  if(moduleId==="industrial"||moduleId==="construction"){
                    setShowPicker(true);
                  } else {
                    startCamera(facing);
                  }
                }} className="rounded-2xl px-8 py-3 text-base font-bold text-white"
                  style={{background:bundle.color}}>
                  📷 Démarrer la caméra
                </button>
                <p className="text-xs text-slate-600">
                  {moduleId==="industrial"||moduleId==="construction"
                    ? "Vous choisirez l'emplacement avant de démarrer"
                    : "Appuyez pour activer"}
                </p>
              </div>
            )}
          </div>

          {/* Contrôles */}
          <div className="flex gap-2 flex-wrap">
            {/* Démarrer / Arrêter */}
            <button onClick={()=>{
              if(streaming){
                streamRef.current?.getTracks().forEach(t=>t.stop());
                setStreaming(false);
                setAiOn(false);
                setPipeLog("Caméra arrêtée");
                if(videoRef.current) videoRef.current.srcObject=null;
              } else {
                if(moduleId==="industrial"||moduleId==="construction"){
                  setShowPicker(true);
                } else {
                  startCamera(facing);
                }
              }
            }} className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
              streaming
                ? "border-red-700 bg-red-900/10 text-red-400 hover:bg-red-900/20"
                : "text-white"
            }`} style={!streaming?{background:bundle.color,border:`1px solid ${bundle.color}`}:{}}>
              {streaming ? "⏹ Arrêter" : "▶ Démarrer"}
            </button>

            {/* Toggle avant / arrière */}
            <button onClick={toggleFacing}
              className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-white hover:border-slate-500 transition-colors">
              {facing==="environment" ? "🤳 Caméra avant" : "📷 Caméra arrière"}
            </button>

            {/* Activer / désactiver IA */}
            {streaming && (
              <button onClick={()=>setAiOn(!aiOn)}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                  aiOn
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-slate-700 text-slate-300 hover:border-slate-500"
                }`}>
                🤖 IA {aiOn?"ON":"OFF"}
              </button>
            )}

            {/* Changer emplacement */}
            {(moduleId==="industrial"||moduleId==="construction") && (
              <button onClick={()=>setShowPicker(true)}
                className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-xs text-slate-400 hover:text-white hover:border-slate-500">
                📍 {locationName?"Changer emplacement":"Choisir emplacement"}
              </button>
            )}

            {/* Log */}
            <div className={`flex-1 min-w-40 rounded-xl border px-3 py-2.5 text-xs font-mono ${
              pipeLog.startsWith("✅")?"border-emerald-800 bg-emerald-900/10 text-emerald-400"
              :pipeLog.startsWith("❌")?"border-red-800 bg-red-900/10 text-red-400"
              :pipeLog.includes("🎬")?"border-brand/50 bg-brand/5 text-brand"
              :"border-slate-800 bg-slate-900 text-slate-400"
            }`}>
              {pipeLog}
            </div>
          </div>

          {/* Note navigateur */}
          <div className="rounded-xl border border-amber-800/30 bg-amber-900/10 px-4 py-2.5 text-xs text-amber-400">
            ℹ️ {config.browserNote}
          </div>
        </div>

        {/* Panel droit */}
        <div className="space-y-3">
          {/* Tabs */}
          <div className="flex rounded-lg bg-slate-900 p-1 gap-1">
            {(["live","stats","tips"] as const).map(t=>(
              <button key={t} onClick={()=>setTab(t)}
                className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                  tab===t ? "text-white" : "text-slate-400 hover:text-white"
                }`} style={tab===t?{background:bundle.color}:{}}>
                {t==="live"?"🔴 Live":t==="stats"?"📊 Stats":"💡 Conseils"}
              </button>
            ))}
          </div>

          {/* LIVE */}
          {tab==="live" && (
            <>
              {/* Classes du module */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <h3 className="mb-2.5 text-xs font-semibold text-slate-400">CLASSES ACTIVES ({config.classes.length})</h3>
                <div className="space-y-1">
                  {config.classes.map(cls=>{
                    const classMap: Record<string,any>={};
                    config.classes.forEach(c=>{classMap[c.cocoClass]=c;});
                    const isDetected = moduleDetections.some(d=>d.class===cls.cocoClass);
                    return (
                      <div key={cls.cocoClass}
                        className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition-all ${isDetected?"bg-slate-800":""}`}>
                        <span className="text-base shrink-0">{cls.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white truncate">{cls.label}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {cls.alertOn&&<span className="text-xs text-red-400">🚨</span>}
                          {cls.sendToEvents&&<span className="text-xs text-brand">E</span>}
                          {isDetected&&<span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"/>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-slate-600">E = envoyé aux Events</p>
              </div>

              {/* Session */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-400">SESSION ({session.length})</h3>
                  {session.length>0&&<button onClick={()=>setSession([])} className="text-xs text-slate-600 hover:text-slate-400">Effacer</button>}
                </div>
                <div className="max-h-40 overflow-y-auto space-y-0.5">
                  {session.length===0
                    ? <p className="text-xs text-slate-600 text-center py-3">Démarrez la caméra + IA</p>
                    : session.slice(0,30).map((s,i)=>(
                      <div key={i} className={`flex items-center gap-2 rounded px-2 py-1 ${s.alertTriggered?"bg-red-900/20":""}`}>
                        <span>{s.icon}</span>
                        <span className="flex-1 text-xs text-white truncate">{s.label}</span>
                        <span className="text-xs text-slate-600 shrink-0">{s.time}</span>
                        {s.alertTriggered&&<span className="text-xs text-red-400">🚨</span>}
                      </div>
                    ))
                  }
                </div>
              </div>
            </>
          )}

          {/* STATS */}
          {tab==="stats" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {config.stats.map(s=>(
                  <div key={s.id} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                    <p className="text-xs text-slate-500 mb-1">{s.icon} {s.label}</p>
                    <p className="text-xl font-bold" style={{color:s.color}}>{statsVals[s.id]??0}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-2">
                <h3 className="text-xs font-semibold text-slate-400">LIENS</h3>
                {[
                  {href:"/events",       label:"🚨 Events"},
                  {href:"/notifications",label:"🔔 Notifications"},
                  {href:"/analytics",    label:"📊 Analytics"},
                  {href:"/ai-detection", label:"🤖 AI Détection"},
                ].map(l=>(
                  <Link key={l.href} href={l.href}
                    className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2 text-xs text-slate-300 hover:text-brand">
                    {l.label}<span>→</span>
                  </Link>
                ))}
              </div>
            </>
          )}

          {/* CONSEILS */}
          {tab==="tips" && (
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <h3 className="mb-3 text-xs font-semibold text-slate-400">CONSEILS INSTALLATION</h3>
                {config.tips.map((tip,i)=>(
                  <div key={i} className="flex gap-2 text-xs text-slate-400 mb-2">
                    <span className="text-brand shrink-0">•</span>
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <h3 className="mb-3 text-xs font-semibold text-slate-400">MODÈLES IA</h3>
                {bundle.models.map(m=>(
                  <div key={m} className="flex items-center gap-2 mb-1.5 text-xs">
                    <span className="text-emerald-400">✓</span>
                    <span className="text-slate-300 font-medium">{m}</span>
                  </div>
                ))}
              </div>
              <Link href={`/marketplace`}
                className="block rounded-xl border border-brand/30 bg-brand/5 p-3 text-center text-sm text-brand hover:bg-brand/10">
                🧩 Configurer dans le Marketplace →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Logs persistants */}
      {pipeLogs.length>0&&(
        <div className="mx-4 mb-4 rounded-xl border border-slate-800 bg-slate-950 p-3 max-h-24 overflow-y-auto">
          {pipeLogs.map((log,i)=>(
            <p key={i} className="text-xs font-mono text-slate-500">{log}</p>
          ))}
        </div>
      )}
    </div>
  );
}
