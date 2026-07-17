"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { CONSTRUCTION_SAFETY_CONFIG } from "@/lib/orchestrator/constructionSafety";
import { DetectionOverlay } from "@/components/DetectionOverlay";
import { useYoloDetection } from "@/lib/hooks/useYoloDetection";
import { runDetectionPipeline } from "@/lib/services/pipelineService";
import { checkSetup, quickSetup, createCameraDirectly } from "@/lib/services/setupService";

type Tab = "overview"|"ppe"|"hazards"|"behavior"|"equipment"|"analytics"|"reports"|"advanced";

export default function ConstructionSafetyPage() {
  const cfg = CONSTRUCTION_SAFETY_CONFIG;
  const [tab,      setTab]      = useState<Tab>("overview");
  const [camOn,    setCamOn]    = useState(false);
  const [aiOn,     setAiOn]     = useState(false);
  const [session,  setSession]  = useState<{label:string;icon:string;severity:string;time:string}[]>([]);
  const [pipeLog,  setPipeLog]  = useState("Prêt");
  const [orgId,    setOrgId]    = useState<string|null>(null);
  const [camId,    setCamId]    = useState<string|null>(null);

  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(()=>{
    checkSetup().then(s=>{
      if(s.organizationId) setOrgId(s.organizationId);
    });
    return ()=>{ streamRef.current?.getTracks().forEach(t=>t.stop()); };
  },[]);

  async function startCam(face:"user"|"environment"="environment") {
    try {
      streamRef.current?.getTracks().forEach(t=>t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video:{facingMode:face,width:{ideal:1280},height:{ideal:720}},audio:false
      });
      streamRef.current = stream;
      if(videoRef.current){videoRef.current.srcObject=stream;await videoRef.current.play();}
      setCamOn(true);

      if(!orgId){const r=await quickSetup("Chantier");setOrgId(r.organizationId);}
      if(orgId&&!camId){
        const id=await createCameraDirectly({
          organizationId:orgId,name:"Construction Safety Cam",
          brand:"WebRTC",connector:"phone_webcam",
          timezone:Intl.DateTimeFormat().resolvedOptions().timeZone
        });
        setCamId(id);
      }
    } catch(e){console.error(e);}
  }

  const handleDetection = useCallback(async(dets:any[])=>{
    const time = new Date().toLocaleTimeString("fr-CA");
    const newItems = dets.map(d=>({
      label:d.label, icon:"⚠️", severity:d.severity, time
    }));
    setSession(prev=>[...newItems,...prev].slice(0,50));
    setPipeLog(`⚠️ ${dets[0]?.label} détecté`);

    if(orgId&&camId&&videoRef.current){
      for(const det of dets){
        await runDetectionPipeline({
          organizationId:orgId,cameraId:camId,
          detection:det,videoElement:videoRef.current
        }).catch(()=>{});
      }
    }
  },[orgId,camId]);

  const {detections,isLoading,modelReady,fps} = useYoloDetection(videoRef,{
    mode:aiOn?"browser":"off",fps:8,confidence:0.40,voteFrames:2,onDetection:handleDetection
  });

  // Stats session
  const violations = session.filter(s=>s.severity==="critical"||s.severity==="warning").length;
  const totalDets  = session.length;

  const TABS: {id:Tab;label:string;icon:string}[] = [
    {id:"overview",  label:"Vue d'ensemble",  icon:"📊"},
    {id:"ppe",       label:"EPI / PPE",        icon:"⛑️"},
    {id:"hazards",   label:"Risques site",     icon:"⚠️"},
    {id:"behavior",  label:"Comportements",    icon:"👁️"},
    {id:"equipment", label:"Engins & Outils",  icon:"🏗️"},
    {id:"analytics", label:"Analytics",        icon:"📈"},
    {id:"reports",   label:"Rapports",         icon:"📄"},
    {id:"advanced",  label:"Modules avancés",  icon:"🚀"},
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Link href="/modules" className="text-slate-400 hover:text-white">←</Link>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/30 text-2xl">
              {cfg.module.icon}
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">{cfg.module.name}</h1>
              <p className="text-xs text-slate-500">{cfg.module.description}</p>
            </div>
            <span className="rounded-full border border-amber-700 bg-amber-900/20 px-2 py-0.5 text-xs text-amber-400">
              {cfg.module.status}
            </span>
          </div>
          {/* Contrôles caméra */}
          <div className="flex items-center gap-2">
            {aiOn&&modelReady&&(
              <span className="rounded-full border border-emerald-700 bg-emerald-900/20 px-2 py-0.5 text-xs text-emerald-400">
                🤖 {fps}fps
              </span>
            )}
            <button onClick={()=>{camOn?streamRef.current?.getTracks().forEach(t=>t.stop())&&setCamOn(false):startCam();}}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${camOn?"border-red-700 text-red-400":"border-slate-700 text-slate-300 hover:border-brand"}`}>
              {camOn?"⏹ Arrêter":"📷 Démarrer"}
            </button>
            {camOn&&(
              <button onClick={()=>setAiOn(!aiOn)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${aiOn?"border-brand bg-brand/10 text-brand":"border-slate-700 text-slate-300"}`}>
                🤖 {aiOn?"IA ON":"IA OFF"}
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                tab===t.id?"bg-amber-500/20 border border-amber-500/30 text-amber-400":"text-slate-400 hover:text-white"
              }`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">

        {/* ── VUE D'ENSEMBLE ── */}
        {tab==="overview"&&(
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Flux caméra */}
            <div className="lg:col-span-2">
              <div className="relative aspect-video overflow-hidden rounded-xl bg-black border border-slate-800 mb-3">
                <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover"/>
                <DetectionOverlay detections={detections} videoRef={videoRef}/>
                {camOn&&<div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500"/>
                  <span className="text-xs">LIVE · Construction Safety</span>
                </div>}
                {!camOn&&<div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <span className="text-5xl">🏗️</span>
                  <button onClick={()=>startCam()} className="rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-semibold text-black">
                    ▶ Démarrer la caméra
                  </button>
                </div>}
                {aiOn&&isLoading&&<div className="absolute bottom-3 right-3 rounded-lg bg-black/70 px-2 py-1 text-xs text-amber-400">
                  Chargement modèle IA...
                </div>}
              </div>

              {/* Log + stats rapides */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  {label:"Détections",  value:totalDets,  color:"text-white"   },
                  {label:"Violations",  value:violations, color:"text-red-400" },
                  {label:"Score sécu",  value:totalDets>0?`${Math.max(0,100-violations*10)}/100`:"—", color:"text-amber-400"},
                ].map(k=>(
                  <div key={k.label} className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-center">
                    <p className="text-xs text-slate-500">{k.label}</p>
                    <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Panel droit */}
            <div className="space-y-4">
              {/* Feed session */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-slate-400">DÉTECTIONS SESSION</h3>
                  {session.length>0&&<button onClick={()=>setSession([])} className="text-xs text-slate-600">Effacer</button>}
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {session.length===0
                    ? <p className="text-xs text-slate-600 text-center py-4">Aucune détection</p>
                    : session.map((s,i)=>(
                      <div key={i} className={`flex items-center gap-2 rounded px-2 py-1.5 ${
                        s.severity==="critical"?"bg-red-900/20":s.severity==="warning"?"bg-amber-900/20":""
                      }`}>
                        <span className="text-sm">{s.icon}</span>
                        <span className="flex-1 text-xs text-white truncate">{s.label}</span>
                        <span className="text-xs text-slate-600 shrink-0">{s.time}</span>
                        <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                          s.severity==="critical"?"bg-red-500":s.severity==="warning"?"bg-amber-500":"bg-slate-500"
                        }`}/>
                      </div>
                    ))
                  }
                </div>
              </div>

              {/* Log pipeline */}
              <div className={`rounded-xl border px-3 py-2 text-xs font-mono ${
                pipeLog.startsWith("✅")?"border-emerald-800 bg-emerald-900/10 text-emerald-400"
                :pipeLog.startsWith("⚠️")?"border-amber-800 bg-amber-900/10 text-amber-400"
                :"border-slate-800 bg-slate-900 text-slate-400"
              }`}>{pipeLog}</div>

              <Link href="/events" className="flex items-center justify-between w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300 hover:border-amber-700">
                🚨 Voir les events <span>→</span>
              </Link>
            </div>
          </div>
        )}

        {/* ── EPI / PPE ── */}
        {tab==="ppe"&&(
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-white mb-1">Équipements de Protection Individuelle</h2>
              <p className="text-sm text-slate-400">{cfg.ppe.length} EPI surveillés · Les EPI obligatoires déclenchent une alerte critique si absents</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {cfg.ppe.map(p=>(
                <div key={p.id} className={`rounded-xl border p-3 ${
                  p.critical?"border-red-800/50 bg-red-900/10":"border-slate-800 bg-slate-900"
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{p.icon}</span>
                    {p.required&&<span className="text-xs text-red-400">Obligatoire</span>}
                    {p.critical&&<span className="text-xs text-red-500 font-bold">⚡</span>}
                  </div>
                  <p className="text-xs font-medium text-white">{p.label}</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {p.critical?"Alerte CRITIQUE si absent":"Suivi standard"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── RISQUES SITE ── */}
        {tab==="hazards"&&(
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Risques du site</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {cfg.site_hazards.map(h=>(
                  <div key={h.id} className={`rounded-xl border p-3 ${
                    h.severity==="critical"?"border-red-800/50 bg-red-900/10":"border-amber-800/50 bg-amber-900/10"
                  }`}>
                    <span className="text-2xl block mb-1">{h.icon}</span>
                    <p className="text-xs font-medium text-white">{h.label}</p>
                    <span className={`text-xs font-bold ${h.severity==="critical"?"text-red-400":"text-amber-400"}`}>
                      {h.severity==="critical"?"CRITIQUE":"ALERTE"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Zones surveillées</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {cfg.zone_monitoring.map(z=>(
                  <div key={z.id} className="rounded-xl border border-slate-800 bg-slate-900 p-3 flex items-center gap-2">
                    <span className="text-xl">{z.icon}</span>
                    <p className="text-xs text-white">{z.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── COMPORTEMENTS ── */}
        {tab==="behavior"&&(
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Détection comportements dangereux</h2>
              <p className="text-sm text-slate-400 mb-4">{cfg.behavior_detection.length} comportements + {cfg.fall_detection.length} types de chute + {cfg.vehicle_safety.length} risques véhicules</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {cfg.behavior_detection.map(b=>(
                  <div key={b.id} className={`flex items-center gap-3 rounded-xl border p-3 ${
                    b.severity==="critical"?"border-red-800/40 bg-red-900/10":"border-amber-800/40 bg-amber-900/10"
                  }`}>
                    <span className="text-2xl shrink-0">{b.icon}</span>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-white">{b.label}</p>
                    </div>
                    <span className={`text-xs font-bold ${b.severity==="critical"?"text-red-400":"text-amber-400"}`}>
                      {b.severity==="critical"?"🔴":"🟡"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-red-400 mb-3">🆘 Détection de chute</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {cfg.fall_detection.map(f=>(
                  <div key={f.id} className="rounded-xl border border-red-800/40 bg-red-900/10 p-3">
                    <span className="text-xl block mb-1">{f.icon}</span>
                    <p className="text-xs font-medium text-white">{f.label}</p>
                    <p className="text-xs text-red-400 font-bold">CRITIQUE</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-red-400 mb-3">🚛 Sécurité véhicules</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {cfg.vehicle_safety.map(v=>(
                  <div key={v.id} className="flex items-center gap-3 rounded-xl border border-red-800/40 bg-red-900/10 p-3">
                    <span className="text-xl">{v.icon}</span>
                    <p className="text-xs font-medium text-white">{v.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── ENGINS & OUTILS ── */}
        {tab==="equipment"&&(
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">🏗️ Engins lourds ({cfg.heavy_equipment.length})</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {cfg.heavy_equipment.map(e=>(
                  <div key={e.id} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                    <span className="text-2xl block mb-1">{e.icon}</span>
                    <p className="text-xs font-medium text-white">{e.label}</p>
                    <p className="text-xs text-red-400 mt-0.5">Zone d'alerte: {e.alert_radius_m}m</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">🔧 Outils ({cfg.tools.length})</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {cfg.tools.map(t=>(
                  <div key={t.id} className={`rounded-xl border p-3 ${
                    t.risk==="high"?"border-red-800/40 bg-red-900/10"
                    :t.risk==="medium"?"border-amber-800/40 bg-amber-900/10"
                    :"border-slate-800 bg-slate-900"
                  }`}>
                    <span className="text-2xl block mb-1">{t.icon}</span>
                    <p className="text-xs font-medium text-white">{t.label}</p>
                    <span className={`text-xs ${t.risk==="high"?"text-red-400":t.risk==="medium"?"text-amber-400":"text-slate-500"}`}>
                      Risque {t.risk==="high"?"Élevé":t.risk==="medium"?"Moyen":"Faible"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">📦 Matériaux ({cfg.materials.length})</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {cfg.materials.map(m=>(
                  <div key={m.id} className={`rounded-xl border p-3 ${m.hazard?"border-red-800/40 bg-red-900/10":"border-slate-800 bg-slate-900"}`}>
                    <span className="text-xl block mb-1">{m.icon}</span>
                    <p className="text-xs font-medium text-white">{m.label}</p>
                    {m.hazard&&<p className="text-xs text-red-400">⚠️ Dangereux</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── ANALYTICS ── */}
        {tab==="analytics"&&(
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Analytics Construction Safety</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 mb-6">
              {cfg.analytics.map(a=>(
                <div key={a.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <span className="text-2xl block mb-2">{a.icon}</span>
                  <p className="text-xs text-slate-500 mb-1">{a.label}</p>
                  <p className="text-xl font-bold text-amber-400">—</p>
                  <p className="text-xs text-slate-600">{a.unit}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-amber-800/30 bg-amber-900/10 p-4">
              <p className="text-xs text-amber-400">
                ⚠️ Les analytics se basent sur les données réelles collectées par l'IA. 
                Activez la caméra et l'IA sur l'onglet Vue d'ensemble pour commencer à collecter des données.
              </p>
            </div>
          </div>
        )}

        {/* ── RAPPORTS ── */}
        {tab==="reports"&&(
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Rapports disponibles</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cfg.reports.map(r=>(
                <div key={r.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4 flex items-center gap-4">
                  <span className="text-3xl shrink-0">{r.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{r.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {r.frequency==="daily"?"Quotidien":r.frequency==="weekly"?"Hebdomadaire":r.frequency==="monthly"?"Mensuel":r.frequency==="on_event"?"À chaque événement":"À la demande"}
                    </p>
                  </div>
                  <button className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:border-amber-700 hover:text-amber-400">
                    Générer
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── MODULES AVANCÉS ── */}
        {tab==="advanced"&&(
          <div>
            <h2 className="text-lg font-semibold text-white mb-2">Modules avancés</h2>
            <p className="text-sm text-slate-400 mb-6">Extensions spécialisées pour la sécurité chantier — en développement</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cfg.advanced_modules.map(m=>(
                <div key={m.id} className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
                  <div className="border-b border-slate-800 bg-slate-800/50 px-4 py-3 flex items-center gap-2">
                    <span className="text-2xl">{m.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-white">{m.name}</p>
                      <span className="text-xs text-slate-500">🔜 Bientôt disponible</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <ul className="space-y-1.5">
                      {m.detections.map((d,i)=>(
                        <li key={i} className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="text-slate-600">•</span> {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
