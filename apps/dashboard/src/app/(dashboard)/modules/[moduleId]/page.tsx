"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useOrganization } from "@/lib/context/OrganizationContext";
import { DetectionOverlay } from "@/components/DetectionOverlay";
import { useYoloDetection, type Detection } from "@/lib/hooks/useYoloDetection";
import { runDetectionPipeline } from "@/lib/services/pipelineService";
import { quickSetup, createCameraDirectly, checkSetup } from "@/lib/services/setupService";
import { MODULE_CONFIGS } from "@/lib/orchestrator/moduleConfigs";
import { getBundleById } from "@/lib/orchestrator/bundles";
import { useActiveModules } from "@/lib/orchestrator/useActiveModules";

interface SessionItem {
  label:     string;
  icon:      string;
  color:     string;
  score:     number;
  time:      string;
  alerted:   boolean;
  saved:     boolean;
}

export default function ModuleTestPage() {
  const params   = useParams();
  const moduleId = params.moduleId as string;

  const config = MODULE_CONFIGS[moduleId];
  const bundle = getBundleById(moduleId);

  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const orgIdRef  = useRef<string | null>(null);
  const camIdRef  = useRef<string | null>(null);

  const [facing,   setFacing]   = useState<"user"|"environment">("environment");
  const [ready,    setReady]    = useState(false);
  const [streaming,setStreaming] = useState(false);
  const [pipeLog,  setPipeLog]  = useState("Cliquez 📷 pour démarrer");
  const [session,  setSession]  = useState<SessionItem[]>([]);
  const [tab,      setTab]      = useState<"live"|"stats"|"tips">("live");
  const [aiOn,     setAiOn]     = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [orgIdState, setOrgIdState] = useState<string|undefined>(undefined);
  const { modules: activeModules } = useActiveModules(orgIdState);

  // Mapping classe COCO → config module
  const classMap = config
    ? Object.fromEntries(config.classes.map(c => [c.cocoClass, c]))
    : {};

  // ── Init Firebase ────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const status = await checkSetup();
        let orgId = status.organizationId;
        if (!orgId) {
          const r = await quickSetup("Mon organisation");
          orgId   = r.organizationId;
        }
        orgIdRef.current = orgId;
        const camId = await createCameraDirectly({
          organizationId: orgId,
          name:           `Test — ${config?.name ?? moduleId}`,
          brand:          "WebRTC Test",
          connector:      "phone_webcam",
          timezone:       Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        camIdRef.current = camId;
        setOrgIdState(orgId);
        setReady(true);
        setPipeLog(`✅ Prêt — cliquez 📷 pour démarrer`);
      } catch (err: any) {
        setPipeLog(`⚠️ Firebase: ${err.message} — fonctionne quand même en local`);
        setReady(true); // On continue même sans Firebase
      }
    })();
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  // ── Caméra ───────────────────────────────────────────────────────────────
  async function startCamera(face: "user"|"environment" = facing) {
    setPipeLog("Accès caméra...");
    try {
      streamRef.current?.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: face, width:{ideal:1280}, height:{ideal:720} },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStreaming(true);
      setAiOn(true); // Auto-activer l'IA au démarrage
      setPipeLog(`📷 ${face === "environment" ? "Caméra arrière" : "Caméra avant"} · IA démarrée`);
    } catch (err: any) {
      setPipeLog(`❌ Caméra: ${err.name === "NotAllowedError" ? "Accès refusé" : err.message}`);
    }
  }

  // ── Pipeline détection ────────────────────────────────────────────────────
  const handleDetection = useCallback(async (dets: Detection[]) => {
    if (!config) return;

    // Filtrer par les classes du module
    const filtered = dets.filter(d => classMap[d.class]);
    if (!filtered.length) return;

    const now = new Date().toLocaleTimeString("fr-CA");

    setSession(prev => [
      ...filtered.map(d => ({
        label:   classMap[d.class]?.label ?? d.label,
        icon:    classMap[d.class]?.icon  ?? "📦",
        color:   classMap[d.class]?.color ?? d.color,
        score:   d.score,
        time:    now,
        alerted: classMap[d.class]?.alertOn ?? false,
        saved:   false,
      })),
      ...prev,
    ].slice(0, 100));

    // Sauvegarder dans Firebase
    const orgId = orgIdRef.current;
    const camId = camIdRef.current;
    if (orgId && camId && videoRef.current) {
      setSaving(true);
      for (const det of filtered) {
        const cls = classMap[det.class];
        if (!cls) continue;
        try {
          await runDetectionPipeline({
            organizationId: orgId, cameraId: camId,
            detection:      { ...det, label:cls.label, severity:cls.severity },
            videoElement:   videoRef.current,
          });
          setPipeLog(`✅ ${cls.label} → Firebase · ${now}`);
          setSession(prev => prev.map((s,i) => i===0 ? {...s, saved:true} : s));
        } catch {}
      }
      setSaving(false);
    }
  }, [config, classMap]);

  const { detections, isLoading, modelReady, fps } = useYoloDetection(videoRef, {
    mode:        aiOn && streaming ? "browser" : "off",
    fps:         8,
    confidence:  config ? Math.min(...config.classes.map(c => c.confidence)) : 0.50,
    voteFrames:  2,
    onDetection: handleDetection,
  });

  const moduleDetections = detections.filter(d => classMap[d.class]);

  // Stats calculées
  const statsValues = config?.stats.map(s => ({
    ...s, value: s.compute(session),
  })) ?? [];

  // Alertes actives
  const alerts = session.filter(s => s.alerted).slice(0, 5);

  // ── Module introuvable ────────────────────────────────────────────────────
  if (!config || !bundle) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 gap-4">
        <p className="text-4xl">❓</p>
        <p className="text-slate-400">Module "{moduleId}" introuvable</p>
        <Link href="/modules" className="rounded-lg bg-brand px-5 py-2 text-sm text-white">
          ← Retour aux modules
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-950/95 backdrop-blur px-6 py-3">
        <div className="flex items-center gap-3">
          <Link href="/modules" className="text-slate-400 hover:text-white text-sm">← Modules</Link>
          <span className="text-slate-700">·</span>
          <span className="text-xl">{bundle.icon}</span>
          <div>
            <h1 className="text-sm font-semibold text-white leading-none">{config.name}</h1>
            <p className="text-xs text-slate-500">{config.sector}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {aiOn && modelReady && streaming && (
            <span className="rounded-full border border-emerald-700 bg-emerald-900/20 px-2 py-0.5 text-xs text-emerald-400">
              🤖 {fps}fps · {moduleDetections.length} obj
            </span>
          )}
          {saving && (
            <span className="rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 text-xs text-brand">
              💾 Sauvegarde...
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-3">
        {/* Colonne gauche — vidéo */}
        <div className="lg:col-span-2 space-y-3">
          {/* Flux vidéo */}
          <div className="relative aspect-video overflow-hidden rounded-xl bg-black border border-slate-800">
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            <DetectionOverlay detections={moduleDetections} videoRef={videoRef} />

            {/* Badge LIVE */}
            {streaming && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                <span className="text-xs font-medium">{config.name}</span>
              </div>
            )}

            {/* IA status */}
            {streaming && (
              <div className="absolute bottom-3 right-3 rounded-lg bg-black/70 px-2 py-1 text-xs">
                {isLoading
                  ? <span className="text-brand flex gap-1"><span className="h-3 w-3 animate-spin rounded-full border border-brand border-t-transparent"/>Chargement IA...</span>
                  : modelReady
                  ? <span className="text-emerald-400">🎯 {moduleDetections.length} détection(s)</span>
                  : <span className="text-slate-500">IA en attente</span>}
              </div>
            )}

            {/* Alertes */}
            {alerts.length > 0 && (
              <div className="absolute top-3 right-3 space-y-1">
                {alerts.slice(0,3).map((a,i) => (
                  <div key={i} className="flex items-center gap-1.5 rounded-full bg-red-900/80 border border-red-700 px-2 py-0.5">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                    <span className="text-xs text-red-300">{a.icon} {a.label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Écran d'accueil si pas de stream */}
            {!streaming && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80">
                <span className="text-6xl">{bundle.icon}</span>
                <p className="text-white font-semibold">{config.name}</p>
                <p className="text-slate-400 text-sm text-center max-w-xs">{config.description}</p>
                <div className="flex gap-3">
                  <button onClick={() => { setFacing("environment"); startCamera("environment"); }}
                    className="flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white"
                    style={{ background: bundle.color }}>
                    📷 Caméra arrière
                  </button>
                  <button onClick={() => { setFacing("user"); startCamera("user"); }}
                    className="rounded-xl border border-slate-600 px-5 py-3 text-sm text-slate-300">
                    🤳 Avant
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Contrôles */}
          {streaming && (
            <div className="flex gap-2 flex-wrap items-center">
              <button onClick={() => { setFacing("environment"); startCamera("environment"); }}
                className={`rounded-lg border px-3 py-2 text-xs font-medium ${facing==="environment"?"border-brand bg-brand/10 text-brand":"border-slate-700 text-slate-400"}`}>
                📷 Arrière
              </button>
              <button onClick={() => { setFacing("user"); startCamera("user"); }}
                className={`rounded-lg border px-3 py-2 text-xs font-medium ${facing==="user"?"border-brand bg-brand/10 text-brand":"border-slate-700 text-slate-400"}`}>
                🤳 Avant
              </button>
              <button onClick={() => setAiOn(!aiOn)}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${aiOn?"border-emerald-700 bg-emerald-900/20 text-emerald-400":"border-slate-700 text-slate-400"}`}>
                🤖 IA {aiOn ? "ON" : "OFF"}
              </button>
              <button onClick={() => { streamRef.current?.getTracks().forEach(t=>t.stop()); setStreaming(false); setAiOn(false); }}
                className="ml-auto rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-500">
                ⏹ Arrêter
              </button>
            </div>
          )}

          {/* Log */}
          <div className={`rounded-lg border px-3 py-2 text-xs font-mono ${
            pipeLog.startsWith("✅") ? "border-emerald-800 bg-emerald-900/10 text-emerald-400"
            : pipeLog.startsWith("❌") ? "border-red-800 bg-red-900/10 text-red-400"
            : pipeLog.startsWith("⚠️") ? "border-amber-800 bg-amber-900/10 text-amber-400"
            : "border-slate-800 bg-slate-900 text-slate-400"
          }`}>
            {pipeLog}
          </div>

          {/* Note YOLOv11 */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs text-slate-500">
            ℹ️ {config.browserNote}
          </div>
        </div>

        {/* Colonne droite */}
        <div className="space-y-3">
          {/* Tabs */}
          <div className="flex gap-1 rounded-lg bg-slate-900 p-1">
            {(["live","stats","tips"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 rounded-md py-2 text-xs font-medium transition-colors ${tab===t?"bg-brand text-white":"text-slate-400 hover:text-white"}`}>
                {t==="live"?"🔴 Live":t==="stats"?"📊 Stats":"💡 Tips"}
              </button>
            ))}
          </div>

          {/* LIVE */}
          {tab === "live" && (
            <>
              {/* Classes actives */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <h3 className="mb-3 text-xs font-semibold text-slate-400">
                  CLASSES DÉTECTÉES ({config.classes.length})
                </h3>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {config.classes.map(cls => {
                    const active = moduleDetections.some(d => d.class === cls.cocoClass);
                    return (
                      <div key={cls.cocoClass}
                        className={`flex items-center gap-2 rounded-lg px-2 py-2 transition-all ${
                          active
                            ? "border border-slate-700 bg-slate-800"
                            : "opacity-50"
                        }`}
                        style={active ? { borderColor: cls.color + "40", background: cls.color + "10" } : {}}>
                        <span className="text-xl shrink-0">{cls.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white truncate">{cls.label}</p>
                          <p className="text-xs text-slate-500 truncate">{cls.description}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {cls.alertOn && <span className="text-xs">🚨</span>}
                          {active && <span className="h-2 w-2 rounded-full animate-pulse" style={{background:cls.color}}/>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Session */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <div className="mb-3 flex justify-between items-center">
                  <h3 className="text-xs font-semibold text-slate-400">SESSION ({session.length})</h3>
                  {session.length > 0 && (
                    <button onClick={() => setSession([])} className="text-xs text-slate-600 hover:text-slate-400">Effacer</button>
                  )}
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {session.length === 0 ? (
                    <p className="text-xs text-slate-600 text-center py-3">
                      {!streaming ? "Démarrez la caméra ↑" : "Aucune détection pour ce module"}
                    </p>
                  ) : session.slice(0, 15).map((s, i) => (
                    <div key={i} className={`flex items-center gap-2 rounded px-2 py-1.5 ${s.alerted?"bg-red-900/20":""}`}>
                      <span>{s.icon}</span>
                      <span className="flex-1 text-xs text-white truncate">{s.label}</span>
                      <span className="text-xs font-medium shrink-0" style={{color:s.color}}>
                        {Math.round(s.score*100)}%
                      </span>
                      <span className="text-xs text-slate-600 shrink-0">{s.time}</span>
                      <span className="text-xs shrink-0">{s.saved ? "✅" : "⏳"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* STATS */}
          {tab === "stats" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {statsValues.map(s => (
                  <div key={s.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                    <p className="text-xs text-slate-500 mb-1">{s.icon} {s.label}</p>
                    <p className="text-2xl font-bold" style={{color:s.color}}>{s.value}</p>
                  </div>
                ))}
              </div>
              {session.length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-2">
                  <h3 className="text-xs font-semibold text-slate-400">VOIR LES DONNÉES</h3>
                  {[
                    { href:"/events",       label:"🚨 Events générés" },
                    { href:"/ai-detection", label:"🤖 Toutes les détections" },
                    { href:"/analytics",    label:"📊 Analytics" },
                    { href:"/notifications",label:"🔔 Notifications" },
                  ].map(l => (
                    <Link key={l.href} href={l.href}
                      className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2 text-xs text-slate-300 hover:text-brand">
                      {l.label} <span>→</span>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}

          {/* TIPS */}
          {tab === "tips" && (
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <h3 className="mb-3 text-xs font-semibold text-slate-400">CONSEILS</h3>
                <div className="space-y-2">
                  {config.tips.map((tip,i) => (
                    <p key={i} className="flex items-start gap-2 text-xs text-slate-400">
                      <span className="text-brand mt-0.5 shrink-0">•</span>{tip}
                    </p>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <h3 className="mb-3 text-xs font-semibold text-slate-400">MODÈLES IA</h3>
                {bundle.models.map(m => (
                  <div key={m} className="flex items-center gap-2 mb-2 text-xs">
                    <span className="text-emerald-400">✓</span>
                    <span className="text-slate-300 font-medium">{m}</span>
                  </div>
                ))}
              </div>
              <Link href="/marketplace"
                className="flex items-center justify-center gap-2 w-full rounded-xl border border-brand/30 bg-brand/5 py-3 text-sm text-brand hover:bg-brand/10">
                🧩 Configurer dans Marketplace →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
