"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useOrganization } from "@/lib/context/OrganizationContext";

const SERVER = process.env.NEXT_PUBLIC_AI_SERVER_URL ?? "";
const CAPTURE_W = 640, CAPTURE_H = 480;

// ── Couleurs par classe PPE ───────────────────────────────────────────────────
const CLASS_COLORS: Record<string,string> = {
  // PPE présent → vert
  helmet:"#10B981", vest:"#10B981", safety_vest:"#10B981",
  gloves:"#10B981", boots:"#10B981", glasses:"#10B981",
  safety_glasses:"#10B981", harness:"#10B981", uniform:"#10B981", mask:"#10B981",
  // PPE absent → rouge
  "no-helmet":"#EF4444","no_helmet":"#EF4444",
  "no-vest":"#EF4444",  "no_vest":"#EF4444",
  no_gloves:"#EF4444",  no_boots:"#EF4444",
  no_glasses:"#EF4444", no_harness:"#EF4444", no_uniform:"#EF4444",
  // COCO → bleu
  person:"#3B82F6", car:"#8B5CF6", truck:"#8B5CF6",
  motorcycle:"#8B5CF6", bicycle:"#8B5CF6",
  // Autres → gris
  default:"#94A3B8",
};
const CLASS_ICONS: Record<string,string> = {
  helmet:"⛑️","no-helmet":"🚫","no_helmet":"🚫",
  vest:"🦺","no-vest":"🚫","no_vest":"🚫",
  gloves:"🧤",no_gloves:"🚫",boots:"👢",no_boots:"🚫",
  glasses:"🥽",safety_glasses:"🥽",no_glasses:"🚫",
  harness:"🪝",no_harness:"🚫",uniform:"👷",no_uniform:"🚫",
  mask:"😷",person:"👤",car:"🚗",truck:"🚛",default:"📦",
};

function getColor(cls:string){ return CLASS_COLORS[cls]||CLASS_COLORS.default; }
function getIcon(cls:string){  return CLASS_ICONS[cls]||CLASS_ICONS.default; }
function getSev(cls:string):"critical"|"warning"|"info"{
  if(cls.startsWith("no-")||cls.startsWith("no_")) return "critical";
  if(cls==="person") return "warning";
  return "info";
}

interface Det {
  id:string; class:string; label:string; icon:string; color:string; severity:"critical"|"warning"|"info";
  score:number; bbox_norm:[number,number,number,number]; source:string; confirmed:boolean; frames:number;
}

const framesMap = new Map<string,number>();

function normFromVideo(b:number[],vW:number,vH:number):[number,number,number,number]{
  return [b[0]/vW,b[1]/vH,b[2]/vW,b[3]/vH];
}
function normFromCapture(b:number[]):[number,number,number,number]{
  if(!b?.length) return [0,0,0,0];
  return [b[0]/CAPTURE_W,b[1]/CAPTURE_H,b[2]/CAPTURE_W,b[3]/CAPTURE_H];
}
function toCanvas(n:[number,number,number,number],w:number,h:number):[number,number,number,number]{
  return [n[0]*w,n[1]*h,n[2]*w,n[3]*h];
}
function iou(a:[number,number,number,number],b:[number,number,number,number]){
  const xi=Math.max(a[0],b[0]),yi=Math.max(a[1],b[1]),xa=Math.min(a[2],b[2]),ya=Math.min(a[3],b[3]);
  const inter=Math.max(0,xa-xi)*Math.max(0,ya-yi);
  const u=(a[2]-a[0])*(a[3]-a[1])+(b[2]-b[0])*(b[3]-b[1])-inter;
  return u?inter/u:0;
}
function nms(dets:Det[],thresh=0.45){
  const out:Det[]=[]; const sup=new Set<string>();
  for(const d of [...dets].sort((a,b)=>b.score-a.score)){
    if(sup.has(d.id)) continue; out.push(d);
    for(const o of dets) if(o.id!==d.id&&!sup.has(o.id)&&o.class===d.class&&iou(d.bbox_norm,o.bbox_norm)>thresh) sup.add(o.id);
  }
  return out;
}

type ModelState = {id:string;name:string;icon:string;color:string;active:boolean;status:"idle"|"loading"|"ok"|"error";dets:Det[];workers:any[];ms?:number;err?:string;};

const MODELS:ModelState[]=[
  {id:"coco",       name:"COCO-SSD",           icon:"🌐",color:"#3B82F6",active:false,status:"idle",dets:[],workers:[]},
  {id:"yolo",       name:"YOLOv11 ONNX",        icon:"⚡",color:"#8B5CF6",active:false,status:"idle",dets:[],workers:[]},
  {id:"ppe",        name:"PPE Détecteur",        icon:"⛑️",color:"#F59E0B",active:false,status:"idle",dets:[],workers:[]},
  {id:"ppe_engine", name:"PPE Engine + Workers", icon:"👷",color:"#EF4444",active:false,status:"idle",dets:[],workers:[]},
  {id:"ocr",        name:"OCR Tesseract",        icon:"🔤",color:"#10B981",active:false,status:"idle",dets:[],workers:[]},
];

type Tab="detection"|"events"|"notifs";

export default function DiagnosticPage(){
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream|null>(null);
  const rafRef    = useRef<number>(0);
  const detsRef   = useRef<Det[]>([]);
  const workersRef= useRef<any[]>([]);
  const ivRefs    = useRef<Record<string,NodeJS.Timeout>>({});
  const lastEvRef = useRef<Record<string,number>>({});

  const [streaming,setStreaming]=useState(false);
  const [facing,   setFacing]   =useState<"user"|"environment">("environment");
  const [models,   setModels]   =useState<ModelState[]>(MODELS);
  const [sector,   setSector]   =useState("construction");
  const [tab,      setTab]      =useState<Tab>("detection");
  const [logs,     setLogs]     =useState<{t:string;m:string;type:string}[]>([]);
  const [events,   setEvents]   =useState<any[]>([]);
  const [notifs,   setNotifs]   =useState<any[]>([]);
  const [railway,  setRailway]  =useState<any>(null);
  const [ppeInfo,  setPpeInfo]  =useState<any>(null);
  const [camLog,   setCamLog]   =useState("▶ Démarrer");
  const [debug,    setDebug]    =useState(false);
  const { currentOrg } = useOrganization();

  const log=(m:string,type="info")=>setLogs(p=>[{t:new Date().toLocaleTimeString("fr-CA"),m,type},...p].slice(0,100));

  // ── Firebase events + notifs ──────────────────────────────────────────────
  useEffect(()=>{
    if(!currentOrg?.id) return;
    const u1=onSnapshot(query(collection(db,"organizations",currentOrg.id,"events"),orderBy("createdAt","desc"),limit(60)),
      s=>setEvents(s.docs.map(d=>({id:d.id,...d.data()}))),()=>{});
    const u2=onSnapshot(query(collection(db,"organizations",currentOrg.id,"notifications"),orderBy("createdAt","desc"),limit(60)),
      s=>setNotifs(s.docs.map(d=>({id:d.id,...d.data()}))),()=>{});
    return()=>{u1();u2();};
  },[currentOrg?.id]);

  function saveEvent(det:Det){
    if(!currentOrg?.id) return;
    const now=Date.now();
    if((now-(lastEvRef.current[det.class]??0))<60000) return;
    lastEvRef.current[det.class]=now;
    const id=`diag_${det.class}_${now}`;
    setDoc(doc(db,"organizations",currentOrg.id,"events",id),{
      id,organizationId:currentOrg.id,cameraId:"diagnostic",
      primaryType:det.class,label:det.label,category:"ppe",
      severity:det.severity,score:det.score,acknowledged:false,
      clipStatus:"none",durationSeconds:0,thumbnailUrl:null,videoClipUrl:null,
      createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),source:"diagnostic",
    }).catch(()=>{});
  }

  // ── Canvas RAF ────────────────────────────────────────────────────────────
  useEffect(()=>{
    const cv=canvasRef.current; const vi=videoRef.current; if(!cv||!vi) return;
    function draw(){
      const ctx=cv!.getContext("2d"); if(!ctx||!vi){rafRef.current=requestAnimationFrame(draw);return;}
      const cW=vi.clientWidth||320, cH=vi.clientHeight||180;
      if(cv!.width!==cW||cv!.height!==cH){cv!.width=cW;cv!.height=cH;}
      ctx.clearRect(0,0,cW,cH);

      // Workers PPE
      for(const w of workersRef.current){
        const bn=w.bbox_norm; if(!bn?.length) continue;
        const [x1,y1,x2,y2]=toCanvas(bn,cW,cH);
        const col=w.compliant?"#10B981":"#EF4444";
        ctx.strokeStyle=col;ctx.lineWidth=3;ctx.strokeRect(x1,y1,x2-x1,y2-y1);
        ctx.fillStyle=col+"DD";ctx.fillRect(x1,y1-26,x2-x1,26);
        ctx.fillStyle="#FFF";ctx.font="bold 12px sans-serif";
        ctx.fillText(`👷#${w.worker_id} ${w.score}% ${w.compliant?"✅":"❌"}`,x1+4,y1-7,x2-x1-4);
        for(const e of w.epi_present??[]){
          const b=e.bbox_norm; if(!b?.length) continue;
          const [a,bb,c,d]=toCanvas(b,cW,cH);
          ctx.strokeStyle="#10B981";ctx.lineWidth=2;ctx.strokeRect(a,bb,c-a,d-bb);
          ctx.fillStyle="#10B981DD";ctx.fillRect(a,bb-16,c-a,16);
          ctx.fillStyle="#FFF";ctx.font="10px sans-serif";ctx.fillText(`✅${e.label}`,a+2,bb-4,c-a-4);
        }
        for(const ab of w.epi_absent??[]){
          const b=ab.bbox_norm; if(!b?.length) continue;
          const [a,bb,c,d]=toCanvas(b,cW,cH);
          ctx.strokeStyle="#EF4444";ctx.lineWidth=3;ctx.setLineDash([5,3]);
          ctx.strokeRect(a,bb,c-a,d-bb);ctx.setLineDash([]);
          ctx.fillStyle="#EF4444DD";ctx.fillRect(a,bb-16,c-a,16);
          ctx.fillStyle="#FFF";ctx.font="bold 10px sans-serif";ctx.fillText(`🚨${ab.label}`,a+2,bb-4,c-a-4);
        }
      }

      // Détections générales
      for(const det of detsRef.current){
        if(!det.confirmed&&!debug) continue;
        if(!det.bbox_norm||!det.bbox_norm.some(v=>v>0)) continue;
        const [x1,y1,x2,y2]=toCanvas(det.bbox_norm,cW,cH);
        if(x2-x1<2||y2-y1<2) continue;
        const dashed=det.severity==="critical";
        if(dashed){ctx.setLineDash([6,3]);}
        ctx.strokeStyle=det.color;ctx.lineWidth=det.severity==="critical"?3:2;
        ctx.strokeRect(x1,y1,x2-x1,y2-y1);ctx.setLineDash([]);
        const lbl=`${det.icon} ${det.label} ${Math.round(det.score*100)}%`;
        const tw=Math.min(ctx.measureText(lbl).width+8,x2-x1+4);
        ctx.fillStyle=det.color+"DD";ctx.fillRect(x1,y1-18,tw,18);
        ctx.fillStyle="#FFF";ctx.font=`${det.severity==="critical"?"bold ":""}11px sans-serif`;
        ctx.fillText(lbl,x1+4,y1-5,tw-8);
        if(debug){ctx.fillStyle="#FFFFFF66";ctx.font="9px monospace";ctx.fillText(`[${det.bbox_norm.map(v=>v.toFixed(2)).join(",")}]`,x1,y2+11);}
      }
      rafRef.current=requestAnimationFrame(draw);
    }
    rafRef.current=requestAnimationFrame(draw);
    return()=>cancelAnimationFrame(rafRef.current);
  },[debug]);

  // ── Capture ───────────────────────────────────────────────────────────────
  const capture=useCallback(():string|null=>{
    const v=videoRef.current; if(!v||!v.videoWidth) return null;
    const c=document.createElement("canvas"); c.width=CAPTURE_W; c.height=CAPTURE_H;
    c.getContext("2d")?.drawImage(v,0,0,CAPTURE_W,CAPTURE_H);
    return c.toDataURL("image/jpeg",0.8).split(",")[1];
  },[]);

  // ── Run modèle ────────────────────────────────────────────────────────────
  const run=useCallback(async(id:string)=>{
    const v=videoRef.current; if(!v) return;
    const frame=capture();
    if(!frame&&id!=="coco") return;
    setModels(p=>p.map(m=>m.id===id?{...m,status:"loading"}:m));
    const t0=Date.now();
    try{
      let newDets:Det[]=[]; let workers:any[]=[];
      if(id==="coco"){
        const tf=await import("@tensorflow/tfjs");
        const cs=await import("@tensorflow-models/coco-ssd");
        await tf.ready(); const mdl=await cs.load();
        const preds=await mdl.detect(v);
        const vW=v.videoWidth||CAPTURE_W, vH=v.videoHeight||CAPTURE_H;
        newDets=preds.map((p,i)=>{
          const raw=[p.bbox[0],p.bbox[1],p.bbox[0]+p.bbox[2],p.bbox[1]+p.bbox[3]];
          const bn=normFromVideo(raw,vW,vH);
          const n=(framesMap.get(p.class)??0)+1; framesMap.set(p.class,n);
          return{id:`coco_${i}`,class:p.class,label:p.class,icon:getIcon(p.class),color:getColor(p.class),severity:getSev(p.class),score:p.score,bbox_norm:bn,source:"coco",confirmed:n>=2,frames:n};
        });
      } else if(id==="yolo"){
        const r=await fetch(`${SERVER}/detect`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image:frame,module_id:sector,confidence:0.25}),signal:AbortSignal.timeout(10000)});
        const d=await r.json();
        newDets=(d.detections??[]).map((det:any,i:number)=>{
          const bn=normFromCapture(det.bbox??[]);
          const n=(framesMap.get(det.class)??0)+1; framesMap.set(det.class,n);
          return{id:`yolo_${i}`,class:det.class,label:det.label||det.class,icon:det.icon||getIcon(det.class),color:det.color||getColor(det.class),severity:getSev(det.class),score:det.score,bbox_norm:bn,source:"yolo",confirmed:n>=2,frames:n};
        });
      } else if(id==="ppe"||id==="ppe_engine"){
        const r=await fetch(`${SERVER}/detect/ppe`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image:frame,sector,confidence:0.15,organization_id:"",camera_id:"diag"}),signal:AbortSignal.timeout(20000)});
        const d=await r.json();
        newDets=(d.detections??[]).map((det:any,i:number)=>{
          const bn=normFromCapture(det.bbox??[]);
          const n=(framesMap.get(det.class)??0)+1; framesMap.set(det.class,n);
          const col=det.class.startsWith("no")?"#EF4444":"#10B981";
          return{id:`ppe_${i}`,class:det.class,label:det.label||det.class,icon:getIcon(det.class),color:det.color||col,severity:getSev(det.class),score:det.score,bbox_norm:bn,source:"ppe",confirmed:n>=2,frames:n};
        });
        if(id==="ppe_engine"){
          workers=(d.workers??[]).map((w:any)=>({
            ...w,
            bbox_norm:normFromCapture(w.bbox??[]),
            epi_present:(w.epi_present??[]).map((e:any)=>({...e,bbox_norm:normFromCapture(e.bbox??[])})),
            epi_absent: (w.epi_absent??[]).map((a:any)=>({...a,bbox_norm:normFromCapture(a.bbox??[])})),
          }));
          workersRef.current=workers;
        }
      } else if(id==="ocr"){
        const r=await fetch(`${SERVER}/ocr/analyze`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image:frame}),signal:AbortSignal.timeout(25000)});
        const d=await r.json();
        newDets=(d.results??[]).map((o:any,i:number)=>({id:`ocr_${i}`,class:"text",label:o.text||"Texte",icon:"🔤",color:"#10B981",severity:"info" as const,score:o.confidence??0.9,bbox_norm:[0,0,0,0] as [number,number,number,number],source:"ocr",confirmed:true,frames:1}));
      }

      const after=nms(newDets,0.45);
      // Cleanup frames inactifs
      const active=new Set(after.map(d=>d.class));
      for(const k of framesMap.keys()) if(!active.has(k)) framesMap.delete(k);

      detsRef.current=[...detsRef.current.filter(d=>d.source!==id),...after];
      after.filter(d=>d.severity==="critical"&&d.confirmed).forEach(d=>saveEvent(d));

      setModels(p=>p.map(m=>m.id===id?{...m,status:"ok",dets:after,workers,ms:Date.now()-t0}:m));
      log(`${id}: ${after.length} det (NMS ${newDets.length}→${after.length}) ${workers.length?`· ${workers.length}👷`:""}  ${Date.now()-t0}ms`,"ok");
    }catch(e:any){
      setModels(p=>p.map(m=>m.id===id?{...m,status:"error",err:e.message,ms:Date.now()-t0}:m));
      log(`${id}: ${e.message}`,"err");
    }
  },[capture,sector,saveEvent]);

  // ── Toggle modèle ────────────────────────────────────────────────────────
  function toggle(id:string){
    setModels(prev=>prev.map(m=>{
      if(m.id!==id) return m;
      const on=!m.active;
      if(on){
        log(`▶ ${m.name} activé`,"info");
        setTimeout(()=>run(id),50);
        const iv=setInterval(()=>run(id),3000);
        ivRefs.current[id]=iv;
      } else {
        log(`⏹ ${m.name} désactivé`,"warn");
        clearInterval(ivRefs.current[id]);
        delete ivRefs.current[id];
        if(id==="ppe_engine") workersRef.current=[];
        detsRef.current=detsRef.current.filter(d=>d.source!==id);
      }
      return{...m,active:on,status:on?"loading":"idle",dets:[],workers:[]};
    }));
  }

  // ── Caméra ────────────────────────────────────────────────────────────────
  async function startCam(face:"user"|"environment"=facing){
    streamRef.current?.getTracks().forEach(t=>t.stop());
    try{
      let s:MediaStream;
      try{s=await navigator.mediaDevices.getUserMedia({video:face==="environment"?{facingMode:{exact:"environment"},width:{ideal:1280},height:{ideal:720}}:{facingMode:"user"},audio:false});}
      catch{s=await navigator.mediaDevices.getUserMedia({video:{facingMode:face},audio:false});}
      streamRef.current=s;
      if(videoRef.current){videoRef.current.srcObject=s;await videoRef.current.play().catch(()=>{});}
      setStreaming(true);setFacing(face);
      setCamLog(`✅ ${face==="environment"?"Arrière":"Avant"} active`);
      log(`📷 Caméra ${face==="environment"?"arrière":"avant"}`,"ok");
    }catch(e:any){setCamLog(`❌ ${e.message}`);log(`❌ ${e.message}`,"err");}
  }
  function stopCam(){
    streamRef.current?.getTracks().forEach(t=>t.stop());
    if(videoRef.current) videoRef.current.srcObject=null;
    setStreaming(false);
    Object.values(ivRefs.current).forEach(clearInterval);ivRefs.current={};
    setModels(p=>p.map(m=>({...m,active:false,status:"idle",dets:[],workers:[]})));
    detsRef.current=[];workersRef.current=[];setCamLog("Arrêtée");
  }

  async function fetchRailway(){
    try{const r=await fetch(`${SERVER}/detect/ppe/status`,{signal:AbortSignal.timeout(5000),cache:"no-store"});setPpeInfo(await r.json());}catch(_e){}
    try{const r=await fetch(`${SERVER}/health`,{signal:AbortSignal.timeout(5000),cache:"no-store"});setRailway(await r.json());}catch(_e){}
  }
  useEffect(()=>{fetchRailway();const iv=setInterval(fetchRailway,20000);return()=>clearInterval(iv);},[]);
  useEffect(()=>()=>{streamRef.current?.getTracks().forEach(t=>t.stop());cancelAnimationFrame(rafRef.current);Object.values(ivRefs.current).forEach(clearInterval);},[]);

  const totalDets=models.reduce((a,m)=>a+m.dets.length,0);
  const unEv=events.filter(e=>!e.acknowledged).length;
  const unNo=notifs.filter(n=>!n.read).length;
  const FMT=(iso:string)=>{try{return new Date(iso).toLocaleTimeString("fr-CA",{hour:"2-digit",minute:"2-digit",second:"2-digit"});}catch{return "--";}};
  const SEV=(s?:string)=>s==="critical"?"#EF4444":s==="warning"?"#F59E0B":"#64748B";

  return(
    <div className="space-y-4 pb-32">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-white">🔬 Diagnostic IA</h1>
          <p className="text-xs text-slate-400">Caméra live · Tous les modèles · Events & Notifs en temps réel</p></div>
        <button onClick={()=>setDebug(!debug)} className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${debug?"border-amber-500 text-amber-400 bg-amber-900/20":"border-slate-700 text-slate-500"}`}>
          🔢 Debug
        </button>
      </div>

      {/* Status */}
      <div className="grid grid-cols-2 gap-2">
        <div className={`rounded-xl border px-3 py-2.5 flex items-center gap-2 ${!railway?.error?"border-emerald-800/40 bg-emerald-900/10":"border-red-800/40 bg-red-900/10"}`}>
          <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${!railway?.error?"bg-emerald-400 animate-pulse":"bg-red-500"}`}/>
          <div><p className="text-xs text-slate-400">Railway</p><p className="text-xs font-bold text-white">{railway?.error?`❌ Offline`:`✅ v${railway?.version||"..."}`}</p></div>
        </div>
        <div className={`rounded-xl border px-3 py-2.5 flex items-center gap-2 ${ppeInfo?.loaded?"border-emerald-800/40 bg-emerald-900/10":"border-red-800/40 bg-red-900/10"}`}>
          <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${ppeInfo?.loaded?"bg-emerald-400":"bg-red-500"}`}/>
          <div><p className="text-xs text-slate-400">PPE Model</p><p className="text-xs font-bold text-white">{ppeInfo?.loaded?`✅ ${ppeInfo.nc} classes`:"❌ Non chargé"}</p></div>
        </div>
      </div>

      {/* Caméra */}
      <div className="relative aspect-video rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover"/>
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none"/>
        {streaming&&(<>
          <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-black/80 px-2.5 py-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500"/>
            <span className="text-xs text-white">LIVE · {facing==="environment"?"📷":"🤳"}</span>
          </div>
          {models.filter(m=>m.active).map((m,i)=>(
            <div key={m.id} className="absolute right-2 flex items-center gap-1 rounded-full bg-black/80 px-2 py-0.5" style={{top:`${8+i*24}px`}}>
              <span className={`h-1.5 w-1.5 rounded-full ${m.status==="loading"?"animate-pulse":""}`} style={{background:m.color}}/>
              <span className="text-xs text-white">{m.icon} {m.dets.length}</span>
            </div>
          ))}
          {totalDets>0&&<div className="absolute bottom-2 right-2 rounded-lg bg-black/70 px-2 py-1 text-xs text-white">{totalDets} det</div>}
        </>)}
        {!streaming&&<div className="absolute inset-0 flex items-center justify-center"><p className="text-sm text-slate-500">▶ Démarrer la caméra</p></div>}
      </div>

      {/* Contrôles caméra */}
      <div className="grid grid-cols-2 gap-2">
        {!streaming
          ?<button onClick={()=>startCam()} className="col-span-2 rounded-xl bg-brand py-3 text-sm font-bold text-white">▶ Démarrer la caméra</button>
          :<button onClick={stopCam} className="rounded-xl border border-red-700 bg-red-900/20 py-3 text-sm font-bold text-red-400">⏹ Arrêter</button>
        }
        <button onClick={()=>{const n=facing==="environment"?"user":"environment";setFacing(n);if(streaming)startCam(n);}}
          className="rounded-xl border border-slate-700 bg-slate-800 py-3 text-sm font-bold text-white">
          {facing==="environment"?"🤳 Vue avant":"📷 Vue arrière"}
        </button>
        <select value={sector} onChange={e=>setSector(e.target.value)} className="col-span-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm text-white">
          {[["construction","🏗️ Construction Safety"],["industrial","🏭 Industrial Safety"],["home_security","🏠 Home Security"],["retail","🛒 Retail"],["transportation","🚗 TrafficGuard"],["defense","🛡️ Defense"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className={`rounded-xl border px-4 py-2.5 text-xs font-mono ${camLog.startsWith("✅")?"border-emerald-800 bg-emerald-900/10 text-emerald-400":camLog.startsWith("❌")?"border-red-800 bg-red-900/10 text-red-400":"border-slate-800 bg-slate-900 text-slate-400"}`}>
        {camLog}
      </div>

      {/* Modèles */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">🤖 MODÈLES — Cliquer pour activer/désactiver</h2>
        <div className="space-y-2">
          {models.map(m=>(
            <div key={m.id} className="rounded-xl border overflow-hidden" style={m.active?{borderColor:m.color+"50",background:m.color+"06"}:{borderColor:"#1E293B"}}>
              <button onClick={()=>toggle(m.id)} disabled={!streaming}
                className="w-full flex items-center gap-3 p-3.5 hover:bg-white/5 disabled:opacity-40 transition-colors">
                <div className="relative shrink-0">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl text-xl"
                    style={m.active?{background:m.color+"25",boxShadow:`0 0 12px ${m.color}40`}:{background:"#1E293B"}}>{m.icon}</div>
                  {m.active&&<div className="absolute -top-1 -right-1 h-4 w-4 rounded-full border-2 border-slate-950 flex items-center justify-center text-white text-[8px] font-bold" style={{background:m.color}}>
                    {m.status==="loading"?"…":"ON"}
                  </div>}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">{m.name}</span>
                    {m.active&&m.status==="ok"&&<span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{background:m.color+"25",color:m.color}}>✅ {m.dets.length}{m.workers.length?` · ${m.workers.length}👷`:""}</span>}
                    {m.status==="error"&&<span className="text-xs text-red-400">❌</span>}
                  </div>
                  {m.ms&&<p className="text-xs text-slate-600 mt-0.5">{m.ms}ms · NMS · auto 3s</p>}
                  {m.err&&<p className="text-xs text-red-400 mt-0.5 truncate">{m.err}</p>}
                </div>
                <div className="shrink-0 h-7 w-12 flex items-center rounded-full px-0.5 border transition-all" style={m.active?{background:m.color,borderColor:m.color}:{background:"#1E293B",borderColor:"#334155"}}>
                  <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${m.active?"translate-x-5":"translate-x-0"}`}/>
                </div>
              </button>

              {/* Détections sous le modèle */}
              {m.active&&m.status==="ok"&&m.dets.length>0&&(
                <div className="border-t border-slate-800 divide-y divide-slate-800/50 max-h-40 overflow-y-auto">
                  {m.dets.slice(0,5).map((d,i)=>(
                    <div key={i} className={`flex items-center gap-2.5 px-4 py-2 ${d.severity==="critical"?"bg-red-900/15":d.severity==="warning"?"bg-amber-900/10":""}`}>
                      <span className="text-base shrink-0">{d.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{d.label}</p>
                        {debug&&<p className="text-xs font-mono text-slate-600">[{d.bbox_norm.map(v=>v.toFixed(2)).join(",")}]</p>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="h-1.5 w-10 rounded-full bg-slate-800"><div className="h-full rounded-full" style={{width:`${d.score*100}%`,background:d.color}}/></div>
                        <span className="text-xs font-bold w-8 text-right" style={{color:d.color}}>{Math.round(d.score*100)}%</span>
                      </div>
                    </div>
                  ))}
                  {m.dets.length>5&&<p className="text-xs text-slate-500 px-4 py-1.5">+{m.dets.length-5} autres</p>}
                </div>
              )}

              {/* Workers */}
              {m.active&&m.id==="ppe_engine"&&m.workers.length>0&&(
                <div className="border-t border-slate-800 p-3 space-y-2">
                  {m.workers.map((w,i)=>(
                    <div key={i} className={`rounded-xl border p-3 ${w.compliant?"border-emerald-800/40 bg-emerald-900/10":"border-red-800/40 bg-red-900/10"}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-white">👷 Travailleur #{w.worker_id}</span>
                        <span className={`text-xs font-bold ${w.compliant?"text-emerald-400":"text-red-400"}`}>{w.score}% {w.compliant?"✅":"❌"}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-800 mb-2"><div className="h-full rounded-full" style={{width:`${w.score}%`,background:w.color}}/></div>
                      <div className="flex flex-wrap gap-1">
                        {(w.epi_present??[]).map((e:any,j:number)=><span key={j} className="rounded-full bg-emerald-900/30 border border-emerald-800/40 px-2 py-0.5 text-xs text-emerald-400">✅{e.label}</span>)}
                        {(w.epi_absent??[]).map((a:any,j:number)=><span key={j} className="rounded-full bg-red-900/30 border border-red-800/40 px-2 py-0.5 text-xs text-red-400 font-bold">🚨{a.label}</span>)}
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
      {ppeInfo?.classes&&(
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs font-bold text-slate-400 mb-2">⛑️ CLASSES PPE ACTIVES ({ppeInfo.nc}) · {ppeInfo.mode} · {ppeInfo.model_path?.split("/").pop()}</p>
          <div className="flex flex-wrap gap-1.5">
            {ppeInfo.classes.map((c:string)=>(
              <span key={c} className={`rounded-full border px-2 py-0.5 text-xs ${c.startsWith("no")?"border-red-800/40 bg-red-900/10 text-red-400":"border-emerald-800/40 bg-emerald-900/10 text-emerald-400"}`}>
                {c.startsWith("no")?"🚨":"✅"} {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── TABS STICKY ── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-slate-950/95 border-t border-slate-800 px-4 py-3 backdrop-blur">
        <div className="flex gap-2 max-w-2xl mx-auto">
          {([
            {id:"detection" as Tab, label:"🤖 IA Détection", badge:totalDets},
            {id:"events"    as Tab, label:"🚨 Events",        badge:unEv},
            {id:"notifs"    as Tab, label:"🔔 Notifications", badge:unNo},
          ]).map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition-all ${tab===t.id?"bg-brand text-white":"bg-slate-900 border border-slate-800 text-slate-400"}`}>
              {t.label}
              {t.badge>0&&<span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${tab===t.id?"bg-white/25":"bg-red-500 text-white"}`}>{t.badge}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB CONTENU ── */}
      <div className="pb-20">

        {/* Tab Détection = Logs */}
        {tab==="detection"&&(
          <div className="rounded-xl border border-slate-800 bg-black overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5">
              <span className="text-xs font-bold text-slate-400">📋 LOGS TEMPS RÉEL ({logs.length})</span>
              <button onClick={()=>setLogs([])} className="text-xs text-slate-600 hover:text-red-400">Effacer</button>
            </div>
            <div className="p-3 font-mono text-xs space-y-0.5 max-h-72 overflow-y-auto">
              {logs.length===0?<p className="text-slate-600">Activez un modèle...</p>:logs.map((l,i)=>(
                <p key={i} className={l.type==="ok"?"text-emerald-400":l.type==="err"?"text-red-400":l.type==="warn"?"text-amber-400":"text-slate-400"}>
                  <span className="text-slate-700">{l.t} </span>{l.m}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Tab Events */}
        {tab==="events"&&(
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[{l:"Total",v:events.length,c:"text-white"},{l:"Critiques",v:events.filter(e=>e.severity==="critical").length,c:"text-red-400"},{l:"Clips",v:events.filter(e=>e.videoClipUrl).length,c:"text-blue-400"}].map(k=>(
                <div key={k.l} className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-center">
                  <p className={`text-xl font-bold ${k.c}`}>{k.v}</p><p className="text-xs text-slate-500">{k.l}</p>
                </div>
              ))}
            </div>
            {events.length===0
              ?<div className="rounded-xl border border-slate-800 bg-slate-900 py-10 text-center"><p className="text-4xl mb-2">📭</p><p className="text-sm text-slate-400">Activez l'IA pour générer des events</p></div>
              :<div className="space-y-2">
                {events.map(ev=>(
                  <div key={ev.id} className={`rounded-xl border p-3.5 ${ev.severity==="critical"?"border-red-800/40 bg-red-900/10":ev.severity==="warning"?"border-amber-800/40 bg-amber-900/10":"border-slate-800 bg-slate-900"}`}>
                    <div className="flex items-start gap-2.5">
                      <span className="text-xl shrink-0">{ev.severity==="critical"?"🚨":ev.severity==="warning"?"⚠️":"ℹ️"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{ev.label||ev.primaryType}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-bold" style={{color:SEV(ev.severity)}}>{ev.severity}</span>
                          <span className="text-xs text-slate-500">{FMT(ev.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {ev.videoClipUrl&&<span className="text-blue-400">🎬</span>}
                        {!ev.acknowledged&&currentOrg?.id&&(
                          <button onClick={()=>updateDoc(doc(db,"organizations",currentOrg.id,"events",ev.id),{acknowledged:true}).catch(()=>{})}
                            className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-400 hover:text-emerald-400">✓</button>
                        )}
                      </div>
                    </div>
                    {ev.videoClipUrl&&<video src={ev.videoClipUrl} controls className="mt-2 w-full rounded-lg max-h-32 bg-black"/>}
                  </div>
                ))}
              </div>
            }
          </div>
        )}

        {/* Tab Notifications */}
        {tab==="notifs"&&(
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-white">🔔 {notifs.length} notifications · {unNo} non lues</p>
              {unNo>0&&currentOrg?.id&&<button onClick={()=>notifs.filter(n=>!n.read).forEach(n=>updateDoc(doc(db,"organizations",currentOrg.id,"notifications",n.id),{read:true}).catch(()=>{}))} className="text-xs text-brand">Tout lire</button>}
            </div>
            {notifs.length===0
              ?<div className="rounded-xl border border-slate-800 bg-slate-900 py-10 text-center"><p className="text-4xl mb-2">🔕</p><p className="text-sm text-slate-400">Aucune notification</p></div>
              :<div className="space-y-2">
                {notifs.map(n=>(
                  <div key={n.id} className={`flex items-start gap-3 rounded-xl border p-3.5 ${!n.read?"border-slate-700 bg-slate-900":"border-slate-800 bg-slate-950 opacity-60"}`}>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl text-xl shrink-0" style={{background:SEV(n.severity)+"20"}}>{n.severity==="critical"?"🚨":n.severity==="warning"?"⚠️":"ℹ️"}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white">{n.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{n.body}</p>
                      <p className="text-xs text-slate-600 mt-1">{FMT(n.createdAt)}</p>
                    </div>
                    {!n.read&&currentOrg?.id&&<button onClick={()=>updateDoc(doc(db,"organizations",currentOrg.id,"notifications",n.id),{read:true}).catch(()=>{})} className="h-2.5 w-2.5 rounded-full bg-brand shrink-0 mt-1"/>}
                  </div>
                ))}
              </div>
            }
          </div>
        )}
      </div>
    </div>
  );
}
