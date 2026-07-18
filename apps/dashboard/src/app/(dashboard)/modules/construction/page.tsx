"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { CONSTRUCTION_SAFETY_CONFIG } from "@/lib/orchestrator/constructionSafety";
import { DetectionOverlay } from "@/components/DetectionOverlay";
import { useYoloDetection, type Detection } from "@/lib/hooks/useYoloDetection";
import { useMediaRecorder } from "@/lib/hooks/useMediaRecorder";
import { runDetectionPipeline } from "@/lib/services/pipelineService";
import { checkSetup, quickSetup, createCameraDirectly } from "@/lib/services/setupService";
import { ModuleToggleBar } from "@/components/ModuleToggleBar";
import { AIModelStatus } from "@/components/AIModelStatus";
import { ModuleLocationPicker } from "@/components/ModuleLocationPicker";
import { doc, setDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

type Tab = "overview"|"ppe"|"hazards"|"behavior"|"equipment"|"analytics"|"reports"|"advanced"|"ai_models";

export default function ConstructionSafetyPage() {
  const cfg = CONSTRUCTION_SAFETY_CONFIG;
  const [tab,         setTab]         = useState<Tab>("overview");
  const [facing,      setFacing]      = useState<"user"|"environment">("environment");
  const [streaming,   setStreaming]    = useState(false);
  const [aiOn,        setAiOn]        = useState(false);
  const [pipeLog,     setPipeLog]     = useState("Choisissez l'emplacement pour démarrer");
  const [session,     setSession]     = useState<{label:string;icon:string;severity:string;time:string}[]>([]);
  const [orgId,       setOrgId]       = useState<string|null>(null);
  const [camId,       setCamId]       = useState<string|null>(null);
  const [showPicker,  setShowPicker]  = useState(false);
  const [location,    setLocation]    = useState<string|null>(null);
  const [activeModules, setActiveModules] = useState<string[]>([]);

  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(()=>{
    checkSetup().then(s=>{ if(s.organizationId) setOrgId(s.organizationId); });
    return ()=>{ streamRef.current?.getTracks().forEach(t=>t.stop()); };
  },[]);

  async function startCam(face:"user"|"environment"=facing) {
    try {
      streamRef.current?.getTracks().forEach(t=>t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video:{facingMode:face,width:{ideal:1280},height:{ideal:720}},audio:false
      });
      streamRef.current = stream;
      if(videoRef.current){videoRef.current.srcObject=stream;await videoRef.current.play();}
      setStreaming(true);

      let org = orgId;
      if(!org){ const r=await quickSetup("Chantier Vision Guard"); org=r.organizationId; setOrgId(org); }
      if(org&&!camId){
        const name = location ? `Construction — ${location}` : "Construction Safety Cam";
        const id=await createCameraDirectly({organizationId:org,name,brand:"WebRTC",connector:"phone_webcam",timezone:Intl.DateTimeFormat().resolvedOptions().timeZone});
        setCamId(id);
        setPipeLog(`✅ ${name} — prêt`);
      } else {
        setPipeLog(`✅ ${location??"Construction Safety"} — flux actif`);
      }
    } catch(e:any){setPipeLog(`❌ ${e.message}`);}
  }

  async function toggleFacing() {
    const next = facing==="environment"?"user":"environment";
    setFacing(next);
    if(streaming) await startCam(next);
  }

  function stopCam() {
    streamRef.current?.getTracks().forEach(t=>t.stop());
    setStreaming(false); setAiOn(false);
    if(videoRef.current) videoRef.current.srcObject=null;
    setPipeLog("Caméra arrêtée");
  }

  const { startClip, recording, uploading } = useMediaRecorder(videoRef);

  async function handleRecord() {
    if(recording||!orgId||!camId) return;
    const now=new Date().toISOString();
    const evId=doc(collection(db,"_")).id;
    await setDoc(doc(db,"organizations",orgId,"events",evId),{
      id:evId,organizationId:orgId,cameraId:camId,siteId:"default",
      detectionIds:[],primaryType:"manual_recording",category:"human",
      label:"Enregistrement manuel — Construction Safety",
      severity:"info",durationSeconds:0,thumbnailUrl:null,videoClipUrl:null,
      clipStatus:"recording",acknowledged:false,createdAt:now,updatedAt:now,
    });
    setPipeLog("🔴 Enregistrement 15s en cours...");
    const result = await startClip({organizationId:orgId,cameraId:camId,eventId:evId,durationSec:15});
    if(result) setPipeLog(`✅ Clip ${result.durationSeconds}s (${result.sizeKb}KB) → Storage`);
    else setPipeLog("⚠️ Clip terminé");
  }

  const handleDetection = useCallback(async(dets:Detection[])=>{
    const time = new Date().toLocaleTimeString("fr-CA");
    setSession(prev=>[
      ...dets.map(d=>({label:d.label,icon:"⚠️",severity:d.severity,time})),
      ...prev
    ].slice(0,50));
    setPipeLog(`⚠️ ${dets[0]?.label} détecté · ${time}`);
    if(orgId&&camId&&videoRef.current){
      for(const det of dets){
        const r = await runDetectionPipeline({organizationId:orgId,cameraId:camId,detection:det,videoElement:videoRef.current}).catch(()=>null);
        if(r?.eventId&&r.eventId!=="error"&&!recording&&videoRef.current?.srcObject&&(det.severity==="warning"||det.severity==="critical")){
          startClip({organizationId:orgId,cameraId:camId,eventId:r.eventId,durationSec:12});
        }
      }
    }
  },[orgId,camId,recording,startClip]);

  const {detections,isLoading,modelReady,fps} = useYoloDetection(videoRef,{
    mode:aiOn&&streaming?"browser":"off",fps:8,confidence:0.40,voteFrames:2,onDetection:handleDetection
  });

  const violations = session.filter(s=>s.severity==="critical"||s.severity==="warning").length;

  const TABS: {id:Tab;label:string;icon:string}[] = [
    {id:"overview",   label:"Vue d'ensemble",  icon:"📊"},
    {id:"ppe",        label:"EPI / PPE",        icon:"⛑️"},
    {id:"hazards",    label:"Risques site",     icon:"⚠️"},
    {id:"behavior",   label:"Comportements",   icon:"👁️"},
    {id:"equipment",  label:"Engins & Outils", icon:"🏗️"},
    {id:"analytics",  label:"Analytics",       icon:"📈"},
    {id:"reports",    label:"Rapports",        icon:"📄"},
    {id:"advanced",   label:"Modules avancés", icon:"🚀"},
    {id:"ai_models",  label:"Modèles IA",      icon:"🤖"},
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Picker emplacement */}
      {showPicker && (
        <ModuleLocationPicker
          moduleId="construction" moduleName="Construction Safety"
          moduleIcon="🏗️" moduleColor="#F59E0B"
          onConfirm={(loc)=>{ setLocation(loc.name); setShowPicker(false); startCam(facing); }}
          onSkip={()=>{ setShowPicker(false); startCam(facing); }}
        />
      )}

      {/* Header */}
      <div className="border-b border-slate-800 px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Link href="/modules" className="text-slate-400 hover:text-white">←</Link>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/30 text-2xl">🏗️</div>
            <div>
              <h1 className="text-base font-bold text-white">{cfg.module.name}</h1>
              <p className="text-xs text-slate-500">
                {location ? `📍 ${location}` : cfg.module.description}
              </p>
            </div>
            <span className="rounded-full border border-amber-700 bg-amber-900/20 px-2 py-0.5 text-xs text-amber-400">Beta</span>
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                tab===t.id?"text-amber-400 border border-amber-800/40 bg-amber-900/10":"text-slate-400 hover:text-white"
              }`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {/* ── VUE D'ENSEMBLE — Caméra en haut ── */}
        {tab==="overview" && (
          <div className="space-y-4">
            {/* Flux vidéo */}
            <div className="relative aspect-video overflow-hidden rounded-xl bg-black border border-slate-800">
              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover"/>
              <DetectionOverlay detections={detections} videoRef={videoRef}/>
              {streaming&&(
                <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500"/>
                  <span className="text-xs text-white">{location??"Construction Safety AI"}</span>
                </div>
              )}
              {streaming&&(
                <div className="absolute top-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs text-slate-300">
                  {facing==="user"?"🤳 Avant":"📷 Arrière"}
                </div>
              )}
              {recording&&(
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-red-900/80 border border-red-700 px-3 py-1">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500"/>
                  <span className="text-xs text-red-300 font-bold">🔴 REC</span>
                </div>
              )}
              {streaming&&aiOn&&(
                <div className="absolute bottom-3 right-3 rounded-lg bg-black/70 px-2 py-1 text-xs">
                  {isLoading?"⏳ IA...":modelReady?<span className="text-emerald-400">🎯 {detections.length} obj · {fps}fps</span>:<span className="text-slate-500">IA off</span>}
                </div>
              )}
              {!streaming&&(
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/80">
                  <span className="text-5xl">🏗️</span>
                  <button onClick={()=>setShowPicker(true)}
                    className="rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-bold text-black">
                    📷 Choisir l'emplacement & démarrer
                  </button>
                </div>
              )}
            </div>

            {/* ── BOUTONS CONTRÔLES ── */}
            <div className="flex flex-wrap gap-2">
              {/* Démarrer / Arrêter */}
              {!streaming?(
                <button onClick={()=>setShowPicker(true)}
                  className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-black">
                  ▶ Démarrer
                </button>
              ):(
                <button onClick={stopCam}
                  className="rounded-xl border border-red-700 bg-red-900/10 px-4 py-2.5 text-sm font-bold text-red-400">
                  ⏹ Arrêter
                </button>
              )}

              {/* 🔄 Toggle avant / arrière */}
              <button onClick={toggleFacing}
                className="flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:border-amber-500 transition-colors">
                {facing==="environment"?"🤳 Vue avant":"📷 Vue arrière"}
              </button>

              {/* 🔴 Enregistrer */}
              <button onClick={handleRecord}
                disabled={!streaming||recording||uploading}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-40 ${
                  recording?"border border-red-600 bg-red-900/20 text-red-400":"bg-red-600 text-white hover:bg-red-700"
                }`}>
                {recording
                  ? <><span className="h-2 w-2 animate-pulse rounded-full bg-red-400"/>⏹ REC en cours...</>
                  : uploading ? "⏳ Upload..."
                  : <>🔴 Enregistrer</>}
              </button>

              {/* IA */}
              {streaming&&(
                <button onClick={()=>setAiOn(!aiOn)}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium ${
                    aiOn?"border-brand bg-brand/10 text-brand":"border-slate-700 text-slate-300"
                  }`}>
                  🤖 IA {aiOn?"ON":"OFF"}
                </button>
              )}

              {/* Changer emplacement */}
              <button onClick={()=>setShowPicker(true)}
                className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:text-white">
                📍 {location?"Changer":"Emplacement"}
              </button>
            </div>

            {/* Log */}
            <div className={`rounded-xl border px-3 py-2.5 text-xs font-mono ${
              pipeLog.startsWith("✅")?"border-emerald-800 bg-emerald-900/10 text-emerald-400"
              :pipeLog.startsWith("❌")?"border-red-800 bg-red-900/10 text-red-400"
              :pipeLog.startsWith("🔴")?"border-red-700 bg-red-900/20 text-red-300"
              :"border-slate-800 bg-slate-900 text-slate-400"
            }`}>{pipeLog}</div>

            {/* Panneau Modules */}
            {orgId && (
              <ModuleToggleBar organizationId={orgId} onModulesChange={setActiveModules}/>
            )}

            {/* Stats session */}
            <div className="grid grid-cols-3 gap-3">
              {[
                {label:"Détections",value:session.length,   color:"text-white"     },
                {label:"Violations",value:violations,        color:"text-red-400"   },
                {label:"Score sécu",value:session.length>0?`${Math.max(0,100-violations*10)}/100`:"—",color:"text-amber-400"},
              ].map(k=>(
                <div key={k.label} className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-center">
                  <p className="text-xs text-slate-500">{k.label}</p>
                  <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
                </div>
              ))}
            </div>

            {/* Session */}
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-slate-400">DÉTECTIONS SESSION</h3>
                {session.length>0&&<button onClick={()=>setSession([])} className="text-xs text-slate-600">Effacer</button>}
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {session.length===0
                  ? <p className="text-xs text-slate-600 text-center py-3">Démarrez la caméra + IA</p>
                  : session.map((s,i)=>(
                    <div key={i} className={`flex items-center gap-2 rounded px-2 py-1 ${s.severity==="critical"?"bg-red-900/20":s.severity==="warning"?"bg-amber-900/20":""}`}>
                      <span>{s.icon}</span>
                      <span className="flex-1 text-xs text-white truncate">{s.label}</span>
                      <span className="text-xs text-slate-600">{s.time}</span>
                    </div>
                  ))
                }
              </div>
            </div>

            {/* Info AI compact */}
            <AIModelStatus compact={true}/>
          </div>
        )}

        {/* ── EPI ── */}
        {tab==="ppe"&&(
          <div>
            <h2 className="text-base font-semibold text-white mb-4">⛑️ EPI — {cfg.ppe.length} équipements surveillés</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {cfg.ppe.map(p=>(
                <div key={p.id} className={`rounded-xl border p-3 ${p.critical?"border-red-800/40 bg-red-900/10":"border-slate-800 bg-slate-900"}`}>
                  <span className="text-xl block mb-1">{p.icon}</span>
                  <p className="text-xs font-medium text-white">{p.label}</p>
                  <p className={`text-xs mt-0.5 ${p.required?"text-amber-400":"text-slate-600"}`}>
                    {p.required?"Obligatoire":""}{p.critical?" · ⚡ Critique":""}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── RISQUES ── */}
        {tab==="hazards"&&(
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-semibold text-white mb-3">⚠️ Risques du site ({cfg.site_hazards.length})</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {cfg.site_hazards.map(h=>(
                  <div key={h.id} className={`rounded-xl border p-3 ${h.severity==="critical"?"border-red-800/40 bg-red-900/10":"border-amber-800/40 bg-amber-900/10"}`}>
                    <span className="text-2xl block mb-1">{h.icon}</span>
                    <p className="text-xs font-medium text-white">{h.label}</p>
                    <p className={`text-xs font-bold ${h.severity==="critical"?"text-red-400":"text-amber-400"}`}>{h.severity==="critical"?"CRITIQUE":"ALERTE"}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── COMPORTEMENTS ── */}
        {tab==="behavior"&&(
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-white mb-3">👁️ Comportements dangereux ({cfg.behavior_detection.length})</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {cfg.behavior_detection.map(b=>(
                <div key={b.id} className={`flex items-center gap-3 rounded-xl border p-3 ${b.severity==="critical"?"border-red-800/40 bg-red-900/10":"border-amber-800/40 bg-amber-900/10"}`}>
                  <span className="text-2xl">{b.icon}</span>
                  <div>
                    <p className="text-xs font-medium text-white">{b.label}</p>
                    <span className={`text-xs font-bold ${b.severity==="critical"?"text-red-400":"text-amber-400"}`}>{b.severity==="critical"?"🔴":"🟡"}</span>
                  </div>
                </div>
              ))}
            </div>
            <h3 className="text-sm font-semibold text-red-400 mt-4 mb-2">🆘 Chutes ({cfg.fall_detection.length})</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {cfg.fall_detection.map(f=>(
                <div key={f.id} className="rounded-xl border border-red-800/40 bg-red-900/10 p-3">
                  <span className="text-xl block mb-1">{f.icon}</span>
                  <p className="text-xs font-medium text-white">{f.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ENGINS ── */}
        {tab==="equipment"&&(
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-white mb-3">🏗️ Engins ({cfg.heavy_equipment.length}) + Outils ({cfg.tools.length})</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {cfg.heavy_equipment.map(e=>(
                <div key={e.id} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                  <span className="text-2xl block mb-1">{e.icon}</span>
                  <p className="text-xs font-medium text-white">{e.label}</p>
                  <p className="text-xs text-red-400">Zone: {e.alert_radius_m}m</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ANALYTICS ── */}
        {tab==="analytics"&&(
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {cfg.analytics.map(a=>(
              <div key={a.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <span className="text-2xl block mb-2">{a.icon}</span>
                <p className="text-xs text-slate-500 mb-1">{a.label}</p>
                <p className="text-xl font-bold text-amber-400">—</p>
                <p className="text-xs text-slate-600">{a.unit}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── RAPPORTS ── */}
        {tab==="reports"&&(
          <div className="space-y-2">
            {cfg.reports.map(r=>(
              <div key={r.id} className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
                <span className="text-2xl">{r.icon}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{r.label}</p>
                  <p className="text-xs text-slate-500">{r.frequency==="daily"?"Quotidien":r.frequency==="weekly"?"Hebdo":r.frequency==="monthly"?"Mensuel":"À la demande"}</p>
                </div>
                <button className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:border-amber-700 hover:text-amber-400">Générer</button>
              </div>
            ))}
          </div>
        )}

        {/* ── AVANCÉS ── */}
        {tab==="advanced"&&(
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cfg.advanced_modules.map(m=>(
              <div key={m.id} className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
                <div className="border-b border-slate-800 bg-slate-800/50 px-4 py-3 flex items-center gap-2">
                  <span className="text-2xl">{m.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{m.name}</p>
                    <span className="text-xs text-slate-500">🔜 Bientôt</span>
                  </div>
                </div>
                <div className="p-4 space-y-1">
                  {m.detections.map((d,i)=>(
                    <p key={i} className="text-xs text-slate-400">• {d}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── MODÈLES IA ── */}
        {tab==="ai_models"&&(
          <AIModelStatus compact={false}/>
        )}
      </div>
    </div>
  );
}
