"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  normFromCoco, normFromCapture, toCanvas, drawBox,
  applyNMS, confirmDetection, cleanupFrameHistory,
  CAPTURE_W, CAPTURE_H,
  type NormalizedDetection
} from "@/lib/detection/detectionPipeline";

const SERVER = process.env.NEXT_PUBLIC_AI_SERVER_URL ?? "https://guard-vision-ai-production.up.railway.app";

type ModelState = {
  id:"coco"|"yolo"|"ppe"|"ppe_engine"|"ocr";
  name:string; icon:string; color:string;
  active:boolean; status:"idle"|"loading"|"ok"|"error";
  detections:NormalizedDetection[]; workers:any[];
  latency?:number; error?:string;
};

const INITIAL:ModelState[] = [
  {id:"coco",       name:"COCO-SSD",          icon:"🌐",color:"#3B82F6",active:false,status:"idle",detections:[],workers:[]},
  {id:"yolo",       name:"YOLOv11 ONNX",       icon:"⚡",color:"#8B5CF6",active:false,status:"idle",detections:[],workers:[]},
  {id:"ppe",        name:"PPE Detector",        icon:"⛑️",color:"#F59E0B",active:false,status:"idle",detections:[],workers:[]},
  {id:"ppe_engine", name:"PPE Engine Workers",  icon:"👷",color:"#EF4444",active:false,status:"idle",detections:[],workers:[]},
  {id:"ocr",        name:"OCR Tesseract",       icon:"🔤",color:"#10B981",active:false,status:"idle",detections:[],workers:[]},
];

export default function DiagnosticPage() {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const streamRef  = useRef<MediaStream|null>(null);
  const animRef    = useRef<number>(0);
  const intervalRef= useRef<NodeJS.Timeout|null>(null);

  // Toutes les détections consolidées (source of truth pour le canvas)
  const allDetsRef  = useRef<NormalizedDetection[]>([]);
  const allWorkersRef= useRef<any[]>([]);

  const [streaming, setStreaming] = useState(false);
  const [facing,    setFacing]    = useState<"user"|"environment">("environment");
  const [models,    setModels]    = useState<ModelState[]>(INITIAL);
  const [sector,    setSector]    = useState("construction");
  const [logs,      setLogs]      = useState<{time:string;msg:string;type:string}[]>([]);
  const [railway,   setRailway]   = useState<any>(null);
  const [ppeStatus, setPpeStatus] = useState<any>(null);
  const [camLog,    setCamLog]    = useState("▶ Démarrer");
  const [debugMode, setDebugMode] = useState(false);

  function addLog(msg:string,type="info"){
    setLogs(p=>[{time:new Date().toLocaleTimeString("fr-CA"),msg,type},...p].slice(0,80));
  }

  // ── Canvas RAF — pipeline d'affichage unifié ───────────────────────────────
  useEffect(()=>{
    const canvas=canvasRef.current;
    const video =videoRef.current;
    if(!canvas||!video) return;

    function render(){
      const ctx=canvas!.getContext("2d");
      if(!ctx||!video){animRef.current=requestAnimationFrame(render);return;}

      // Taille canvas = taille affichée CSS (pas videoWidth!)
      const cW=video.clientWidth||canvas!.offsetWidth||320;
      const cH=video.clientHeight||canvas!.offsetHeight||180;
      if(canvas!.width!==cW || canvas!.height!==cH){
        canvas!.width=cW; canvas!.height=cH;
      }
      ctx.clearRect(0,0,cW,cH);

      // ── Dessiner workers PPE ──
      for(const w of allWorkersRef.current){
        if(!w.bbox_norm?.length) continue;
        const [x1,y1,x2,y2]=toCanvas(w.bbox_norm,cW,cH);
        const col=w.compliant?"#10B981":"#EF4444";

        // Box principale travailleur
        ctx.strokeStyle=col; ctx.lineWidth=3;
        ctx.strokeRect(x1,y1,x2-x1,y2-y1);
        ctx.fillStyle=col+"CC"; ctx.fillRect(x1,y1-26,x2-x1,26);
        ctx.fillStyle="#FFF"; ctx.font="bold 13px sans-serif";
        ctx.fillText(`👷 #${w.worker_id}  ${w.score}%  ${w.compliant?"✅":"❌"}`,x1+4,y1-7,x2-x1);

        // EPI présents — vert
        for(const e of w.epi_present??[]){
          if(!e.bbox_norm?.length) continue;
          const b=toCanvas(e.bbox_norm,cW,cH);
          drawBox(ctx,b,`✅ ${e.label}`,"#10B981",{lineWidth:2,fontSize:10});
        }
        // EPI absents — rouge pointillé
        for(const ab of w.epi_absent??[]){
          if(!ab.bbox_norm?.length) continue;
          const b=toCanvas(ab.bbox_norm,cW,cH);
          drawBox(ctx,b,`🚨 ${ab.label}`,"#EF4444",{lineWidth:3,dashed:true,fontSize:10});
        }
      }

      // ── Dessiner détections générales ──
      for(const det of allDetsRef.current){
        if(!det.bbox_norm?.length) continue;
        if(!det.confirmed && !debugMode) continue; // Pas encore confirmé
        const b=toCanvas(det.bbox_norm,cW,cH);
        const label=`${det.icon||""} ${det.label} ${Math.round(det.score*100)}%`;
        drawBox(ctx,b,label,det.color,{lineWidth:det.severity==="critical"?3:2});

        // Mode debug: afficher coords brutes
        if(debugMode){
          ctx.fillStyle="#FFFFFF88"; ctx.font="9px monospace";
          ctx.fillText(`[${det.bbox_norm.map(v=>v.toFixed(2)).join(",")}]`,b[0],b[3]+10);
          ctx.fillText(`src:${det.source}`,b[0],b[3]+20);
        }
      }

      // Compteur
      const n=allDetsRef.current.filter(d=>d.confirmed).length + allWorkersRef.current.length;
      if(n>0){
        ctx.fillStyle="#000000AA"; ctx.fillRect(cW-100,cH-28,100,28);
        ctx.fillStyle="#FFF"; ctx.font="bold 12px sans-serif";
        ctx.fillText(`${n} détection(s)`,cW-96,cH-9);
      }

      animRef.current=requestAnimationFrame(render);
    }

    animRef.current=requestAnimationFrame(render);
    return()=>cancelAnimationFrame(animRef.current);
  },[debugMode]);

  // ── Capture frame à CAPTURE_W x CAPTURE_H ─────────────────────────────────
  const captureFrame=useCallback(():string|null=>{
    const v=videoRef.current; if(!v||!v.videoWidth) return null;
    const c=document.createElement("canvas");
    c.width=CAPTURE_W; c.height=CAPTURE_H;
    c.getContext("2d")?.drawImage(v,0,0,CAPTURE_W,CAPTURE_H);
    return c.toDataURL("image/jpeg",0.8).split(",")[1];
  },[]);

  // ── Run un modèle ──────────────────────────────────────────────────────────
  const runModel=useCallback(async(modelId:string)=>{
    const v=videoRef.current; if(!v) return;
    const frame=captureFrame();
    if(!frame && modelId!=="coco") return;
    setModels(p=>p.map(m=>m.id===modelId?{...m,status:"loading"}:m));
    const t0=Date.now();

    try{
      let newDets:NormalizedDetection[]=[]; let workers:any[]=[];

      if(modelId==="coco"){
        // COCO-SSD: coordonnées dans videoWidth x videoHeight
        const tf=await import("@tensorflow/tfjs");
        const cs=await import("@tensorflow-models/coco-ssd");
        await tf.ready();
        const mdl=await cs.load();
        const preds=await mdl.detect(v);
        const vW=v.videoWidth, vH=v.videoHeight;
        newDets=preds.map((p,i)=>{
          const raw:[number,number,number,number]=[p.bbox[0],p.bbox[1],p.bbox[0]+p.bbox[2],p.bbox[1]+p.bbox[3]];
          const norm=normFromCoco(raw,vW,vH);
          const {confirmed,frames}=confirmDetection(p.class,p.score);
          return {id:`coco_${i}`,class:p.class,label:p.class,icon:"🌐",color:"#3B82F6",severity:"info" as const,score:p.score,bbox_norm:norm,source:"coco" as const,frame_count:frames,confirmed,alert:false};
        });

      } else if(modelId==="yolo"){
        const r=await fetch(`${SERVER}/detect`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image:frame,module_id:sector,confidence:0.45}),signal:AbortSignal.timeout(10000)});
        const d=await r.json();
        newDets=(d.detections??[]).filter((det:any)=>det.score>=0.45).map((det:any,i:number)=>{
          const raw=det.bbox?.length===4?det.bbox:[0,0,0,0];
          const norm=normFromCapture(raw);
          const {confirmed,frames}=confirmDetection(det.class,det.score);
          return {id:`yolo_${i}`,class:det.class,label:det.label||det.class,icon:det.icon||"📦",color:det.color||"#8B5CF6",severity:(det.severity||"info") as any,score:det.score,bbox_norm:norm,source:"yolo" as const,frame_count:frames,confirmed,alert:!!det.alert};
        });

      } else if(modelId==="ppe"||modelId==="ppe_engine"){
        const r=await fetch(`${SERVER}/detect/ppe`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image:frame,sector,confidence:0.35,organization_id:"",camera_id:"diag"}),signal:AbortSignal.timeout(12000)});
        const d=await r.json();
        newDets=(d.detections??[]).map((det:any,i:number)=>{
          const raw=det.bbox?.length===4?det.bbox:[0,0,0,0];
          const norm=normFromCapture(raw);
          const {confirmed,frames}=confirmDetection(det.class,det.score);
          return {id:`ppe_${i}`,class:det.class,label:det.label||det.class,icon:det.icon||"⛑️",color:det.color||(det.alert?"#EF4444":"#10B981"),severity:(det.severity||"info") as any,score:det.score,bbox_norm:norm,source:"ppe" as const,frame_count:frames,confirmed,alert:!!det.alert};
        });

        if(modelId==="ppe_engine"){
          // Normaliser bbox des workers aussi
          workers=(d.workers??[]).map((w:any)=>({
            ...w,
            bbox_norm: w.bbox?.length===4 ? normFromCapture(w.bbox) : null,
            epi_present:(w.epi_present??[]).map((e:any)=>({...e, bbox_norm:e.bbox?.length===4?normFromCapture(e.bbox):null})),
            epi_absent: (w.epi_absent??[]).map((a:any)=>({...a,  bbox_norm:a.bbox?.length===4?normFromCapture(a.bbox):null})),
          }));
          allWorkersRef.current=workers;
        }

      } else if(modelId==="ocr"){
        const r=await fetch(`${SERVER}/ocr/analyze`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image:frame}),signal:AbortSignal.timeout(15000)});
        const d=await r.json();
        newDets=(d.results??[]).map((o:any,i:number)=>({id:`ocr_${i}`,class:"text",label:o.text||"Texte",icon:"🔤",color:"#10B981",severity:"info" as const,score:o.confidence??0.9,bbox_norm:[0,0,0,0] as [number,number,number,number],source:"ppe" as const,frame_count:1,confirmed:true,alert:false}));
      }

      // NMS: enlever les boxes qui se chevauchent trop
      const afterNMS=applyNMS(newDets,0.45);

      // Cleanup frame history des classes inactives
      cleanupFrameHistory(new Set(afterNMS.map(d=>d.class)));

      // Merge avec les autres modèles actifs (garder leurs détections)
      allDetsRef.current=[
        ...allDetsRef.current.filter(d=>d.source!==modelId as any),
        ...afterNMS
      ];

      setModels(p=>p.map(m=>m.id===modelId?{...m,status:"ok",detections:afterNMS,workers,latency:Date.now()-t0}:m));
      addLog(`${modelId}: ${afterNMS.length}/${newDets.length} det (NMS) ${workers.length?`| ${workers.length} workers`:""}  — ${Date.now()-t0}ms`,"ok");

    } catch(e:any){
      setModels(p=>p.map(m=>m.id===modelId?{...m,status:"error",error:e.message,latency:Date.now()-t0}:m));
      addLog(`${modelId}: ${e.message}`,"err");
    }
  },[captureFrame,sector]);

  // ── Loop auto pour modèles actifs ─────────────────────────────────────────
  useEffect(()=>{
    if(intervalRef.current) clearInterval(intervalRef.current);
    const active=models.filter(m=>m.active);
    if(!streaming||!active.length) return;
    // Décaler les modèles pour éviter les conflits
    active.forEach((m,i)=>{
      setTimeout(()=>{
        runModel(m.id);
        const iv=setInterval(()=>runModel(m.id),3000);
        (intervalRef as any)[m.id]=iv;
      },i*800);
    });
    return()=>{
      active.forEach(m=>{
        if((intervalRef as any)[m.id]) clearInterval((intervalRef as any)[m.id]);
      });
    };
  },[models.map(m=>m.active).join(","), streaming]);

  // ── Toggle modèle ──────────────────────────────────────────────────────────
  function toggleModel(id:string){
    setModels(p=>p.map(m=>{
      if(m.id!==id) return m;
      const on=!m.active;
      if(on){ addLog(`▶ ${m.name} ON`,"info"); setTimeout(()=>runModel(id),100); }
      else {
        addLog(`⏹ ${m.name} OFF`,"warn");
        if(id==="ppe_engine") allWorkersRef.current=[];
        allDetsRef.current=allDetsRef.current.filter(d=>d.source!==id as any);
      }
      return {...m,active:on,status:on?"loading":"idle",detections:[],workers:[]};
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
      setCamLog(`✅ ${face==="environment"?"Arrière":"Avant"} active`);
      addLog(`📷 Caméra ${face==="environment"?"arrière":"avant"} démarrée`,"ok");
    }catch(e:any){setCamLog(`❌ ${e.message}`); addLog(`❌ ${e.message}`,"err");}
  }

  function stopCam(){
    streamRef.current?.getTracks().forEach(t=>t.stop());
    if(videoRef.current) videoRef.current.srcObject=null;
    setStreaming(false);
    setModels(p=>p.map(m=>({...m,active:false,status:"idle",detections:[],workers:[]})));
    allDetsRef.current=[]; allWorkersRef.current=[];
    setCamLog("Arrêtée");
  }

  // ── Railway status ─────────────────────────────────────────────────────────
  async function fetchStatus(){
    try{
      const [h,p]=await Promise.all([
        fetch(`${SERVER}/health`,{signal:AbortSignal.timeout(5000),cache:"no-store"}),
        fetch(`${SERVER}/detect/ppe/status`,{signal:AbortSignal.timeout(5000),cache:"no-store"}),
      ]);
      setRailway(await h.json());
      setPpeStatus(await p.json());
    }catch(e:any){ addLog(`Railway: ${e.message}`,"err"); }
  }

  useEffect(()=>{ fetchStatus(); const iv=setInterval(fetchStatus,20000); return()=>clearInterval(iv); },[]);
  useEffect(()=>()=>{ streamRef.current?.getTracks().forEach(t=>t.stop()); cancelAnimationFrame(animRef.current); },[]);

  const totalDets=models.reduce((a,m)=>a+m.detections.length,0);
  const totalWorkers=models.reduce((a,m)=>a+m.workers.length,0);

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">🔬 Diagnostic IA</h1>
          <p className="text-xs text-slate-400">Activez chaque modèle · Pipeline unifié · Coordonnées normalisées</p>
        </div>
        <button onClick={()=>setDebugMode(!debugMode)}
          className={`rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${debugMode?"border-amber-500 bg-amber-900/20 text-amber-400":"border-slate-700 text-slate-500"}`}>
          🔢 Debug {debugMode?"ON":"OFF"}
        </button>
      </div>

      {/* Status */}
      <div className="grid grid-cols-2 gap-2">
        {[
          {l:"Railway",   v:railway?.error?`❌ Offline`:`✅ v${railway?.version||"..."}`,  ok:!railway?.error},
          {l:"PPE Model", v:ppeStatus?.loaded?`✅ ${ppeStatus.nc} classes`:"❌ Non chargé",ok:ppeStatus?.loaded},
        ].map(s=>(
          <div key={s.l} className={`rounded-xl border px-3 py-2.5 flex items-center gap-2 ${s.ok?"border-emerald-800/40 bg-emerald-900/10":"border-red-800/40 bg-red-900/10"}`}>
            <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${s.ok?"bg-emerald-400":"bg-red-500"}`}/>
            <div><p className="text-xs text-slate-400">{s.l}</p><p className="text-xs font-bold text-white">{s.v}</p></div>
          </div>
        ))}
      </div>

      {/* ── CAMÉRA ── */}
      <div className="relative aspect-video rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover"/>
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none"/>

        {streaming && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-black/80 px-2.5 py-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500"/>
            <span className="text-xs text-white">LIVE · {facing==="environment"?"📷":"🤳"} · {CAPTURE_W}×{CAPTURE_H}</span>
          </div>
        )}

        {/* Indicateurs modèles actifs */}
        {models.filter(m=>m.active).map((m,i)=>(
          <div key={m.id} className="absolute right-2 flex items-center gap-1 rounded-full bg-black/80 px-2 py-0.5" style={{top:`${8+i*28}px`}}>
            {m.status==="loading"?<span className="h-2 w-2 animate-spin rounded-full border border-white border-t-transparent"/>:<span className="h-2 w-2 rounded-full" style={{background:m.color}}/>}
            <span className="text-xs text-white">{m.icon} {m.detections.length}</span>
          </div>
        ))}

        {!streaming && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-slate-500 text-sm">▶ Démarrer la caméra</span>
          </div>
        )}
      </div>

      {/* Boutons caméra */}
      <div className="grid grid-cols-2 gap-2">
        {!streaming
          ? <button onClick={()=>startCam()} className="col-span-2 rounded-xl bg-brand py-3 text-sm font-bold text-white">▶ Démarrer la caméra</button>
          : <button onClick={stopCam} className="rounded-xl border border-red-700 bg-red-900/20 py-3 text-sm font-bold text-red-400">⏹ Arrêter</button>
        }
        <button onClick={()=>{const n=facing==="environment"?"user":"environment"; setFacing(n); if(streaming) startCam(n);}}
          className="rounded-xl border border-slate-700 bg-slate-800 py-3 text-sm font-bold text-white">
          {facing==="environment"?"🤳 Vue avant":"📷 Vue arrière"}
        </button>
        <button onClick={fetchStatus} className="rounded-xl border border-slate-700 bg-slate-800 py-3 text-sm text-slate-300">🔄 Refresh</button>
        <select value={sector} onChange={e=>setSector(e.target.value)}
          className="col-span-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white">
          {[["construction","🏗️ Construction Safety"],["industrial","🏭 Industrial Safety"],["home_security","🏠 Home Security"],["retail","🛒 Retail Intelligence"],["transportation","🚗 TrafficGuard"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className={`rounded-xl border px-4 py-2.5 text-xs font-mono ${camLog.startsWith("✅")?"border-emerald-800 bg-emerald-900/10 text-emerald-400":camLog.startsWith("❌")?"border-red-800 bg-red-900/10 text-red-400":"border-slate-800 bg-slate-900 text-slate-400"}`}>
        {camLog}
        {totalDets>0 && <span className="ml-3 text-amber-400">{totalDets} det · {totalWorkers} workers</span>}
      </div>

      {/* ── MODÈLES ── */}
      <div>
        <h2 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">🤖 Modèles IA — Cliquez pour activer/désactiver</h2>
        <div className="space-y-3">
          {models.map(model=>(
            <div key={model.id} className="rounded-xl border overflow-hidden transition-all"
              style={model.active?{borderColor:model.color+"50",background:model.color+"05"}:{borderColor:"#1E293B",background:"#0F172A"}}>
              <button onClick={()=>toggleModel(model.id)} disabled={!streaming}
                className="w-full flex items-center gap-3 p-4 hover:bg-white/5 transition-colors disabled:opacity-40">
                <div className="relative shrink-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
                    style={model.active?{background:model.color+"25",boxShadow:`0 0 16px ${model.color}50`}:{background:"#1E293B"}}>
                    {model.icon}
                  </div>
                  {model.active && (
                    <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full border-2 border-slate-900 flex items-center justify-center text-white text-[9px] font-bold"
                      style={{background:model.color}}>
                      {model.status==="loading"?"…":"ON"}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">{model.name}</span>
                    {model.active && model.status==="ok" && (
                      <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{background:model.color+"30",color:model.color}}>
                        ✅ {model.detections.length} det{model.workers.length?` · ${model.workers.length}👷`:""}
                      </span>
                    )}
                    {model.status==="error" && <span className="text-xs text-red-400">❌ Erreur</span>}
                  </div>
                  {model.latency && <p className="text-xs text-slate-500 mt-0.5">{model.latency}ms · auto 3s · NMS actif</p>}
                  {model.error && <p className="text-xs text-red-400 mt-0.5 truncate">{model.error}</p>}
                </div>
                {/* Toggle */}
                <div className="shrink-0 flex h-7 w-13 items-center rounded-full px-1 transition-all border"
                  style={model.active?{background:model.color,borderColor:model.color}:{background:"#1E293B",borderColor:"#334155"}}>
                  <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${model.active?"translate-x-6":"translate-x-0"}`}/>
                </div>
              </button>

              {/* Résultats */}
              {model.active && model.status==="ok" && model.detections.length>0 && (
                <div className="border-t border-slate-800 p-3 space-y-1.5 max-h-48 overflow-y-auto">
                  {model.detections.slice(0,6).map((det,i)=>(
                    <div key={i} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${det.severity==="critical"?"bg-red-900/20":det.severity==="warning"?"bg-amber-900/15":"bg-slate-950"}`}>
                      <span className="text-base shrink-0">{det.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{det.label}</p>
                        {debugMode && <p className="text-xs font-mono text-slate-600">norm:[{det.bbox_norm.map(v=>v.toFixed(2)).join(",")}]</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-bold" style={{color:det.color}}>{Math.round(det.score*100)}%</span>
                        {!det.confirmed && <span className="text-xs text-slate-600">({det.frame_count}f)</span>}
                      </div>
                    </div>
                  ))}
                  {model.detections.length>6 && <p className="text-xs text-slate-500 px-3">+{model.detections.length-6} autres...</p>}
                </div>
              )}

              {/* Workers PPE Engine */}
              {model.active && model.id==="ppe_engine" && model.workers.length>0 && (
                <div className="border-t border-slate-800 p-3 space-y-2">
                  {model.workers.map((w,i)=>(
                    <div key={i} className={`rounded-xl border p-3 ${w.compliant?"border-emerald-800/40 bg-emerald-900/10":"border-red-800/40 bg-red-900/10"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-white">👷 Travailleur #{w.worker_id}</span>
                        <span className={`text-xs font-bold ${w.compliant?"text-emerald-400":"text-red-400"}`}>{w.score}% {w.compliant?"✅":"❌"}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800 mb-2"><div className="h-full rounded-full" style={{width:`${w.score}%`,background:w.color}}/></div>
                      <div className="flex flex-wrap gap-1">
                        {(w.epi_present??[]).map((e:any,j:number)=><span key={j} className="rounded-full bg-emerald-900/40 border border-emerald-800/40 px-2 py-0.5 text-xs text-emerald-400">✅ {e.label}</span>)}
                        {(w.epi_absent??[]).map((a:any,j:number)=><span key={j} className="rounded-full bg-red-900/40 border border-red-800/40 px-2 py-0.5 text-xs text-red-400 font-bold">🚨 {a.label}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Classes PPE */}
      {ppeStatus?.classes && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h3 className="text-xs font-bold text-slate-400 mb-3">⛑️ CLASSES PPE ({ppeStatus.nc}) · {ppeStatus.model_path} · {ppeStatus.mode}</h3>
          <div className="flex flex-wrap gap-1.5">
            {ppeStatus.classes.map((cls:string)=>(
              <span key={cls} className={`rounded-full border px-2 py-0.5 text-xs ${cls.startsWith("no")?"border-red-800/40 bg-red-900/10 text-red-400":"border-emerald-800/40 bg-emerald-900/10 text-emerald-400"}`}>
                {cls.startsWith("no")?"🚨":"✅"} {cls}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Logs */}
      <div className="rounded-xl border border-slate-800 bg-black overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5">
          <span className="text-xs font-bold text-slate-400">📋 LOGS ({logs.length})</span>
          <button onClick={()=>setLogs([])} className="text-xs text-slate-600 hover:text-red-400">Effacer</button>
        </div>
        <div className="p-3 font-mono text-xs space-y-0.5 max-h-52 overflow-y-auto">
          {logs.length===0
            ? <p className="text-slate-600">En attente...</p>
            : logs.map((l,i)=>(
              <p key={i} className={l.type==="ok"?"text-emerald-400":l.type==="err"?"text-red-400":l.type==="warn"?"text-amber-400":"text-slate-400"}>
                <span className="text-slate-700">{l.time} </span>{l.msg}
              </p>
            ))
          }
        </div>
      </div>
    </div>
  );
}
