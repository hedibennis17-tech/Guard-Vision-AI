"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePPEDetection, type PPEWorker, type PPEResult } from "@/lib/hooks/usePPEDetection";
import { PPEOverlay } from "@/components/PPEOverlay";
import { ModuleLocationPicker } from "@/components/ModuleLocationPicker";
import { checkSetup, quickSetup, createCameraDirectly } from "@/lib/services/setupService";
import type { ModulePageConfig } from "@/components/UniversalModulePage";

type Tab = "camera"|"workers"|"events"|"analytics";

export function PPEModulePage({ config }: { config: ModulePageConfig }) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream|null>(null);
  const orgRef    = useRef<string|null>(null);
  const camRef    = useRef<string|null>(null);

  const [facing,    setFacing]    = useState<"user"|"environment">("environment");
  const [streaming, setStreaming] = useState(false);
  const [aiOn,      setAiOn]      = useState(false);
  const [tab,       setTab]       = useState<Tab>("camera");
  const [location,  setLocation]  = useState<string|null>(null);
  const [showPicker,setShowPicker]= useState(false);
  const [orgId,     setOrgId]     = useState<string|null>(null);
  const [log,       setLog]       = useState("▶ Démarrez la caméra");
  const [history,   setHistory]   = useState<PPEResult[]>([]);

  useEffect(() => {
    checkSetup().then(s => { if (s.organizationId) { orgRef.current = s.organizationId; setOrgId(s.organizationId); }});
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  async function startCam(face:"user"|"environment" = facing) {
    try {
      streamRef.current?.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video:{ facingMode: face === "environment" ? { ideal: "environment" } : { ideal: "user" }, width:{ideal:1280}, height:{ideal:720} }, audio:false
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setStreaming(true);
      let org = orgRef.current;
      if (!org) { const r = await quickSetup(config.name); org=r.organizationId; orgRef.current=org; setOrgId(org); }
      if (org && !camRef.current) {
        const id = await createCameraDirectly({ organizationId:org, name:`${config.name}${location?" — "+location:""}`, brand:"WebRTC", connector:"phone_webcam", timezone:Intl.DateTimeFormat().resolvedOptions().timeZone, location:location??config.name });
        camRef.current = id;
      }
      setLog(`✅ ${location??config.name} — flux actif`);
    } catch(e:any) { setLog(`❌ ${e.message}`); }
  }

  function stopCam() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setStreaming(false); setAiOn(false); setLog("Caméra arrêtée");
  }

  const handleResult = useCallback((result: PPEResult) => {
    if (!result.workers?.length && !result.detections?.length) return;
    setHistory(prev => [result, ...prev].slice(0, 50));
    const sc = result.site_compliance;
    if (sc) setLog(`${sc.status} — Score: ${sc.score}% (${sc.compliant}/${sc.total_workers} conformes)`);
  }, []);

  const { result, loading, error } = usePPEDetection(videoRef, {
    enabled: aiOn && streaming,
    sector:  config.id === "construction" ? "construction" : "industrial",
    fps:     1,
    orgId:   orgId ?? "",
    camId:   camRef.current ?? "",
    onResult: handleResult,
  });

  const workers = result?.workers ?? [];
  const detections = result?.detections ?? [];
  const sc = result?.site_compliance;
  const lastResult = history[0];

  const TABS: { id:Tab; label:string; icon:string }[] = [
    { id:"camera",   label:"Caméra",      icon:"📷" },
    { id:"workers",  label:"Travailleurs", icon:"👷", },
    { id:"events",   label:"Alertes",      icon:"🚨" },
    { id:"analytics",label:"Analytics",    icon:"📊" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-white">

      {showPicker && (
        <ModuleLocationPicker moduleId={config.id} moduleName={config.name} moduleIcon={config.icon} moduleColor={config.color}
          onConfirm={loc => { setLocation(loc.name); setShowPicker(false); camRef.current=null; startCam(facing); }}
          onSkip={()=>{ setShowPicker(false); startCam(facing); }} />
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href="/modules" className="flex items-center justify-center h-8 w-8 rounded-lg border border-slate-800 text-slate-400 hover:text-white">←</Link>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xl" style={{background:`${config.color}20`, border:`1px solid ${config.color}40`}}>
            {config.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-white">{config.name}</h1>
            <p className="text-xs text-slate-500 truncate">{location?`📍 ${location}`:config.tagline}</p>
          </div>
          {sc && (
            <div className="shrink-0 flex items-center gap-1.5 rounded-full border px-2.5 py-1" style={{borderColor:sc.color+"60", background:sc.color+"15"}}>
              <span className="text-xs font-bold" style={{color:sc.color}}>{sc.score}%</span>
            </div>
          )}
          {loading && <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400 shrink-0"/>}
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 px-3 pb-2 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition-all ${tab===t.id?"text-white":"text-slate-500 hover:text-slate-300"}`}
              style={tab===t.id?{background:`${config.color}20`,color:config.color}:{}}>
              {t.icon} {t.label}
              {t.id==="workers" && workers.length>0 && (
                <span className="ml-1 rounded-full px-1.5 py-0.5 text-xs font-bold text-white" style={{background:config.color}}>{workers.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4">

        {/* ── TAB CAMÉRA ── */}
        {tab === "camera" && <>
          {/* Flux vidéo */}
          <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-900 border border-slate-800">
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover"/>
            <PPEOverlay detections={detections} workers={workers} videoRef={videoRef}/>

            {streaming && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500"/>
                <span className="text-xs text-white font-medium">LIVE · {location??config.name}</span>
              </div>
            )}
            {aiOn && sc && (
              <div className="absolute bottom-3 right-3 rounded-lg bg-black/80 px-3 py-2 text-xs space-y-0.5">
                <p className="font-bold" style={{color:sc.color}}>{sc.status}</p>
                <p className="text-slate-400">{sc.compliant}/{sc.total_workers} conformes · {sc.score}%</p>
              </div>
            )}
            {aiOn && loading && !sc && (
              <div className="absolute bottom-3 right-3 rounded-lg bg-black/70 px-2.5 py-1.5 text-xs text-amber-400">
                ⏳ Analyse PPE...
              </div>
            )}
            {!streaming && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/90">
                <span className="text-5xl">{config.icon}</span>
                <div className="flex gap-3">
                  <button onClick={()=>setShowPicker(true)} className="rounded-xl px-5 py-2.5 text-sm font-bold text-white" style={{background:config.color}}>📍 Emplacement</button>
                  <button onClick={()=>startCam()} className="rounded-xl border border-slate-600 bg-slate-800 px-5 py-2.5 text-sm font-bold text-white">▶ Démarrer</button>
                </div>
              </div>
            )}
          </div>

          {/* Boutons de contrôle */}
          <div className="grid grid-cols-2 gap-2">
            {/* Démarrer / Arrêter */}
            {!streaming ? (
              <button onClick={() => startCam()}
                className="col-span-2 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white"
                style={{background:config.color}}>
                ▶ Démarrer la caméra
              </button>
            ) : (
              <button onClick={stopCam}
                className="flex items-center justify-center gap-2 rounded-xl border border-red-700 bg-red-900/20 py-3 text-sm font-bold text-red-400">
                ⏹ Arrêter
              </button>
            )}

            {/* Vue avant / arrière */}
            <button onClick={() => {
                const next = facing === "environment" ? "user" : "environment";
                setFacing(next);
                if (streaming) startCam(next);
              }}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-sm font-bold text-white hover:border-slate-400 transition-colors">
              {facing === "environment" ? "🤳 Vue avant" : "📷 Vue arrière"}
            </button>

            {/* IA PPE ON/OFF */}
            <button onClick={() => setAiOn(!aiOn)}
              disabled={!streaming}
              className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition-colors disabled:opacity-40 ${
                aiOn ? "text-white" : "border-slate-600 bg-slate-800 text-slate-300"
              }`}
              style={aiOn ? {background:config.color, borderColor:config.color} : {}}>
              🤖 PPE IA {aiOn ? "ON" : "OFF"}
            </button>

            {/* Emplacement */}
            <button onClick={() => setShowPicker(true)}
              className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-400 hover:text-white hover:border-slate-500 transition-colors">
              📍 {location ? `Emplacement: ${location}` : "Choisir l'emplacement de la caméra"}
            </button>
          </div>

          {/* Log */}
          <div className={`rounded-xl border px-4 py-3 text-xs font-mono ${log.startsWith("✅")?"border-emerald-800 bg-emerald-900/10 text-emerald-400":log.startsWith("❌")?"border-red-800 bg-red-900/10 text-red-400":"border-slate-800 bg-slate-900 text-slate-500"}`}>
            {error ? `❌ ${error}` : log}
          </div>
        </>}

        {/* ── TAB TRAVAILLEURS ── */}
        {tab === "workers" && <>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">👷 Travailleurs détectés — {workers.length}</h2>
            {sc && <span className="text-sm font-bold" style={{color:sc.color}}>{sc.score}% conformité</span>}
          </div>

          {!aiOn || !streaming ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900 py-10 text-center">
              <p className="text-3xl mb-2">👷</p>
              <p className="text-sm text-slate-400 mb-3">Activez la caméra + IA PPE pour analyser les travailleurs</p>
              <button onClick={()=>{setTab("camera"); if(!streaming)startCam();}} className="rounded-xl px-4 py-2 text-sm font-bold text-white" style={{background:config.color}}>Activer →</button>
            </div>
          ) : workers.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900 py-10 text-center">
              <p className="text-3xl mb-2">🔍</p>
              <p className="text-sm text-slate-400">Aucun travailleur détecté dans la frame</p>
            </div>
          ) : (
            <div className="space-y-3">
              {workers.map(w => (
                <div key={w.worker_id} className={`rounded-xl border p-4 ${w.compliant?"border-emerald-800/40 bg-emerald-900/10":"border-red-800/40 bg-red-900/10"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">👷</span>
                      <p className="text-sm font-bold text-white">Travailleur #{w.worker_id}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${w.compliant?"bg-emerald-900 text-emerald-400":"bg-red-900 text-red-400"}`}>
                        {w.compliant?"✅ Conforme":"❌ Non conforme"}
                      </span>
                      <span className="text-sm font-bold" style={{color:w.color}}>{w.score}%</span>
                    </div>
                  </div>

                  {/* Barre conformité */}
                  <div className="h-2 rounded-full bg-slate-800 mb-3 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{width:`${w.score}%`,background:w.color}}/>
                  </div>

                  {/* EPI présents */}
                  {w.epi_present.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {w.epi_present.map((e,i) => (
                        <span key={i} className="rounded-full bg-emerald-900/40 border border-emerald-800/40 px-2.5 py-1 text-xs text-emerald-400">
                          ✅ {e.label}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* EPI absents */}
                  {w.epi_absent.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {w.epi_absent.map((a,i) => (
                        <span key={i} className="rounded-full bg-red-900/40 border border-red-800/40 px-2.5 py-1 text-xs text-red-400 font-bold">
                          🚨 {a.label}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Timeline */}
                  {w.timeline.length > 0 && (
                    <div className="mt-3 border-t border-slate-800 pt-2 space-y-1">
                      {w.timeline.map((t,i) => (
                        <p key={i} className={`text-xs ${t.type==="alert"?"text-red-400":t.type==="absent"?"text-amber-400":t.type==="present"?"text-emerald-400":"text-slate-500"}`}>
                          {t.time} · {t.event}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>}

        {/* ── TAB ALERTES ── */}
        {tab === "events" && <>
          <h2 className="text-sm font-bold text-white">🚨 Alertes PPE</h2>
          {history.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900 py-10 text-center">
              <p className="text-4xl mb-2">📭</p>
              <p className="text-sm text-slate-400">Aucune alerte — activez l'IA PPE</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.filter(h=>h.all_alerts?.length).map((h,i) => (
                <div key={i} className="rounded-xl border border-red-800/40 bg-red-900/10 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-red-400 font-bold">🚨 {h.timestamp}</span>
                    <span className="text-xs text-slate-500">{h.site_compliance?.score}% conformité</span>
                  </div>
                  {h.all_alerts?.map((a:any,j:number) => (
                    <p key={j} className="text-xs text-red-300">❌ {a.label}</p>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>}

        {/* ── TAB ANALYTICS ── */}
        {tab === "analytics" && <>
          <h2 className="text-sm font-bold text-white">📊 Analytics PPE</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              {label:"Scans totaux",    value:history.length,                                          color:"text-white"},
              {label:"Alertes",         value:history.filter(h=>h.all_alerts?.length>0).length,        color:"text-red-400"},
              {label:"Travailleurs",    value:history[0]?.site_compliance?.total_workers??0,           color:"text-amber-400"},
              {label:"Conformité moy.", value:history.length?`${Math.round(history.reduce((a,h)=>a+(h.site_compliance?.score??0),0)/history.length)}%`:"--", color:"text-emerald-400"},
            ].map(k=>(
              <div key={k.label} className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-center">
                <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                <p className="text-xs text-slate-500 mt-1">{k.label}</p>
              </div>
            ))}
          </div>
          {lastResult?.site_compliance && (
            <div className={`rounded-xl border p-4 ${lastResult.site_compliance.score>=80?"border-emerald-800/40 bg-emerald-900/10":"border-red-800/40 bg-red-900/10"}`}>
              <p className="text-sm font-bold text-white mb-1">Dernier scan — {lastResult.timestamp}</p>
              <p className="text-2xl font-bold mb-1" style={{color:lastResult.site_compliance.color}}>
                {lastResult.site_compliance.score}%
              </p>
              <p className="text-xs text-slate-400">{lastResult.site_compliance.status} · {lastResult.site_compliance.compliant}/{lastResult.site_compliance.total_workers} travailleurs conformes</p>
            </div>
          )}
        </>}

      </div>
    </div>
  );
}
