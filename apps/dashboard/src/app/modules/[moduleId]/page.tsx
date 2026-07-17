"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useOrganization } from "@/lib/context/OrganizationContext";
import { DetectionOverlay } from "@/components/DetectionOverlay";
import { useYoloDetection, type Detection } from "@/lib/hooks/useYoloDetection";
import { useMediaRecorder } from "@/lib/hooks/useMediaRecorder";
import { runDetectionPipeline } from "@/lib/services/pipelineService";
import { quickSetup, createCameraDirectly, checkSetup } from "@/lib/services/setupService";
import { MODULE_CONFIGS, type ModuleDetectionClass } from "@/lib/orchestrator/moduleConfigs";
import { getBundleById } from "@/lib/orchestrator/bundles";
import { auth } from "@/lib/firebase/client";

interface SessionDetection extends Detection {
  timestamp: string;
  alertTriggered: boolean;
}

export default function ModuleTestPage({ params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId }   = use(params);
  const { currentOrg } = useOrganization();

  const config = MODULE_CONFIGS[moduleId];
  const bundle = getBundleById(moduleId);

  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const orgIdRef  = useRef<string | null>(null);
  const camIdRef  = useRef<string | null>(null);

  const [facing,   setFacing]   = useState<"user"|"environment">("environment");
  const [ready,    setReady]    = useState(false);
  const [pipeLog,  setPipeLog]  = useState("Initialisation...");
  const [session,  setSession]  = useState<SessionDetection[]>([]);
  const [tab,      setTab]      = useState<"live"|"stats"|"tips">("live");
  const [autoSave, setAutoSave] = useState(true);

  // Mapping classe COCO → config module
  const classMap: Record<string, ModuleDetectionClass> = {};
  config?.classes.forEach(c => { classMap[c.cocoClass] = c; });

  // ── Init auto ────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const status = await checkSetup();
        let orgId = status.organizationId;
        if (!orgId) {
          const r = await quickSetup(currentOrg?.name ?? "Mon organisation");
          orgId   = r.organizationId;
        }
        orgIdRef.current = orgId;
        const camId = await createCameraDirectly({
          organizationId: orgId,
          name:   `Caméra ${config?.name ?? moduleId}`,
          brand:  "WebRTC",
          connector: "phone_webcam",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        camIdRef.current = camId;
        setReady(true);
        setPipeLog(`✅ ${config?.name} prêt — caméra enregistrée`);
      } catch (err: any) {
        setPipeLog(`❌ ${err.message}`);
      }
    })();
    return () => { streamRef.current?.getTracks().forEach(t=>t.stop()); };
  }, []);

  // ── Démarrer la caméra ───────────────────────────────────────────────────
  async function startCamera(face: "user"|"environment" = facing) {
    streamRef.current?.getTracks().forEach(t=>t.stop());
    const stream = await navigator.mediaDevices.getUserMedia({
      video:{ facingMode:face, width:{ideal:1280}, height:{ideal:720} }, audio:false,
    });
    streamRef.current = stream;
    if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
  }

  const { startClip, recording } = useMediaRecorder(videoRef);

  // ── Pipeline de détection ─────────────────────────────────────────────────
  const handleDetection = useCallback(async (dets: Detection[]) => {
    const orgId = orgIdRef.current;
    const camId = camIdRef.current;

    // Filtrer par les classes du module uniquement
    const moduleDetections = dets.filter(d => classMap[d.class]);
    if (!moduleDetections.length) return;

    const now = new Date().toLocaleTimeString("fr-CA");

    // Ajouter à la session locale
    setSession(prev => [
      ...moduleDetections.map(d => ({
        ...d,
        timestamp:       now,
        alertTriggered:  classMap[d.class]?.alertOn ?? false,
        label:           classMap[d.class]?.label ?? d.label,
        color:           classMap[d.class]?.color ?? d.color,
      })),
      ...prev,
    ].slice(0, 100));

    // Sauvegarder dans Firebase
    if (autoSave && orgId && camId && videoRef.current) {
      for (const det of moduleDetections) {
        const mCls = classMap[det.class];
        if (!mCls) continue;
        try {
          const result = await runDetectionPipeline({
            organizationId: orgId,
            cameraId:       camId,
            detection:      { ...det, label:mCls.label, severity:mCls.severity, category:det.category },
            videoElement:   videoRef.current,
          });
          if (result) {
            setPipeLog(`✅ ${mCls.label} → Firebase (${now})`);
            // Clip pour les alertes
            if (mCls.alertOn && result.eventId && result.eventId !== "error" && videoRef.current?.srcObject && !recording) {
              startClip({ organizationId:orgId, cameraId:camId, eventId:result.eventId, durationSec:10 })
                .then(clip => { if(clip) setPipeLog(`🎬 Clip ${clip.durationSeconds}s → Storage`); });
            }
          }
        } catch (err: any) {
          setPipeLog(`⚠️ ${err.message}`);
        }
      }
    }
  }, [autoSave, recording, startClip]);

  const { detections, isLoading, modelReady, fps }
    = useYoloDetection(videoRef, {
        mode:         ready ? "browser" : "off",
        fps:          8,
        confidence:   Math.min(...(config?.classes.map(c=>c.confidence) ?? [0.55])),
        voteFrames:   2,
        onDetection:  handleDetection,
      });

  // Filtrer les détections actives aux classes du module
  const moduleDetections = detections.filter(d => classMap[d.class]);

  // Calculer les stats
  const statsValues: Record<string,string|number> = {};
  config?.stats.forEach(s => { statsValues[s.id] = s.compute(session); });

  // Alertes actives
  const activeAlerts = session.filter(d => d.alertTriggered).slice(0,5);

  if (!config || !bundle) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400">Module "{moduleId}" introuvable</p>
        <Link href="/modules" className="text-brand hover:underline mt-2 block">← Retour aux modules</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/modules" className="text-slate-400 hover:text-white">←</Link>
          <span className="text-2xl">{bundle.icon}</span>
          <div>
            <h1 className="text-base font-semibold text-white">{config.name}</h1>
            <p className="text-xs text-slate-500">{config.sector} · {config.classes.length} classes</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {ready && modelReady && (
            <span className="rounded-full border border-emerald-700 bg-emerald-900/20 px-2 py-0.5 text-xs text-emerald-400">
              🤖 IA active · {fps}fps
            </span>
          )}
          {recording && (
            <span className="rounded-full border border-red-700 bg-red-900/20 px-2 py-0.5 text-xs text-red-400 flex gap-1 items-center">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500"/>REC
            </span>
          )}
          <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
            <input type="checkbox" checked={autoSave} onChange={e=>setAutoSave(e.target.checked)} className="accent-brand"/>
            Firebase
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-3">
        {/* Colonne gauche — flux vidéo */}
        <div className="lg:col-span-2 space-y-3">
          {/* Vidéo */}
          <div className="relative aspect-video overflow-hidden rounded-xl bg-black border border-slate-800">
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover"/>
            <DetectionOverlay detections={moduleDetections} videoRef={videoRef}/>

            {/* Badge LIVE */}
            <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500"/>
              <span className="text-xs">LIVE · {config.name}</span>
            </div>

            {/* IA status */}
            <div className="absolute bottom-3 right-3 rounded-lg bg-black/70 px-2 py-1 text-xs">
              {isLoading ? <span className="text-brand">Chargement YOLOv11...</span>
               : modelReady ? <span className="text-emerald-400">🎯 {moduleDetections.length} détection(s) actives</span>
               : <span className="text-slate-500">IA en attente</span>}
            </div>

            {/* Alertes visuelles */}
            {activeAlerts.length > 0 && (
              <div className="absolute top-3 right-3 space-y-1">
                {activeAlerts.slice(0,3).map((a,i) => (
                  <div key={i} className="flex items-center gap-1.5 rounded-full bg-red-900/80 border border-red-700 px-2 py-0.5">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500"/>
                    <span className="text-xs text-red-300">{a.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Contrôles caméra */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => { setFacing("environment"); startCamera("environment"); }}
              className={`rounded-lg border px-4 py-2 text-sm font-medium ${facing==="environment"?"border-brand bg-brand/10 text-brand":"border-slate-700 text-slate-300"}`}>
              📷 Arrière
            </button>
            <button onClick={() => { setFacing("user"); startCamera("user"); }}
              className={`rounded-lg border px-4 py-2 text-sm font-medium ${facing==="user"?"border-brand bg-brand/10 text-brand":"border-slate-700 text-slate-300"}`}>
              🤳 Avant
            </button>
            <div className={`flex-1 rounded-lg border px-3 py-2 text-xs font-mono ${
              pipeLog.startsWith("✅") ? "border-emerald-800 bg-emerald-900/10 text-emerald-400"
              : pipeLog.startsWith("❌") ? "border-red-800 bg-red-900/10 text-red-400"
              : pipeLog.startsWith("🎬") ? "border-brand/50 bg-brand/5 text-brand"
              : "border-slate-800 bg-slate-900 text-slate-400"}`}>
              {pipeLog}
            </div>
          </div>

          {/* Note YOLOv11 */}
          <div className="rounded-xl border border-amber-800/30 bg-amber-900/10 px-4 py-2 text-xs text-amber-400">
            ℹ️ {config.yoloNote}
          </div>
        </div>

        {/* Colonne droite */}
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex rounded-lg bg-slate-900 p-1 gap-1">
            {(["live","stats","tips"] as const).map(t=>(
              <button key={t} onClick={()=>setTab(t)}
                className={`flex-1 rounded-md py-1.5 text-xs font-medium ${tab===t?"bg-brand text-white":"text-slate-400"}`}>
                {t==="live"?"🔴 Live":t==="stats"?"📊 Stats":"💡 Conseils"}
              </button>
            ))}
          </div>

          {/* LIVE — détections actives */}
          {tab === "live" && (
            <>
              {/* Classes du module */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <h3 className="mb-3 text-xs font-semibold text-slate-400">CLASSES ACTIVES</h3>
                <div className="space-y-1.5">
                  {config.classes.map(cls => {
                    const isDetected = moduleDetections.some(d=>d.class===cls.cocoClass);
                    return (
                      <div key={cls.cocoClass}
                        className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition-all ${
                          isDetected ? "bg-slate-800 border border-slate-700" : "opacity-40"
                        }`}>
                        <span className="text-lg shrink-0">{cls.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white truncate">{cls.label}</p>
                          <p className="text-xs text-slate-500 truncate">{cls.description}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {cls.alertOn && <span className="text-xs text-red-400">🚨</span>}
                          {isDetected && <span className="text-xs text-emerald-400">●</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Flux session */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-400">SESSION ({session.length})</h3>
                  {session.length > 0 && (
                    <button onClick={()=>setSession([])} className="text-xs text-slate-600 hover:text-slate-400">Effacer</button>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {session.length === 0
                    ? <p className="text-xs text-slate-600 text-center py-3">Démarrez la caméra pour détecter</p>
                    : session.slice(0,20).map((d,i) => (
                      <div key={i} className={`flex items-center gap-2 rounded px-2 py-1 ${d.alertTriggered?"bg-red-900/20":""}`}>
                        <div className="h-2 w-2 shrink-0 rounded-full" style={{background:d.color}}/>
                        <span className="flex-1 text-xs text-white truncate">{d.label}</span>
                        <span className="text-xs text-slate-600 shrink-0">{d.timestamp}</span>
                        {d.alertTriggered && <span className="text-xs text-red-400 shrink-0">🚨</span>}
                      </div>
                    ))
                  }
                </div>
              </div>
            </>
          )}

          {/* STATS */}
          {tab === "stats" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {config.stats.map(s => (
                  <div key={s.id} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                    <p className="text-xs text-slate-500 mb-1">{s.icon} {s.label}</p>
                    <p className="text-xl font-bold" style={{color:s.color}}>
                      {statsValues[s.id] ?? "—"}
                    </p>
                  </div>
                ))}
              </div>

              {/* Liens vers données */}
              {session.length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <h3 className="mb-3 text-xs font-semibold text-slate-400">DONNÉES</h3>
                  <div className="space-y-2">
                    <Link href="/events" className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2 text-xs text-slate-300 hover:text-brand">
                      🚨 Voir les events <span>→</span>
                    </Link>
                    <Link href="/notifications" className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2 text-xs text-slate-300 hover:text-brand">
                      🔔 Notifications <span>→</span>
                    </Link>
                    <Link href="/analytics" className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2 text-xs text-slate-300 hover:text-brand">
                      📊 Analytics <span>→</span>
                    </Link>
                    <Link href="/ai-detection" className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2 text-xs text-slate-300 hover:text-brand">
                      🤖 AI Détection <span>→</span>
                    </Link>
                  </div>
                </div>
              )}
            </>
          )}

          {/* CONSEILS */}
          {tab === "tips" && (
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <h3 className="mb-3 text-xs font-semibold text-slate-400">CONSEILS D'UTILISATION</h3>
                <div className="space-y-2">
                  {config.tips.map((tip,i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
                      <span className="text-brand shrink-0 mt-0.5">•</span>
                      <span>{tip}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <h3 className="mb-3 text-xs font-semibold text-slate-400">MODÈLES IA REQUIS</h3>
                {bundle.models.map(m => (
                  <div key={m} className="mb-1.5 flex items-center gap-2 text-xs">
                    <span className="text-emerald-400">✓</span>
                    <span className="text-slate-300 font-medium">{m}</span>
                  </div>
                ))}
              </div>

              <Link href={`/marketplace`}
                className="block rounded-xl border border-brand/30 bg-brand/5 p-4 text-center text-sm text-brand hover:bg-brand/10">
                🧩 Configurer ce module dans le Marketplace →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
