"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { SMARTCITY_CONFIG } from "@/lib/orchestrator/newModuleConfigs";
import { DetectionOverlay } from "@/components/DetectionOverlay";
import { useYoloDetection, type Detection } from "@/lib/hooks/useYoloDetection";
import { useMediaRecorder } from "@/lib/hooks/useMediaRecorder";
import { runDetectionPipeline } from "@/lib/services/pipelineService";
import { checkSetup, quickSetup, createCameraDirectly } from "@/lib/services/setupService";
import { ModuleToggleBar } from "@/components/ModuleToggleBar";
import { AIModelStatus } from "@/components/AIModelStatus";
import { doc, setDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

const cfg = SMARTCITY_CONFIG;
const mod = cfg.module;
type Tab = "overview"|"detections"|"locations"|"analytics"|"reports"|"ai_models";

export default function SmartCityPage() {
  const [tab,streaming,aiOn,log,session,orgId,camId,facing,setters] = useModuleState();
  const { setTab,setStreaming,setAiOn,setLog,setSession,setOrgId,setCamId,setFacing } = setters;
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef= useRef<MediaStream|null>(null);
  const {startClip,recording,uploading}=useMediaRecorder(videoRef);
  const [mods,setMods]=useState<string[]>([]);

  useEffect(()=>{
    checkSetup().then(s=>{ if(s.organizationId) setOrgId(s.organizationId); });
    return ()=>{ streamRef.current?.getTracks().forEach(t=>t.stop()); };
  },[]);

  async function startCam(face:"user"|"environment"=facing){
    try{
      streamRef.current?.getTracks().forEach(t=>t.stop());
      const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:face,width:{ideal:1280},height:{ideal:720}},audio:false});
      streamRef.current=s;
      if(videoRef.current){videoRef.current.srcObject=s;await videoRef.current.play();}
      setStreaming(true);
      let org=orgId;
      if(!org){const r=await quickSetup("Smart City");org=r.organizationId;setOrgId(org);}
      if(org&&!camId){
        const id=await createCameraDirectly({organizationId:org,name:"Smart City Camera",brand:"WebRTC",connector:"phone_webcam",timezone:Intl.DateTimeFormat().resolvedOptions().timeZone});
        setCamId(id);setLog("✅ Smart City AI prêt");
      }else setLog("✅ Flux actif");
    }catch(e:any){setLog(`❌ ${e.message}`);}
  }

  async function toggleFacing(){ const n=facing==="environment"?"user":"environment"; setFacing(n); if(streaming) await startCam(n); }
  function stopCam(){ streamRef.current?.getTracks().forEach(t=>t.stop()); setStreaming(false); setAiOn(false); if(videoRef.current) videoRef.current.srcObject=null; setLog("Arrêté"); }

  async function handleRecord(){
    if(recording||!orgId||!camId) return;
    const now=new Date().toISOString(), evId=doc(collection(db,"_")).id;
    await setDoc(doc(db,"organizations",orgId,"events",evId),{id:evId,organizationId:orgId,cameraId:camId,siteId:"default",detectionIds:[],primaryType:"manual_recording",category:"manual",label:"Enregistrement Smart City",severity:"info",durationSeconds:0,thumbnailUrl:null,videoClipUrl:null,clipStatus:"recording",acknowledged:false,createdAt:now,updatedAt:now});
    setLog("🔴 Enregistrement 15s...");
    const r=await startClip({organizationId:orgId,cameraId:camId,eventId:evId,durationSec:15});
    if(r) setLog(`✅ Clip ${r.durationSeconds}s → Storage`);
  }

  const handleDetection=useCallback(async(dets:Detection[])=>{
    const time=new Date().toLocaleTimeString("fr-CA");
    setSession(prev=>[...dets.map(d=>({label:d.label,icon:"🌆",severity:d.severity,time})),...prev].slice(0,50));
    setLog(`${dets[0]?.label} · ${time}`);
    if(orgId&&camId&&videoRef.current){
      for(const det of dets){
        const r=await runDetectionPipeline({organizationId:orgId,cameraId:camId,detection:det,videoElement:videoRef.current}).catch(()=>null);
        if(r?.eventId&&r.eventId!=="error"&&!recording&&videoRef.current?.srcObject&&(det.severity==="warning"||det.severity==="critical"))
          startClip({organizationId:orgId,cameraId:camId,eventId:r.eventId,durationSec:12});
      }
    }
  },[orgId,camId,recording,startClip]);

  const {detections,modelReady,fps}=useYoloDetection(videoRef,{mode:aiOn&&streaming?"browser":"off",fps:8,confidence:0.40,voteFrames:2,onDetection:handleDetection});
  const TABS:Tab[]=["overview","detections","locations","analytics","reports","ai_models"];

  return <ModulePage cfg={cfg} mod={mod} tab={tab} setTab={setTab} streaming={streaming} aiOn={aiOn} facing={facing} log={log} session={session} orgId={orgId} mods={mods} setMods={setMods} recording={recording} uploading={uploading} detections={detections} modelReady={modelReady} fps={fps} videoRef={videoRef} TABS={TABS} startCam={startCam} stopCam={stopCam} toggleFacing={toggleFacing} handleRecord={handleRecord} setAiOn={setAiOn} setSession={setSession}/>;
}

function useModuleState(){
  const [tab,setTab]=useState<"overview"|"detections"|"locations"|"analytics"|"reports"|"ai_models">("overview");
  const [streaming,setStreaming]=useState(false);
  const [aiOn,setAiOn]=useState(false);
  const [log,setLog]=useState("Démarrez la caméra");
  const [session,setSession]=useState<{label:string;icon:string;severity:string;time:string}[]>([]);
  const [orgId,setOrgId]=useState<string|null>(null);
  const [camId,setCamId]=useState<string|null>(null);
  const [facing,setFacing]=useState<"user"|"environment">("environment");
  return [tab,streaming,aiOn,log,session,orgId,camId,facing,{setTab,setStreaming,setAiOn,setLog,setSession,setOrgId,setCamId,setFacing}] as const;
}

function ModulePage({cfg,mod,tab,setTab,streaming,aiOn,facing,log,session,orgId,mods,setMods,recording,uploading,detections,modelReady,fps,videoRef,TABS,startCam,stopCam,toggleFacing,handleRecord,setAiOn,setSession}:any){
  return(
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="border-b border-slate-800 px-5 py-4">
        <div className="flex items-center gap-3 mb-3">
          <Link href="/modules" className="text-slate-400 hover:text-white">←</Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl text-2xl" style={{background:`${mod.color}20`,border:`1px solid ${mod.color}30`}}>{mod.icon}</div>
          <div><h1 className="text-base font-bold text-white">{mod.name}</h1><p className="text-xs text-slate-500">{mod.goal?.slice(0,60)}...</p></div>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {TABS.map((t:string)=>(
            <button key={t} onClick={()=>setTab(t)} className="rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap"
              style={tab===t?{borderColor:mod.color,background:`${mod.color}15`,color:mod.color,border:"1px solid"}:{color:"#94a3b8"}}>
              {t==="overview"?"📊 Vue":t==="detections"?"🎯 Détections":t==="locations"?"📍 Lieux":t==="analytics"?"📈 Stats":t==="reports"?"📄 Rapports":"🤖 Modèles"}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4">
        {tab==="overview"&&(
          <div className="space-y-4">
            <div className="relative aspect-video overflow-hidden rounded-xl bg-black border border-slate-800">
              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover"/>
              <DetectionOverlay detections={detections} videoRef={videoRef}/>
              {streaming&&<div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1"><span className="h-2 w-2 animate-pulse rounded-full bg-red-500"/><span className="text-xs text-white">{mod.icon} {mod.name}</span></div>}
              {streaming&&<div className="absolute top-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs text-slate-300">{facing==="user"?"🤳 Avant":"📷 Arrière"}</div>}
              {recording&&<div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-red-900/80 border border-red-700 px-3 py-1"><span className="h-2 w-2 animate-pulse rounded-full bg-red-500"/><span className="text-xs text-red-300 font-bold">🔴 REC</span></div>}
              {!streaming&&<div className="absolute inset-0 flex flex-col items-center justify-center gap-3"><span className="text-5xl">{mod.icon}</span><button onClick={()=>startCam()} className="rounded-xl px-6 py-2.5 text-sm font-bold text-white" style={{background:mod.color}}>▶ Démarrer</button></div>}
            </div>
            <div className="flex flex-wrap gap-2">
              {!streaming?<button onClick={()=>startCam()} className="rounded-xl px-4 py-2.5 text-sm font-bold text-white" style={{background:mod.color}}>▶ Démarrer</button>
              :<button onClick={stopCam} className="rounded-xl border border-red-700 bg-red-900/10 px-4 py-2.5 text-sm font-bold text-red-400">⏹ Arrêter</button>}
              <button onClick={toggleFacing} className="flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:border-brand">{facing==="environment"?"🤳 Vue avant":"📷 Vue arrière"}</button>
              <button onClick={handleRecord} disabled={!streaming||recording||uploading} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-40 ${recording?"border border-red-600 bg-red-900/20 text-red-400":"bg-red-600 text-white hover:bg-red-700"}`}>
                {recording?<><span className="h-2 w-2 animate-pulse rounded-full bg-red-400"/>⏹ REC...</>:uploading?"⏳ Upload...":"🔴 Enregistrer"}
              </button>
              {streaming&&<button onClick={()=>setAiOn(!aiOn)} className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm ${aiOn?"border-brand bg-brand/10 text-brand":"border-slate-700 text-slate-300"}`}>🤖 IA {aiOn?"ON":"OFF"}{aiOn&&modelReady?` · ${fps}fps`:""}</button>}
            </div>
            <div className={`rounded-xl border px-3 py-2.5 text-xs font-mono ${log.startsWith("✅")?"border-emerald-800 bg-emerald-900/10 text-emerald-400":log.startsWith("❌")?"border-red-800 bg-red-900/10 text-red-400":"border-slate-800 bg-slate-900 text-slate-400"}`}>{log}</div>
            {orgId&&<ModuleToggleBar organizationId={orgId} onModulesChange={setMods}/>}
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center justify-between mb-2"><h3 className="text-xs font-semibold text-slate-400">SESSION ({session.length})</h3>{session.length>0&&<button onClick={()=>setSession([])} className="text-xs text-slate-600">Effacer</button>}</div>
              <div className="max-h-36 overflow-y-auto space-y-1">
                {session.length===0?<p className="text-xs text-slate-600 text-center py-3">Démarrez la caméra + IA</p>
                :session.map((s:any,i:number)=>(
                  <div key={i} className={`flex items-center gap-2 rounded px-2 py-1 ${s.severity==="critical"?"bg-red-900/20":s.severity==="warning"?"bg-amber-900/20":""}`}>
                    <span>{s.icon}</span><span className="flex-1 text-xs text-white truncate">{s.label}</span><span className="text-xs text-slate-600">{s.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {tab==="detections"&&<div><h2 className="text-base font-semibold text-white mb-4">🎯 {cfg.detections.length} classes</h2><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{cfg.detections.map((d:any)=><div key={d.id} className={`rounded-xl border p-3 ${d.severity==="critical"?"border-red-800/40 bg-red-900/10":d.severity==="warning"?"border-amber-800/40 bg-amber-900/10":"border-slate-800 bg-slate-900"}`}><span className="text-2xl block mb-1">{d.icon}</span><p className="text-xs font-medium text-white">{d.label}</p>{d.alert&&<p className="text-xs text-red-400">🚨</p>}</div>)}</div></div>}
        {tab==="locations"&&<div className="space-y-4">{cfg.locations.map((c:any)=><div key={c.cat}><h3 className="text-xs font-semibold text-slate-400 mb-2">{c.cat}</h3><div className="flex flex-wrap gap-1.5">{c.locs.map((l:string)=><span key={l} className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300">{l}</span>)}</div></div>)}</div>}
        {tab==="analytics"&&<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{cfg.analytics.map((a:any)=><div key={a.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4"><span className="text-2xl block mb-2">{a.icon}</span><p className="text-xs text-slate-500 mb-1">{a.label}</p><p className="text-xl font-bold" style={{color:mod.color}}>—</p><p className="text-xs text-slate-600">{a.unit}</p></div>)}</div>}
        {tab==="reports"&&<div className="space-y-2">{cfg.reports.map((r:any)=><div key={r.id} className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900 p-4"><span className="text-2xl">{r.icon}</span><div className="flex-1"><p className="text-sm font-medium text-white">{r.label}</p><p className="text-xs text-slate-500">{r.freq==="daily"?"Quotidien":r.freq==="weekly"?"Hebdo":r.freq==="monthly"?"Mensuel":r.freq==="on_event"?"Sur événement":"Demande"}</p></div><button className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:border-brand">Générer</button></div>)}</div>}
        {tab==="ai_models"&&<div className="space-y-4"><div className="flex flex-wrap gap-2 mb-4">{cfg.ai_models.map((m:string)=><span key={m} className="rounded-full border border-brand/40 bg-brand/10 px-3 py-1.5 text-xs font-medium text-brand">{m}</span>)}</div><AIModelStatus compact={false}/></div>}
      </div>
    </div>
  );
}
