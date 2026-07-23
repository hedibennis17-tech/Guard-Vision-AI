"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const SERVER = process.env.NEXT_PUBLIC_AI_SERVER_URL ?? "https://guard-vision-ai-production.up.railway.app";

// ── Types ────────────────────────────────────────────────────────────────────
interface ModelResult { class:string; label:string; score:number; bbox?:number[]; color?:string; icon?:string; severity?:string; }
interface ModelStatus { id:string; name:string; icon:string; enabled:boolean; status:"idle"|"loading"|"ok"|"error"; results:ModelResult[]; error?:string; latency?:number; }

const MODELS: Omit<ModelStatus,"status"|"results"|"enabled">[] = [
  { id:"coco",     name:"COCO-SSD (navigateur)",          icon:"🌐" },
  { id:"yolo",     name:"YOLOv11 ONNX (Railway)",         icon:"⚡" },
  { id:"ppe",      name:"PPE Detector (Railway)",          icon:"⛑️" },
  { id:"ppe_full", name:"PPE Engine + Workers (Railway)",  icon:"👷" },
  { id:"ocr",      name:"OCR Tesseract (Railway)",         icon:"🔤" },
];

const MODULES = [
  {id:"construction", label:"Construction Safety",  icon:"🏗️"},
  {id:"industrial",   label:"Industrial Safety",    icon:"🏭"},
  {id:"home_security",label:"Home Security",        icon:"🏠"},
  {id:"retail",       label:"Retail Intelligence",  icon:"🛒"},
  {id:"transportation",label:"TrafficGuard",        icon:"🚗"},
  {id:"agriculture",  label:"AgriGuard",            icon:"🌾"},
  {id:"smart_city",   label:"Smart City",           icon:"🌆"},
  {id:"defense",      label:"Defense Shield",       icon:"🛡️"},
];

const SEV_COLOR = (s?:string) => s==="critical"?"#EF4444":s==="warning"?"#F59E0B":s==="info"?"#10B981":"#64748B";

export default function DiagnosticAIPage() {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const streamRef  = useRef<MediaStream|null>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const animRef    = useRef<number>(0);
  const resultsRef = useRef<ModelResult[]>([]);

  const [streaming,  setStreaming]  = useState(false);
  const [facing,     setFacing]     = useState<"user"|"environment">("environment");
  const [recording,  setRecording]  = useState(false);
  const [models,     setModels]     = useState<ModelStatus[]>(
    MODELS.map(m=>({...m, enabled:false, status:"idle", results:[]}))
  );
  const [activeModule, setActiveModule] = useState("construction");
  const [railwayStatus, setRailwayStatus] = useState<any>(null);
  const [railwayLogs,   setRailwayLogs]   = useState<string[]>([]);
  const [allResults,    setAllResults]    = useState<ModelResult[]>([]);
  const [log,           setLog]           = useState("▶ Démarrer la caméra");
  const [autoRun,       setAutoRun]       = useState(false);
  const autoRef = useRef<NodeJS.Timeout|null>(null);

  // ── Caméra ────────────────────────────────────────────────────────────────
  async function startCam(face:"user"|"environment"=facing) {
    streamRef.current?.getTracks().forEach(t=>t.stop());
    try {
      let stream:MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: face==="environment"?{facingMode:{exact:"environment"},width:{ideal:1280},height:{ideal:720}}:{facingMode:"user",width:{ideal:1280},height:{ideal:720}},
          audio:false
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:face},audio:false});
      }
      streamRef.current = stream;
      if (videoRef.current){videoRef.current.srcObject=stream;await videoRef.current.play().catch(()=>{});}
      setStreaming(true); setFacing(face);
      setLog(`✅ Caméra ${face==="environment"?"arrière":"avant"} active`);
    } catch(e:any){setLog(`❌ ${e.message}`);}
  }

  function stopCam(){
    streamRef.current?.getTracks().forEach(t=>t.stop());
    if(videoRef.current) videoRef.current.srcObject=null;
    setStreaming(false); setAutoRun(false);
    setLog("Caméra arrêtée");
  }

  function toggleFacing(){
    const n=facing==="environment"?"user":"environment";
    setFacing(n); if(streaming) startCam(n);
  }

  // ── Canvas overlay ────────────────────────────────────────────────────────
  useEffect(()=>{
    const canvas=canvasRef.current; const video=videoRef.current;
    if(!canvas||!video) return;
    function draw(){
      const ctx=canvas!.getContext("2d"); if(!ctx||!video) {animRef.current=requestAnimationFrame(draw);return;}
      canvas!.width=video.clientWidth; canvas!.height=video.clientHeight;
      ctx.clearRect(0,0,canvas!.width,canvas!.height);
      const sx=canvas!.width/(video.videoWidth||canvas!.width);
      const sy=canvas!.height/(video.videoHeight||canvas!.height);
      for(const det of resultsRef.current){
        if(!det.bbox?.length) continue;
        const [x1,y1,x2,y2]=det.bbox;
        const color=det.color||(det.severity==="critical"?"#EF4444":det.severity==="warning"?"#F59E0B":"#10B981");
        ctx.strokeStyle=color; ctx.lineWidth=2.5;
        ctx.strokeRect(x1*sx,y1*sy,(x2-x1)*sx,(y2-y1)*sy);
        ctx.fillStyle=color+"CC"; ctx.fillRect(x1*sx,y1*sy-20,(x2-x1)*sx,20);
        ctx.fillStyle="#FFF"; ctx.font="bold 11px sans-serif";
        ctx.fillText(`${det.icon||""} ${det.label} ${Math.round(det.score*100)}%`,x1*sx+3,y1*sy-5);
      }
      animRef.current=requestAnimationFrame(draw);
    }
    animRef.current=requestAnimationFrame(draw);
    return()=>cancelAnimationFrame(animRef.current);
  },[]);

  // ── Capture frame ─────────────────────────────────────────────────────────
  const captureFrame = useCallback(():string|null=>{
    const v=videoRef.current; if(!v||!v.videoWidth) return null;
    const c=document.createElement("canvas");
    c.width=Math.min(v.videoWidth,640); c.height=Math.min(v.videoHeight,480);
    c.getContext("2d")?.drawImage(v,0,0,c.width,c.height);
    return c.toDataURL("image/jpeg",0.75).split(",")[1];
  },[]);

  // ── Tester un modèle ──────────────────────────────────────────────────────
  async function testModel(modelId:string){
    const frame=captureFrame(); if(!frame){setLog("❌ Caméra inactive"); return;}
    setModels(prev=>prev.map(m=>m.id===modelId?{...m,status:"loading",results:[],error:undefined}:m));
    const t0=Date.now();
    try{
      let dets:ModelResult[]=[];
      if(modelId==="coco"){
        // COCO-SSD navigateur
        const tf=await import("@tensorflow/tfjs");
        const cocoSsd=await import("@tensorflow-models/coco-ssd");
        await tf.ready();
        const mdl=await cocoSsd.load();
        const v=videoRef.current!;
        const preds=await mdl.detect(v);
        dets=preds.map(p=>({class:p.class,label:p.class,score:p.score,bbox:[p.bbox[0],p.bbox[1],p.bbox[0]+p.bbox[2],p.bbox[1]+p.bbox[3]],color:"#3B82F6",icon:"🌐"}));
      } else if(modelId==="yolo"){
        const r=await fetch(`${SERVER}/detect`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image:frame,module_id:activeModule,confidence:0.40}),signal:AbortSignal.timeout(10000)});
        const d=await r.json(); dets=d.detections??[];
      } else if(modelId==="ppe"){
        const r=await fetch(`${SERVER}/detect/ppe`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image:frame,sector:activeModule,confidence:0.40,organization_id:"",camera_id:""}),signal:AbortSignal.timeout(10000)});
        const d=await r.json(); dets=d.detections??[];
      } else if(modelId==="ppe_full"){
        const r=await fetch(`${SERVER}/detect/ppe`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image:frame,sector:activeModule,confidence:0.35,organization_id:"",camera_id:""}),signal:AbortSignal.timeout(10000)});
        const d=await r.json();
        dets=d.detections??[];
        // Ajouter workers
        for(const w of d.workers??[]){
          if(w.bbox) dets=[{class:"worker",label:`👷 #${w.worker_id} ${w.score}%`,score:w.score/100,bbox:w.bbox,color:w.color,icon:w.compliant?"✅":"❌",severity:w.compliant?"info":"critical"},...dets];
        }
      } else if(modelId==="ocr"){
        const r=await fetch(`${SERVER}/ocr/analyze`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image:frame}),signal:AbortSignal.timeout(15000)});
        const d=await r.json();
        dets=(d.results??[]).map((o:any)=>({class:"text",label:o.text||"Texte",score:o.confidence??0.8,icon:"🔤",color:"#8B5CF6"}));
      }
      const latency=Date.now()-t0;
      resultsRef.current=[...resultsRef.current.filter(r=>!dets.find(d=>d.class===r.class)),...dets];
      setAllResults(prev=>{
        const map=new Map(prev.map(r=>[r.class,r]));
        dets.forEach(d=>map.set(d.class,d));
        return Array.from(map.values());
      });
      setModels(prev=>prev.map(m=>m.id===modelId?{...m,status:"ok",results:dets,latency}:m));
      setLog(`✅ ${modelId}: ${dets.length} détection(s) en ${latency}ms`);
    } catch(e:any){
      setModels(prev=>prev.map(m=>m.id===modelId?{...m,status:"error",error:e.message,latency:Date.now()-t0}:m));
      setLog(`❌ ${modelId}: ${e.message}`);
    }
  }

  // ── Tout tester ──────────────────────────────────────────────────────────
  async function testAll(){
    const enabled=models.filter(m=>m.enabled);
    if(!enabled.length){setLog("⚠️ Activez au moins un modèle"); return;}
    resultsRef.current=[];
    setAllResults([]);
    for(const m of enabled) await testModel(m.id);
  }

  // ── Auto-run toutes les 3s ────────────────────────────────────────────────
  useEffect(()=>{
    if(autoRef.current) clearInterval(autoRef.current);
    if(autoRun && streaming){
      autoRef.current=setInterval(testAll, 3000);
    }
    return()=>{if(autoRef.current) clearInterval(autoRef.current);};
  },[autoRun, streaming, models]);

  // ── Railway status + logs ─────────────────────────────────────────────────
  async function fetchRailway(){
    try{
      const [h,p]=await Promise.all([
        fetch(`${SERVER}/health`,{signal:AbortSignal.timeout(5000),cache:"no-store"}),
        fetch(`${SERVER}/ppe/train-status`,{signal:AbortSignal.timeout(5000),cache:"no-store"}),
      ]);
      const hd=await h.json();
      const pd=await p.json().catch(()=>({}));
      setRailwayStatus({...hd,...pd});
      setRailwayLogs(pd.last_logs??[]);
    } catch(e:any){setRailwayStatus({error:e.message});}
  }

  useEffect(()=>{fetchRailway(); const iv=setInterval(fetchRailway,15000); return()=>clearInterval(iv);},[]);

  const enabledCount=models.filter(m=>m.enabled).length;
  const totalDets=allResults.length;
  const criticalDets=allResults.filter(r=>r.severity==="critical").length;

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-white">🔬 Diagnostic IA Complet</h1>
        <p className="text-sm text-slate-400 mt-1">Testez chaque modèle individuellement · Visualisez les segmentations · Logs Railway temps réel</p>
      </div>

      {/* ── Railway Status ── */}
      <div className={`rounded-xl border p-4 ${railwayStatus?.error?"border-red-800/40 bg-red-900/10":"border-emerald-800/40 bg-emerald-900/10"}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${railwayStatus?.error?"bg-red-500":"bg-emerald-400 animate-pulse"}`}/>
            <span className="text-sm font-bold text-white">
              {railwayStatus?.error?"❌ Railway hors ligne":`✅ Railway v${railwayStatus?.version||"..."}`}
            </span>
          </div>
          <button onClick={fetchRailway} className="text-xs text-slate-500 hover:text-white">🔄</button>
        </div>
        {railwayStatus && !railwayStatus.error && (
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg bg-slate-900 p-2 text-center">
              <p className={`font-bold ${railwayStatus.ppe_pt_exists?"text-emerald-400":"text-red-400"}`}>
                {railwayStatus.ppe_pt_exists?"✅":"❌"} PPE
              </p>
              <p className="text-slate-500 mt-0.5">{railwayStatus.models_dir?.length||0} modèles</p>
            </div>
            <div className="rounded-lg bg-slate-900 p-2 text-center">
              <p className="font-bold text-blue-400">{railwayStatus.nc||"?"} classes</p>
              <p className="text-slate-500 mt-0.5">PPE actif</p>
            </div>
            <div className="rounded-lg bg-slate-900 p-2 text-center">
              <p className="font-bold text-amber-400">{railwayStatus.mode||"onnx"}</p>
              <p className="text-slate-500 mt-0.5">Mode</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Caméra ── */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-300">📷 CAMÉRA DE TEST</h2>
        <div className="relative aspect-video rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover"/>
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none"/>
          {streaming && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500"/>
              <span className="text-xs text-white">LIVE · {facing==="environment"?"📷 Arrière":"🤳 Avant"}</span>
            </div>
          )}
          {totalDets>0 && (
            <div className="absolute top-3 right-3 rounded-lg bg-black/70 px-2.5 py-1.5 text-xs space-y-0.5">
              <p className="text-white font-bold">{totalDets} détection(s)</p>
              {criticalDets>0 && <p className="text-red-400">{criticalDets} critique(s)</p>}
            </div>
          )}
          {!streaming && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-slate-500 text-sm">Caméra inactive</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {!streaming
            ? <button onClick={()=>startCam()} className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-bold text-white">▶ Démarrer la caméra</button>
            : <button onClick={stopCam} className="flex items-center justify-center gap-2 rounded-xl border border-red-700 bg-red-900/20 py-3 text-sm font-bold text-red-400">⏹ Arrêter</button>
          }
          <button onClick={toggleFacing} className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-3 text-sm font-bold text-white">
            {facing==="environment"?"🤳 Vue avant":"📷 Vue arrière"}
          </button>
          <button onClick={testAll} disabled={!streaming||!enabledCount}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3 text-sm font-bold text-white disabled:opacity-40 hover:bg-emerald-600">
            🔬 Tester ({enabledCount})
          </button>
          <button onClick={()=>setAutoRun(!autoRun)} disabled={!streaming||!enabledCount}
            className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-bold disabled:opacity-40 transition-colors ${autoRun?"border-amber-500 bg-amber-900/20 text-amber-400":"border-slate-700 bg-slate-800 text-white"}`}>
            {autoRun?"⏸ Stop Auto":"▶▶ Auto 3s"}
          </button>
        </div>

        <div className={`rounded-xl border px-4 py-2.5 text-xs font-mono ${log.startsWith("✅")?"border-emerald-800 bg-emerald-900/10 text-emerald-400":log.startsWith("❌")?"border-red-800 bg-red-900/10 text-red-400":"border-slate-800 bg-slate-900 text-slate-400"}`}>
          {log}
        </div>
      </div>

      {/* ── Module selector ── */}
      <div className="space-y-2">
        <h2 className="text-sm font-bold text-slate-300">🧩 MODULE / SECTEUR DE TEST</h2>
        <div className="flex flex-wrap gap-2">
          {MODULES.map(m=>(
            <button key={m.id} onClick={()=>setActiveModule(m.id)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${activeModule===m.id?"border-brand bg-brand/20 text-white":"border-slate-700 bg-slate-800 text-slate-400 hover:text-white"}`}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">Module actif: <span className="text-brand">{MODULES.find(m=>m.id===activeModule)?.label}</span> — les détections PPE utilisent ce secteur</p>
      </div>

      {/* ── Modèles ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-300">🤖 MODÈLES IA</h2>
          <div className="flex gap-2">
            <button onClick={()=>setModels(p=>p.map(m=>({...m,enabled:true})))} className="text-xs text-slate-500 hover:text-white">Tout ✓</button>
            <button onClick={()=>setModels(p=>p.map(m=>({...m,enabled:false})))} className="text-xs text-slate-500 hover:text-white">Tout ✗</button>
          </div>
        </div>

        {models.map(model=>(
          <div key={model.id} className={`rounded-xl border transition-all ${model.enabled?"border-brand/40 bg-brand/5":"border-slate-800 bg-slate-900"}`}>
            {/* Header modèle */}
            <div className="flex items-center gap-3 p-3">
              <input type="checkbox" checked={model.enabled}
                onChange={e=>setModels(p=>p.map(m=>m.id===model.id?{...m,enabled:e.target.checked}:m))}
                className="h-4 w-4 rounded accent-brand"/>
              <span className="text-lg shrink-0">{model.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">{model.name}</p>
                {model.latency && <p className="text-xs text-slate-500">{model.latency}ms · {model.results.length} détection(s)</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {model.status==="loading" && <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent"/>}
                {model.status==="ok" && <span className="rounded-full bg-emerald-900 px-2 py-0.5 text-xs font-bold text-emerald-400">✅ {model.results.length}</span>}
                {model.status==="error" && <span className="rounded-full bg-red-900 px-2 py-0.5 text-xs font-bold text-red-400">❌</span>}
                <button onClick={()=>testModel(model.id)} disabled={!streaming||model.status==="loading"}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-bold text-white hover:border-brand disabled:opacity-40">
                  Test
                </button>
              </div>
            </div>

            {/* Résultats modèle */}
            {model.status==="error" && (
              <div className="border-t border-slate-800 px-4 py-2 text-xs text-red-400">❌ {model.error}</div>
            )}
            {model.results.length>0 && (
              <div className="border-t border-slate-800 p-3 space-y-1.5">
                {model.results.map((det,i)=>(
                  <div key={i} className="flex items-center gap-2.5 rounded-lg bg-slate-950 px-3 py-2">
                    <span className="text-lg shrink-0">{det.icon||"📦"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{det.label}</p>
                      <p className="text-xs font-mono" style={{color:SEV_COLOR(det.severity)}}>{det.class} · {Math.round(det.score*100)}%</p>
                    </div>
                    <div className="h-1.5 w-16 rounded-full bg-slate-800 overflow-hidden shrink-0">
                      <div className="h-full rounded-full" style={{width:`${det.score*100}%`,background:det.color||SEV_COLOR(det.severity)}}/>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Toutes les détections consolidées ── */}
      {allResults.length>0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-300">📊 DÉTECTIONS CONSOLIDÉES ({allResults.length})</h2>
            <button onClick={()=>{setAllResults([]); resultsRef.current=[];}} className="text-xs text-slate-600 hover:text-red-400">Effacer</button>
          </div>
          <div className="divide-y divide-slate-800 max-h-64 overflow-y-auto">
            {allResults.map((det,i)=>(
              <div key={i} className={`flex items-center gap-3 px-4 py-2.5 ${det.severity==="critical"?"bg-red-900/10":det.severity==="warning"?"bg-amber-900/10":""}`}>
                <span className="text-xl shrink-0">{det.icon||"📦"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{det.label}</p>
                  <p className="text-xs text-slate-500">{det.class} · {Math.round(det.score*100)}%</p>
                </div>
                <span className="shrink-0 text-xs font-bold" style={{color:SEV_COLOR(det.severity)}}>
                  {det.severity==="critical"?"🔴 Critique":det.severity==="warning"?"🟡 Alerte":det.severity==="info"?"🟢 OK":"⚪"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Railway Logs ── */}
      <div className="rounded-xl border border-slate-800 bg-black overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-400">🛤️ LOGS RAILWAY TEMPS RÉEL</h2>
          <button onClick={fetchRailway} className="text-xs text-slate-500 hover:text-white">🔄 Refresh</button>
        </div>
        <div className="p-3 font-mono text-xs space-y-0.5 max-h-48 overflow-y-auto">
          {railwayLogs.length===0
            ? <p className="text-slate-600">Aucun log disponible — lance un entraînement PPE pour voir les logs</p>
            : railwayLogs.map((l,i)=>(
              <p key={i} className={l.includes("✅")||l.includes("🎉")?"text-emerald-400":l.includes("❌")?"text-red-400":l.includes("🏋️")||l.includes("Epoch")?"text-amber-300 font-bold":"text-slate-500"}>{l}</p>
            ))
          }
        </div>
      </div>

      {/* ── Status Railway détaillé ── */}
      {railwayStatus && !railwayStatus.error && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="text-xs font-bold text-slate-400 mb-3">⚙️ CONFIGURATION RAILWAY</h2>
          <div className="space-y-2 text-xs">
            {[
              ["Version",     railwayStatus.version||"—"],
              ["PPE Modèle",  railwayStatus.model_path||"—"],
              ["Nb classes",  railwayStatus.nc||"—"],
              ["Mode",        railwayStatus.mode||"—"],
              ["Fichiers",    (railwayStatus.models_dir||[]).join(", ")||"vide"],
              ["Roboflow",    railwayStatus.roboflow_key?"✅ Configurée":"❌ Absente"],
            ].map(([l,v])=>(
              <div key={l} className="flex justify-between">
                <span className="text-slate-500">{l}</span>
                <span className="text-slate-300 truncate max-w-48 text-right">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
