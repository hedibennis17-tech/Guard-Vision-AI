"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { collection, query, orderBy, limit, onSnapshot, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useOrganization } from "@/lib/context/OrganizationContext";

const SERVER = process.env.NEXT_PUBLIC_AI_SERVER_URL ?? "";
const CAPTURE_W = 640, CAPTURE_H = 480;

export default function TrafficGuardPage() {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream|null>(null);
  const rafRef    = useRef<number>(0);
  const ivRef     = useRef<NodeJS.Timeout|null>(null);
  const detsRef   = useRef<any[]>([]);
  const lastEvRef = useRef<Record<string,number>>({});
  const { currentOrg } = useOrganization();

  const [streaming, setStreaming] = useState(false);
  const [facing,    setFacing]    = useState<"user"|"environment">("environment");
  const [aiOn,      setAiOn]      = useState(false);
  const [status,    setStatus]    = useState<any>(null);
  const [result,    setResult]    = useState<any>(null);
  const [events,    setEvents]    = useState<any[]>([]);
  const [log,       setLog]       = useState("▶ Démarrer la caméra");

  useEffect(()=>{
    if(!currentOrg?.id) return;
    return onSnapshot(query(collection(db,"organizations",currentOrg.id,"events"),orderBy("createdAt","desc"),limit(30)),
      s=>setEvents(s.docs.map(d=>({id:d.id,...d.data()})).filter((e:any)=>e.category==="traffic")),()=>{});
  },[currentOrg?.id]);

  useEffect(()=>{
    if(!SERVER) return;
    fetch(`${SERVER}/detect/traffic/status`,{signal:AbortSignal.timeout(5000),cache:"no-store"}).then(r=>r.json()).then(setStatus).catch(()=>{});
  },[]);

  useEffect(()=>{
    const cv=canvasRef.current; const vi=videoRef.current; if(!cv||!vi) return;
    function draw(){
      const ctx=cv!.getContext("2d"); if(!ctx||!vi){rafRef.current=requestAnimationFrame(draw);return;}
      const cW=vi.clientWidth||320, cH=vi.clientHeight||180;
      if(cv!.width!==cW||cv!.height!==cH){cv!.width=cW;cv!.height=cH;}
      ctx.clearRect(0,0,cW,cH);
      const sx=cW/CAPTURE_W, sy=cH/CAPTURE_H;
      for(const det of detsRef.current){
        if(!det.bbox?.length) continue;
        const [x1,y1,x2,y2]=det.bbox;
        ctx.strokeStyle=det.color||"#3B82F6"; ctx.lineWidth=2.5;
        ctx.strokeRect(x1*sx,y1*sy,(x2-x1)*sx,(y2-y1)*sy);
        ctx.fillStyle=(det.color||"#3B82F6")+"DD"; ctx.fillRect(x1*sx,y1*sy-20,(x2-x1)*sx,20);
        ctx.fillStyle="#FFF"; ctx.font="bold 11px sans-serif";
        ctx.fillText(`${det.icon||""} ${det.label} ${Math.round((det.score||0)*100)}%`,x1*sx+3,y1*sy-5,(x2-x1)*sx);
      }
      rafRef.current=requestAnimationFrame(draw);
    }
    rafRef.current=requestAnimationFrame(draw);
    return()=>cancelAnimationFrame(rafRef.current);
  },[]);

  const capture=useCallback(():string|null=>{
    const v=videoRef.current; if(!v||!v.videoWidth) return null;
    const c=document.createElement("canvas"); c.width=CAPTURE_W; c.height=CAPTURE_H;
    c.getContext("2d")?.drawImage(v,0,0,CAPTURE_W,CAPTURE_H);
    return c.toDataURL("image/jpeg",0.8).split(",")[1];
  },[]);

  const runDetection=useCallback(async()=>{
    const frame=capture(); if(!frame||!SERVER) return;
    try{
      const r=await fetch(`${SERVER}/detect/traffic`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image:frame,confidence:0.40}),signal:AbortSignal.timeout(12000)});
      const data=await r.json();
      detsRef.current=data.detections||[];
      setResult(data);
      const counts=Object.entries(data.vehicle_count||{}).map(([k,v])=>`${v} ${k}`).join(" · ");
      setLog(`🚗 ${counts||"Aucun véhicule"} · ${data.traffic_density||""}`);
      if(currentOrg?.id){
        const total=Object.values(data.vehicle_count||{} as Record<string,number>).reduce((a:number,b:any)=>a+b,0);
        if(total>0){
          const now=Date.now();
          if((now-(lastEvRef.current["traffic"]||0))>30000){
            lastEvRef.current["traffic"]=now;
            setDoc(doc(db,"organizations",currentOrg.id,"events",`traffic_${now}`),{
              id:`traffic_${now}`,organizationId:currentOrg.id,cameraId:"trafficguard",category:"traffic",
              primaryType:"vehicle_detected",label:`🚗 ${total} véhicule(s) — ${data.traffic_density}`,
              severity:total>5?"critical":total>2?"warning":"info",
              vehicle_count:data.vehicle_count,acknowledged:false,
              clipStatus:"none",durationSeconds:0,thumbnailUrl:null,videoClipUrl:null,
              createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
            }).catch(()=>{});
          }
        }
        for(const p of data.plates||[]){
          if(!p.text) continue;
          const key=`plate_${p.text}`; const now=Date.now();
          if((now-(lastEvRef.current[key]||0))>60000){
            lastEvRef.current[key]=now;
            setDoc(doc(db,"organizations",currentOrg.id,"events",`plate_${p.text}_${now}`),{
              id:`plate_${p.text}_${now}`,organizationId:currentOrg.id,cameraId:"trafficguard",category:"traffic",
              primaryType:"license_plate",label:`🔢 Plaque: ${p.text}`,severity:"info",plate_text:p.text,
              acknowledged:false,clipStatus:"none",durationSeconds:0,thumbnailUrl:null,videoClipUrl:null,
              createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
            }).catch(()=>{});
          }
        }
      }
    }catch(e:any){setLog(`❌ ${e.message}`);}
  },[capture,currentOrg?.id]);

  useEffect(()=>{
    if(ivRef.current) clearInterval(ivRef.current);
    if(aiOn&&streaming){runDetection();ivRef.current=setInterval(runDetection,3000);}
    return()=>{if(ivRef.current) clearInterval(ivRef.current);};
  },[aiOn,streaming,runDetection]);

  async function startCam(face:"user"|"environment"=facing){
    streamRef.current?.getTracks().forEach(t=>t.stop());
    try{
      let s:MediaStream;
      try{s=await navigator.mediaDevices.getUserMedia({video:face==="environment"?{facingMode:{exact:"environment"},width:{ideal:1280},height:{ideal:720}}:{facingMode:"user"},audio:false});}
      catch{s=await navigator.mediaDevices.getUserMedia({video:{facingMode:face},audio:false});}
      streamRef.current=s;
      if(videoRef.current){videoRef.current.srcObject=s;await videoRef.current.play().catch(()=>{});}
      setStreaming(true);setFacing(face);setLog("✅ Caméra active");
    }catch(e:any){setLog(`❌ ${e.message}`);}
  }
  function stopCam(){
    streamRef.current?.getTracks().forEach(t=>t.stop());
    if(videoRef.current) videoRef.current.srcObject=null;
    setStreaming(false);setAiOn(false);detsRef.current=[];setLog("Arrêtée");
  }
  useEffect(()=>()=>{streamRef.current?.getTracks().forEach(t=>t.stop());cancelAnimationFrame(rafRef.current);if(ivRef.current) clearInterval(ivRef.current);},[]);

  const totalVehicles=result?.vehicle_count?Object.values(result.vehicle_count as Record<string,number>).reduce((a,b)=>a+b,0):0;

  return(
    <div className="space-y-4 pb-8">
      <div className="flex items-center gap-3">
        <Link href="/modules" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 text-slate-400">←</Link>
        <div>
          <h1 className="text-lg font-bold text-white">🚗 TrafficGuard AI</h1>
          <p className="text-xs text-slate-400">Véhicules · Plaques · Comptage · Densité trafic</p>
        </div>
        {status?.loaded&&<span className="ml-auto rounded-full bg-emerald-900/30 border border-emerald-800/40 px-2 py-0.5 text-xs text-emerald-400">✅ Actif</span>}
      </div>

      {result&&<div className="grid grid-cols-3 gap-2">
        {[{l:"Véhicules",v:totalVehicles,c:"text-blue-400"},{l:"Plaques",v:result.plates?.length||0,c:"text-amber-400"},{l:"Total session",v:result.total_session||0,c:"text-white"}].map(k=>(
          <div key={k.l} className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-center">
            <p className="text-xs text-slate-500">{k.l}</p>
            <p className={`text-xl font-bold mt-1 ${k.c}`}>{k.v}</p>
          </div>
        ))}
      </div>}

      <div className="relative aspect-video rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover"/>
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none"/>
        {streaming&&<>
          <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-black/80 px-2.5 py-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500"/>
            <span className="text-xs text-white">LIVE · TrafficGuard</span>
          </div>
          {result?.traffic_density&&<div className="absolute top-2 right-2 rounded-full bg-black/80 px-2.5 py-1 text-xs text-white">{result.traffic_density}</div>}
        </>}
        {!streaming&&<div className="absolute inset-0 flex items-center justify-center"><p className="text-slate-500 text-sm">▶ Démarrer la caméra</p></div>}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {!streaming
          ?<button onClick={()=>startCam()} className="col-span-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white">▶ Démarrer la caméra</button>
          :<button onClick={stopCam} className="rounded-xl border border-red-700 bg-red-900/20 py-3 text-sm font-bold text-red-400">⏹ Arrêter</button>
        }
        <button onClick={()=>{const n=facing==="environment"?"user":"environment";setFacing(n);if(streaming)startCam(n);}} className="rounded-xl border border-slate-700 bg-slate-800 py-3 text-sm font-bold text-white">
          {facing==="environment"?"🤳 Avant":"📷 Arrière"}
        </button>
        <button onClick={()=>setAiOn(!aiOn)} disabled={!streaming} className={`rounded-xl py-3 text-sm font-bold disabled:opacity-40 ${aiOn?"bg-blue-600 text-white":"border border-slate-700 bg-slate-800 text-white"}`}>
          🤖 IA {aiOn?"ON":"OFF"}
        </button>
      </div>

      <div className={`rounded-xl border px-4 py-2.5 text-xs ${log.startsWith("✅")?"border-emerald-800 bg-emerald-900/10 text-emerald-400":log.startsWith("❌")?"border-red-800 bg-red-900/10 text-red-400":"border-slate-800 bg-slate-900 text-slate-400"}`}>
        {log}
      </div>

      {result?.vehicle_count&&Object.keys(result.vehicle_count).length>0&&(
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h3 className="text-xs font-bold text-slate-400 mb-3">📊 COMPTAGE PAR TYPE</h3>
          <div className="space-y-2">
            {Object.entries(result.vehicle_count as Record<string,number>).map(([type,count])=>(
              <div key={type} className="flex items-center gap-3">
                <span className="text-sm w-28 text-slate-300">{type==="car"?"🚗 Voiture":type==="truck"?"🚛 Camion":type==="bus"?"🚌 Bus":type==="motorcycle"?"🏍️ Moto":"🚲 Vélo"}</span>
                <div className="flex-1 h-2 rounded-full bg-slate-800"><div className="h-full rounded-full bg-blue-500" style={{width:`${Math.min(count*20,100)}%`}}/></div>
                <span className="text-sm font-bold text-blue-400 w-6">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result?.plates&&result.plates.length>0&&(
        <div className="rounded-xl border border-amber-800/40 bg-amber-900/10 p-4">
          <h3 className="text-xs font-bold text-amber-400 mb-3">🔢 PLAQUES LUES</h3>
          <div className="space-y-1.5">
            {result.plates.slice(0,5).map((p:any,i:number)=>(
              <div key={i} className="flex items-center gap-3 rounded-lg bg-slate-950 px-3 py-2">
                <span className="font-mono text-sm font-bold text-amber-400">{p.plate||"—"}</span>
                <span className="text-xs text-slate-500">{p.vehicle} · {p.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="border-b border-slate-800 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-300">🚨 Events Trafic ({events.length})</h3>
        </div>
        {events.length===0
          ?<div className="py-8 text-center text-xs text-slate-600">Activez l'IA pour détecter</div>
          :<div className="divide-y divide-slate-800 max-h-48 overflow-y-auto">
            {events.map(ev=>(
              <div key={ev.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className={`h-2 w-2 rounded-full shrink-0 ${ev.severity==="critical"?"bg-red-500":ev.severity==="warning"?"bg-amber-500":"bg-blue-500"}`}/>
                <p className="text-sm text-white flex-1 truncate">{ev.label}</p>
                <span className="text-xs text-slate-500 shrink-0">{new Date(ev.createdAt).toLocaleTimeString("fr-CA")}</span>
              </div>
            ))}
          </div>
        }
      </div>
    </div>
  );
}
