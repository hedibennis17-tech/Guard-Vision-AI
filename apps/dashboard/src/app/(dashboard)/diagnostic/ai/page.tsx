"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const SERVER = process.env.NEXT_PUBLIC_AI_SERVER_URL ?? "https://guard-vision-ai-production.up.railway.app";

interface Detection { class:string; label:string; score:number; bbox?:number[]; color?:string; icon?:string; severity?:string; }
interface Worker { worker_id:number; bbox:number[]; color:string; score:number; compliant:boolean; epi_present:any[]; epi_absent:any[]; }

type ModelState = {
  id: string;
  name: string;
  icon: string;
  color: string;
  active: boolean;
  status: "idle"|"loading"|"ok"|"error"|"disabled";
  detections: Detection[];
  workers?: Worker[];
  latency?: number;
  error?: string;
  nc?: number;
  classes?: string[];
  info?: string;
};

const INITIAL_MODELS: ModelState[] = [
  { id:"coco",      name:"COCO-SSD",          icon:"🌐", color:"#3B82F6", active:false, status:"idle", detections:[], info:"80 classes — navigateur" },
  { id:"yolo",      name:"YOLOv11 ONNX",       icon:"⚡", color:"#8B5CF6", active:false, status:"idle", detections:[], info:"Railway — général" },
  { id:"ppe",       name:"PPE Detector",        icon:"⛑️", color:"#F59E0B", active:false, status:"idle", detections:[], info:"Railway — casque/gilet/..." },
  { id:"ppe_engine",name:"PPE Engine Workers",  icon:"👷", color:"#EF4444", active:false, status:"idle", detections:[], info:"Railway — conformité par personne" },
  { id:"ocr",       name:"OCR Tesseract",       icon:"🔤", color:"#10B981", active:false, status:"idle", detections:[], info:"Railway — texte/plaques" },
];

const SEV_COLOR=(s?:string)=>s==="critical"?"#EF4444":s==="warning"?"#F59E0B":"#10B981";

export default function DiagnosticPage() {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream|null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);
  const allDetsRef= useRef<Detection[]>([]);
  const allWorkRef= useRef<Worker[]>([]);
  const intervalRef= useRef<NodeJS.Timeout|null>(null);

  const [streaming, setStreaming] = useState(false);
  const [facing,    setFacing]    = useState<"user"|"environment">("environment");
  const [models,    setModels]    = useState<ModelState[]>(INITIAL_MODELS);
  const [sector,    setSector]    = useState("construction");
  const [logs,      setLogs]      = useState<{time:string;msg:string;type:"ok"|"err"|"info"|"warn"}[]>([]);
  const [railway,   setRailway]   = useState<any>(null);
  const [firebase,  setFirebase]  = useState<"ok"|"error"|"loading">("loading");
  const [roboflow,  setRoboflow]  = useState<"ok"|"error"|"loading">("loading");
  const [ppeStatus, setPpeStatus] = useState<any>(null);
  const [camLog,    setCamLog]    = useState("▶ Démarrer");

  function addLog(msg:string, type:"ok"|"err"|"info"|"warn"="info") {
    const time = new Date().toLocaleTimeString("fr-CA");
    setLogs(prev=>[{time,msg,type},...prev].slice(0,100));
  }

  // ── Canvas continu ────────────────────────────────────────────────────────
  useEffect(()=>{
    const canvas=canvasRef.current; const video=videoRef.current;
    if(!canvas||!video) return;
    function draw(){
      const ctx=canvas!.getContext("2d"); if(!ctx||!video){animRef.current=requestAnimationFrame(draw);return;}
      canvas!.width=video.clientWidth||320; canvas!.height=video.clientHeight||240;
      ctx.clearRect(0,0,canvas!.width,canvas!.height);
      const sx=canvas!.width/(video.videoWidth||canvas!.width);
      const sy=canvas!.height/(video.videoHeight||canvas!.height);
      // Workers PPE
      for(const w of allWorkRef.current){
        if(!w.bbox?.length) continue;
        const [x1,y1,x2,y2]=w.bbox;
        ctx.strokeStyle=w.color; ctx.lineWidth=3;
        ctx.strokeRect(x1*sx,y1*sy,(x2-x1)*sx,(y2-y1)*sy);
        ctx.fillStyle=w.color+"CC"; ctx.fillRect(x1*sx,y1*sy-24,(x2-x1)*sx,24);
        ctx.fillStyle="#FFF"; ctx.font="bold 12px sans-serif";
        ctx.fillText(`👷#${w.worker_id} ${w.score}% ${w.compliant?"✅":"❌"}`,x1*sx+4,y1*sy-6);
        for(const e of w.epi_present??[]){
          if(!e.bbox?.length) continue;
          const [a,b,c,d]=e.bbox;
          ctx.strokeStyle="#10B981"; ctx.lineWidth=2; ctx.strokeRect(a*sx,b*sy,(c-a)*sx,(d-b)*sy);
          ctx.fillStyle="#10B981CC"; ctx.fillRect(a*sx,b*sy-16,(c-a)*sx,16);
          ctx.fillStyle="#FFF"; ctx.font="10px sans-serif"; ctx.fillText(`✅ ${e.label}`,a*sx+2,b*sy-4);
        }
        for(const ab of w.epi_absent??[]){
          if(!ab.bbox?.length) continue;
          const [a,b,c,d]=ab.bbox;
          ctx.strokeStyle="#EF4444"; ctx.lineWidth=3; ctx.setLineDash([5,3]);
          ctx.strokeRect(a*sx,b*sy,(c-a)*sx,(d-b)*sy); ctx.setLineDash([]);
          ctx.fillStyle="#EF4444CC"; ctx.fillRect(a*sx,b*sy-16,(c-a)*sx,16);
          ctx.fillStyle="#FFF"; ctx.font="bold 10px sans-serif"; ctx.fillText(`🚨 ${ab.label}`,a*sx+2,b*sy-4);
        }
      }
      // Détections générales
      for(const det of allDetsRef.current){
        if(!det.bbox?.length) continue;
        const [x1,y1,x2,y2]=det.bbox;
        const col=det.color||SEV_COLOR(det.severity);
        ctx.strokeStyle=col; ctx.lineWidth=2; ctx.strokeRect(x1*sx,y1*sy,(x2-x1)*sx,(y2-y1)*sy);
        ctx.fillStyle=col+"CC"; ctx.fillRect(x1*sx,y1*sy-18,(x2-x1)*sx,18);
        ctx.fillStyle="#FFF"; ctx.font="11px sans-serif";
        ctx.fillText(`${det.icon||""}${det.label} ${Math.round(det.score*100)}%`,x1*sx+3,y1*sy-4);
      }
      animRef.current=requestAnimationFrame(draw);
    }
    animRef.current=requestAnimationFrame(draw);
    return()=>cancelAnimationFrame(animRef.current);
  },[]);

  // ── Capture ──────────────────────────────────────────────────────────────
  const capture=useCallback(():string|null=>{
    const v=videoRef.current; if(!v||!v.videoWidth) return null;
    const c=document.createElement("canvas"); c.width=640; c.height=480;
    c.getContext("2d")?.drawImage(v,0,0,640,480);
    return c.toDataURL("image/jpeg",0.75).split(",")[1];
  },[]);

  // ── Run model ─────────────────────────────────────────────────────────────
  const runModel=useCallback(async(modelId:string)=>{
    const frame=capture(); if(!frame) return;
    setModels(p=>p.map(m=>m.id===modelId?{...m,status:"loading"}:m));
    const t0=Date.now();
    try{
      let dets:Detection[]=[]; let workers:Worker[]=[]; let nc=0; let classes:string[]=[];
      if(modelId==="coco"){
        const tf=await import("@tensorflow/tfjs");
        const cs=await import("@tensorflow-models/coco-ssd");
        await tf.ready(); const mdl=await cs.load();
        const preds=await mdl.detect(videoRef.current!);
        dets=preds.map(p=>({class:p.class,label:p.class,score:p.score,bbox:[p.bbox[0],p.bbox[1],p.bbox[0]+p.bbox[2],p.bbox[1]+p.bbox[3]],color:"#3B82F6",icon:"🌐",severity:"info"}));
        nc=80; classes=["person","car","truck","..."];
      } else if(modelId==="yolo"){
        const r=await fetch(`${SERVER}/detect`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image:frame,module_id:sector,confidence:0.40}),signal:AbortSignal.timeout(10000)});
        const d=await r.json(); dets=d.detections??[];
      } else if(modelId==="ppe"||modelId==="ppe_engine"){
        const r=await fetch(`${SERVER}/detect/ppe`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image:frame,sector,confidence:0.35,organization_id:"",camera_id:"test"}),signal:AbortSignal.timeout(12000)});
        const d=await r.json();
        dets=d.detections??[];
        if(modelId==="ppe_engine"){workers=d.workers??[];}
        // Sync détections sur canvas
        if(modelId==="ppe_engine") allWorkRef.current=workers;
      } else if(modelId==="ocr"){
        const r=await fetch(`${SERVER}/ocr/analyze`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image:frame}),signal:AbortSignal.timeout(15000)});
        const d=await r.json();
        dets=(d.results??[]).map((o:any)=>({class:"text",label:o.text||"Texte",score:o.confidence??0.9,icon:"🔤",color:"#10B981"}));
      }
      const lat=Date.now()-t0;
      // Merge détections sur canvas
      if(modelId!=="ppe_engine") allDetsRef.current=[...allDetsRef.current.filter(d=>d.class!=="worker"),...dets];
      setModels(p=>p.map(m=>m.id===modelId?{...m,status:"ok",detections:dets,workers,latency:lat,nc,classes}:m));
      addLog(`${modelId}: ${dets.length} détection(s) ${workers.length?`| ${workers.length} travailleur(s)`:""} — ${lat}ms`,"ok");
    }catch(e:any){
      setModels(p=>p.map(m=>m.id===modelId?{...m,status:"error",error:e.message,latency:Date.now()-t0}:m));
      addLog(`${modelId}: ${e.message}`,"err");
    }
  },[capture, sector]);

  // ── Active models loop ────────────────────────────────────────────────────
  useEffect(()=>{
    if(intervalRef.current) clearInterval(intervalRef.current);
    const active=models.filter(m=>m.active);
    if(!streaming||!active.length) return;
    intervalRef.current=setInterval(()=>{
      active.forEach(m=>runModel(m.id));
    },2500);
    return()=>{if(intervalRef.current) clearInterval(intervalRef.current);};
  },[models,streaming,runModel]);

  // ── Toggle model ──────────────────────────────────────────────────────────
  function toggleModel(id:string){
    setModels(p=>p.map(m=>{
      if(m.id!==id) return m;
      const nowActive=!m.active;
      if(nowActive){
        addLog(`▶ ${m.name} activé`,"info");
        // Run immédiatement
        setTimeout(()=>runModel(id),100);
      } else {
        addLog(`⏹ ${m.name} désactivé`,"warn");
        if(id==="ppe_engine") allWorkRef.current=[];
        allDetsRef.current=allDetsRef.current.filter(d=>d.class==="worker");
      }
      return {...m,active:nowActive,status:nowActive?"loading":"idle",detections:[],workers:[]};
    }));
  }

  // ── Caméra ────────────────────────────────────────────────────────────────
  async function startCam(face:"user"|"environment"=facing){
    streamRef.current?.getTracks().forEach(t=>t.stop());
    try{
      let stream:MediaStream;
      try{ stream=await navigator.mediaDevices.getUserMedia({video:face==="environment"?{facingMode:{exact:"environment"},width:{ideal:1280},height:{ideal:720}}:{facingMode:"user"},audio:false}); }
      catch{ stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:face},audio:false}); }
      streamRef.current=stream;
      if(videoRef.current){videoRef.current.srcObject=stream;await videoRef.current.play().catch(()=>{});}
      setStreaming(true); setFacing(face);
      setCamLog(`✅ Caméra ${face==="environment"?"arrière":"avant"} active`);
      addLog(`📷 Caméra ${face==="environment"?"arrière":"avant"} démarrée`,"ok");
    }catch(e:any){setCamLog(`❌ ${e.message}`); addLog(`❌ Caméra: ${e.message}`,"err");}
  }

  function stopCam(){
    streamRef.current?.getTracks().forEach(t=>t.stop());
    if(videoRef.current) videoRef.current.srcObject=null;
    setStreaming(false); setModels(p=>p.map(m=>({...m,active:false,status:"idle",detections:[],workers:[]})));
    allDetsRef.current=[]; allWorkRef.current=[];
    setCamLog("Caméra arrêtée"); addLog("⏹ Caméra arrêtée","warn");
  }

  // ── Status Railway + Firebase + PPE ──────────────────────────────────────
  async function fetchStatus(){
    try{
      const r=await fetch(`${SERVER}/health`,{signal:AbortSignal.timeout(5000),cache:"no-store"});
      const d=await r.json(); setRailway(d); addLog(`Railway v${d.version} ✅`,"ok");
    }catch(e:any){ setRailway({error:e.message}); addLog(`Railway offline: ${e.message}`,"err"); }

    try{
      const r=await fetch(`${SERVER}/detect/ppe/status`,{signal:AbortSignal.timeout(5000),cache:"no-store"});
      const d=await r.json(); setPpeStatus(d);
      addLog(`PPE: ${d.loaded?"✅ loaded":"❌ not loaded"} | ${d.nc||"?"} classes | ${d.mode||"?"}`,"ok");
    }catch{}

    // Firebase check via /api/debug
    try{
      const r=await fetch("/api/debug",{signal:AbortSignal.timeout(5000),cache:"no-store"});
      const d=await r.json();
      setFirebase(d.firebase_ok?"ok":"error");
      addLog(`Firebase: ${d.firebase_ok?"✅ OK":"❌ "+d.missing?.join(",")||"error"}`,"ok");
    }catch(){ setFirebase("error"); }

    // Roboflow check
    try{
      const r=await fetch(`${SERVER}/ppe/train-status`,{signal:AbortSignal.timeout(5000),cache:"no-store"});
      const d=await r.json();
      setRoboflow(d.roboflow_key?"ok":"error");
      addLog(`Roboflow: ${d.roboflow_key?"✅ clé OK":"❌ clé manquante"}`,"ok");
    }catch(){ setRoboflow("error"); }
  }

  useEffect(()=>{fetchStatus(); const iv=setInterval(fetchStatus,20000); return()=>clearInterval(iv);},[]);
  useEffect(()=>{return()=>{ streamRef.current?.getTracks().forEach(t=>t.stop()); cancelAnimationFrame(animRef.current); if(intervalRef.current) clearInterval(intervalRef.current); };},[]);

  const activeModels=models.filter(m=>m.active);
  const totalDets=models.reduce((a,m)=>a+m.detections.length,0);

  return (
    <div className="space-y-4 pb-10">
      <div>
        <h1 className="text-xl font-bold text-white">🔬 Diagnostic IA Live</h1>
        <p className="text-xs text-slate-400 mt-0.5">Activez chaque modèle pour le voir détecter en temps réel sur la caméra</p>
      </div>

      {/* ── Statut plateforme ── */}
      <div className="grid grid-cols-2 gap-2">
        {[
          {label:"Railway", val:railway?.error?"❌ Offline":`✅ v${railway?.version||"..."}`, ok:!railway?.error},
          {label:"Firebase", val:firebase==="ok"?"✅ Connecté":firebase==="loading"?"⏳...":"❌ Erreur", ok:firebase==="ok"},
          {label:"PPE Modèle", val:ppeStatus?.loaded?`✅ ${ppeStatus.nc||"?"} classes`:"❌ Non chargé", ok:ppeStatus?.loaded},
          {label:"Roboflow", val:roboflow==="ok"?"✅ Clé OK":roboflow==="loading"?"⏳...":"❌ Manquante", ok:roboflow==="ok"},
        ].map(s=>(
          <div key={s.label} className={`rounded-xl border px-3 py-2.5 flex items-center gap-2 ${s.ok?"border-emerald-800/40 bg-emerald-900/10":"border-red-800/40 bg-red-900/10"}`}>
            <span className={`h-2 w-2 rounded-full shrink-0 ${s.ok?"bg-emerald-400":"bg-red-500"}`}/>
            <div>
              <p className="text-xs text-slate-400">{s.label}</p>
              <p className="text-xs font-bold text-white">{s.val}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Caméra ── */}
      <div className="relative aspect-video rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover"/>
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none"/>

        {streaming && (
          <>
            <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/80 px-3 py-1">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500"/>
              <span className="text-xs text-white font-medium">LIVE · {facing==="environment"?"📷 Arrière":"🤳 Avant"}</span>
            </div>
            {activeModels.length>0 && (
              <div className="absolute top-3 right-3 space-y-1">
                {activeModels.map(m=>(
                  <div key={m.id} className="flex items-center gap-1.5 rounded-full bg-black/80 px-2.5 py-1">
                    {m.status==="loading"?<span className="h-2 w-2 animate-spin rounded-full border border-white border-t-transparent"/>:<span className="h-2 w-2 rounded-full" style={{background:m.color}}/>}
                    <span className="text-xs text-white">{m.icon} {m.detections.length}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="absolute bottom-3 right-3 rounded-lg bg-black/70 px-2.5 py-1.5 text-xs">
              <span className="text-white">{totalDets} détection(s) total</span>
            </div>
          </>
        )}

        {!streaming && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <span className="text-4xl">📷</span>
            <p className="text-sm text-slate-400">Démarrez la caméra</p>
          </div>
        )}
      </div>

      {/* ── Boutons caméra ── */}
      <div className="grid grid-cols-2 gap-2">
        {!streaming
          ? <button onClick={()=>startCam()} className="col-span-2 rounded-xl bg-brand py-3 text-sm font-bold text-white">▶ Démarrer la caméra</button>
          : <button onClick={stopCam} className="rounded-xl border border-red-700 bg-red-900/20 py-3 text-sm font-bold text-red-400">⏹ Arrêter</button>
        }
        <button onClick={()=>{const n=facing==="environment"?"user":"environment"; setFacing(n); if(streaming) startCam(n);}}
          className="rounded-xl border border-slate-700 bg-slate-800 py-3 text-sm font-bold text-white">
          {facing==="environment"?"🤳 Vue avant":"📷 Vue arrière"}
        </button>
        <button onClick={fetchStatus} className="rounded-xl border border-slate-700 bg-slate-800 py-3 text-sm font-bold text-slate-300">
          🔄 Refresh Status
        </button>
        <div className="col-span-2">
          <select value={sector} onChange={e=>setSector(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white">
            {[["construction","🏗️ Construction Safety"],["industrial","🏭 Industrial Safety"],["home_security","🏠 Home Security"],["retail","🛒 Retail Intelligence"],["transportation","🚗 TrafficGuard"],["agriculture","🌾 AgriGuard"],["smart_city","🌆 Smart City"],["defense","🛡️ Defense Shield"]].map(([v,l])=>
              <option key={v} value={v}>{l}</option>
            )}
          </select>
        </div>
      </div>

      {/* ── Log caméra ── */}
      <div className={`rounded-xl border px-4 py-2.5 text-xs font-mono ${camLog.startsWith("✅")?"border-emerald-800 bg-emerald-900/10 text-emerald-400":camLog.startsWith("❌")?"border-red-800 bg-red-900/10 text-red-400":"border-slate-800 bg-slate-900 text-slate-400"}`}>
        {camLog}
      </div>

      {/* ── MODÈLES — ACTIVATION ── */}
      <div>
        <h2 className="text-sm font-bold text-slate-300 mb-3">🤖 MODÈLES IA — Cliquez pour activer sur la caméra</h2>
        <div className="space-y-3">
          {models.map(model=>(
            <div key={model.id} className={`rounded-xl border overflow-hidden transition-all ${model.active?`border-[${model.color}]/50 bg-[${model.color}]/5`:"border-slate-800 bg-slate-900"}`}
              style={model.active?{borderColor:model.color+"60",background:model.color+"08"}:{}}>

              {/* Header — bouton activation */}
              <button onClick={()=>toggleModel(model.id)} disabled={!streaming}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/5 transition-colors disabled:opacity-50">

                {/* Status indicator */}
                <div className="relative shrink-0">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl transition-all ${model.active?"shadow-lg":"opacity-60"}`}
                    style={model.active?{background:model.color+"25",boxShadow:`0 0 20px ${model.color}40`}:{background:"#1E293B"}}>
                    {model.icon}
                  </div>
                  {model.active && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full border-2 border-slate-900 flex items-center justify-center"
                      style={{background:model.color}}>
                      {model.status==="loading"
                        ? <span className="h-2 w-2 animate-spin rounded-full border border-white border-t-transparent"/>
                        : <span className="text-[8px] text-white font-bold">ON</span>}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-white">{model.name}</p>
                    {model.active && model.status==="ok" && (
                      <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{background:model.color+"30",color:model.color}}>
                        {model.detections.length} det{model.workers?.length?` · ${model.workers.length} workers`:""}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{model.info}</p>
                  {model.active && model.latency && <p className="text-xs text-slate-600 mt-0.5">{model.latency}ms · auto toutes les 2.5s</p>}
                  {model.error && <p className="text-xs text-red-400 mt-0.5 truncate">❌ {model.error}</p>}
                </div>

                {/* Toggle visuel */}
                <div className={`shrink-0 flex h-8 w-14 items-center rounded-full border-2 transition-all px-1 ${model.active?"border-transparent":"border-slate-700"}`}
                  style={model.active?{background:model.color}:{background:"#1E293B"}}>
                  <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${model.active?"translate-x-6":"translate-x-0"}`}/>
                </div>
              </button>

              {/* Détections ── */}
              {model.active && model.status==="ok" && model.detections.length>0 && (
                <div className="border-t border-slate-800 p-3 space-y-1.5">
                  {model.detections.slice(0,8).map((det,i)=>(
                    <div key={i} className="flex items-center gap-2.5 rounded-lg bg-slate-950/80 px-3 py-2">
                      <span className="text-lg shrink-0">{det.icon||"📦"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{det.label}</p>
                        <p className="text-xs text-slate-500">{det.class}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-bold" style={{color:det.color||SEV_COLOR(det.severity)}}>
                          {Math.round(det.score*100)}%
                        </span>
                        <div className="h-1.5 w-12 rounded-full bg-slate-800 overflow-hidden">
                          <div className="h-full rounded-full" style={{width:`${det.score*100}%`,background:det.color||model.color}}/>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Workers PPE */}
                  {model.workers && model.workers.length>0 && (
                    <div className="mt-2 space-y-1.5">
                      {model.workers.map((w,i)=>(
                        <div key={i} className={`rounded-xl border p-3 ${w.compliant?"border-emerald-800/40 bg-emerald-900/10":"border-red-800/40 bg-red-900/10"}`}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-white">👷 Travailleur #{w.worker_id}</span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${w.compliant?"text-emerald-400":"text-red-400"}`}>
                              {w.score}% {w.compliant?"✅":"❌"}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {w.epi_present?.map((e:any,j:number)=><span key={j} className="rounded-full bg-emerald-900/40 border border-emerald-800/40 px-1.5 py-0.5 text-xs text-emerald-400">✅ {e.label}</span>)}
                            {w.epi_absent?.map((a:any,j:number)=><span key={j} className="rounded-full bg-red-900/40 border border-red-800/40 px-1.5 py-0.5 text-xs text-red-400">🚨 {a.label}</span>)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── PPE Classes disponibles ── */}
      {ppeStatus?.classes && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h3 className="text-xs font-bold text-slate-400 mb-3">⛑️ CLASSES PPE ACTIVES ({ppeStatus.nc})</h3>
          <div className="flex flex-wrap gap-1.5">
            {ppeStatus.classes.map((cls:string)=>(
              <span key={cls} className={`rounded-full border px-2.5 py-1 text-xs font-medium ${cls.startsWith("no")?"border-red-800/40 bg-red-900/10 text-red-400":"border-emerald-800/40 bg-emerald-900/10 text-emerald-400"}`}>
                {cls.startsWith("no")?"🚨":"✅"} {cls}
              </span>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">Modèle: {ppeStatus.model_path} · Mode: {ppeStatus.mode}</p>
        </div>
      )}

      {/* ── Logs temps réel ── */}
      <div className="rounded-xl border border-slate-800 bg-black overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5">
          <h3 className="text-xs font-bold text-slate-400">📋 LOGS TEMPS RÉEL ({logs.length})</h3>
          <button onClick={()=>setLogs([])} className="text-xs text-slate-600 hover:text-red-400">Effacer</button>
        </div>
        <div className="p-3 font-mono text-xs space-y-0.5 max-h-64 overflow-y-auto">
          {logs.length===0
            ? <p className="text-slate-600">Les logs apparaissent ici dès que vous activez un modèle...</p>
            : logs.map((l,i)=>(
              <p key={i} className={l.type==="ok"?"text-emerald-400":l.type==="err"?"text-red-400":l.type==="warn"?"text-amber-400":"text-slate-400"}>
                <span className="text-slate-600">{l.time} </span>{l.msg}
              </p>
            ))
          }
        </div>
      </div>
    </div>
  );
}
