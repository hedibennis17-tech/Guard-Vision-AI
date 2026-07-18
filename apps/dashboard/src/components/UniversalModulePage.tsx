"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  collection, query, where, orderBy, limit,
  onSnapshot, doc, setDoc, updateDoc, deleteDoc, getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useYoloDetection, type Detection } from "@/lib/hooks/useYoloDetection";
import { useMediaRecorder } from "@/lib/hooks/useMediaRecorder";
import { runDetectionPipeline } from "@/lib/services/pipelineService";
import { checkSetup, quickSetup, createCameraDirectly } from "@/lib/services/setupService";
import { DetectionOverlay } from "@/components/DetectionOverlay";
import { ModuleLocationPicker } from "@/components/ModuleLocationPicker";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ModuleDetectionClass {
  id: string; cocoClass: string; label: string; icon: string;
  color: string; severity: "critical"|"warning"|"info";
  alertOn: boolean; category: string;
  sendToEvents: boolean; sendToNotif: boolean; description: string;
}

export interface ModulePageConfig {
  id:           string;
  name:         string;
  icon:         string;
  color:        string;
  sector:       string;
  tagline:      string;
  description:  string;
  plan:         string;  // "free" | "pro" | "enterprise"
  status:       string;  // "available" | "beta" | "coming_soon"
  browserNote:  string;
  detections:   ModuleDetectionClass[];
  locations:    { cat: string; locs: string[] }[];
  analyticsKPIs:{ id: string; label: string; icon: string; unit: string }[];
  reports:      { id: string; label: string; icon: string; freq: string }[];
  aiModels:     string[];
  extraTabs?:   { id: string; label: string; icon: string; content: React.ReactNode }[];
}

interface EventDoc {
  id: string; label: string; severity: string; category: string;
  createdAt: string; videoClipUrl?: string; thumbnailUrl?: string;
  acknowledged?: boolean;
}

interface NotifDoc {
  id: string; title: string; body: string; severity: string;
  createdAt: string; read: boolean;
}

// ── Composant principal ───────────────────────────────────────────────────────

export function UniversalModulePage({ config }: { config: ModulePageConfig }) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream|null>(null);
  const orgRef    = useRef<string|null>(null);
  const camRef    = useRef<string|null>(null);

  // Camera state
  const [facing,    setFacing]    = useState<"user"|"environment">("environment");
  const [streaming, setStreaming] = useState(false);
  const [aiOn,      setAiOn]      = useState(false);
  const [log,       setLog]       = useState("Appuyez sur Démarrer pour activer la caméra");
  const [orgId,     setOrgId]     = useState<string|null>(null);
  const [camId,     setCamId]     = useState<string|null>(null);
  const [location,  setLocation]  = useState<string|null>(null);
  const [showPicker,setShowPicker]= useState(false);

  // Tabs
  type Tab = "camera"|"ai"|"events"|"notifications"|"analytics"|"reports";
  const [tab, setTab] = useState<Tab>("camera");

  // Session live detections
  const [liveDetections, setLiveDetections] = useState<{
    label:string; icon:string; severity:string; time:string; score:number;
  }[]>([]);

  // Firestore data
  const [events, setEvents]   = useState<EventDoc[]>([]);
  const [notifs, setNotifs]   = useState<NotifDoc[]>([]);
  const [evLoading, setEvLoading] = useState(false);

  // Init
  useEffect(() => {
    checkSetup().then(s => {
      if (s.organizationId) { orgRef.current = s.organizationId; setOrgId(s.organizationId); }
    });
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  // Charger Events + Notifs quand orgId est connu
  useEffect(() => {
    if (!orgId) return;
    setEvLoading(true);

    // Events
    const evUnsub = onSnapshot(
      query(collection(db,"organizations",orgId,"events"),
        where("cameraId","in",[camId ?? "","none"]),
        orderBy("createdAt","desc"), limit(50)),
      snap => { setEvents(snap.docs.map(d=>({id:d.id,...d.data()}as EventDoc))); setEvLoading(false); },
      // Fallback sans filtre cameraId
      () => {
        getDocs(query(collection(db,"organizations",orgId,"events"),
          orderBy("createdAt","desc"), limit(50)))
          .then(snap => setEvents(snap.docs.map(d=>({id:d.id,...d.data()}as EventDoc))))
          .finally(() => setEvLoading(false));
      }
    );

    // Notifications
    const notifUnsub = onSnapshot(
      query(collection(db,"organizations",orgId,"notifications"),
        orderBy("createdAt","desc"), limit(30)),
      snap => setNotifs(snap.docs.map(d=>({id:d.id,...d.data()}as NotifDoc))),
      () => {}
    );

    return () => { evUnsub(); notifUnsub(); };
  }, [orgId, camId]);

  // ── Caméra ──────────────────────────────────────────────────────────────────

  async function startCam(face:"user"|"environment" = facing) {
    try {
      streamRef.current?.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: face, width:{ideal:1280}, height:{ideal:720} }, audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setStreaming(true);

      let org = orgRef.current;
      if (!org) {
        const r = await quickSetup(config.name);
        org = r.organizationId;
        orgRef.current = org;
        setOrgId(org);
      }
      if (org && !camRef.current) {
        const name = location ? `${config.name} — ${location}` : `${config.name} Caméra`;
        const id = await createCameraDirectly({
          organizationId: org, name, brand:"WebRTC",
          connector:"phone_webcam",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          location: location ?? config.name,
        });
        camRef.current = id;
        setCamId(id);
        setLog(`✅ ${name} — prêt`);
      } else {
        setLog(`✅ ${location ?? config.name} — flux actif`);
      }
    } catch(e:any) {
      const msg = e.name==="NotAllowedError" ? "Permission caméra refusée" : e.message;
      setLog(`❌ ${msg}`);
    }
  }

  async function toggleFacing() {
    const next = facing==="environment" ? "user" : "environment";
    setFacing(next);
    if (streaming) await startCam(next);
  }

  function stopCam() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    setStreaming(false); setAiOn(false);
    if (videoRef.current) videoRef.current.srcObject = null;
    setLog("Caméra arrêtée");
  }

  // ── Enregistrement ──────────────────────────────────────────────────────────

  const { startClip, recording, uploading, lastLog: clipLog } = useMediaRecorder(videoRef);

  async function handleRecord() {
    if (recording || !orgRef.current || !camRef.current) {
      if (!streaming) setLog("❌ Démarrez la caméra d'abord");
      return;
    }
    try {
      const now = new Date().toISOString();
      const evId = doc(collection(db,"_")).id;
      await setDoc(doc(db,"organizations",orgRef.current,"events",evId), {
        id:evId, organizationId:orgRef.current, cameraId:camRef.current,
        siteId:"default", detectionIds:[], primaryType:"manual_recording",
        category:"manual", label:`Enregistrement ${config.name}`,
        severity:"info", durationSeconds:0, thumbnailUrl:null, videoClipUrl:null,
        clipStatus:"recording", acknowledged:false, createdAt:now, updatedAt:now,
      });
      setLog("🔴 Enregistrement 15s...");
      const result = await startClip({
        organizationId: orgRef.current,
        cameraId:       camRef.current,
        eventId:        evId,
        durationSec:    15,
      });
      if (result) setLog(`✅ Clip ${result.durationSeconds}s (${result.sizeKb}KB) → Firebase Storage`);
      else         setLog("⚠️ Enregistrement terminé sans clip");
    } catch(e:any) { setLog(`❌ ${e.message}`); }
  }

  // ── Détection ────────────────────────────────────────────────────────────────

  const classMap = Object.fromEntries(
    config.detections.map(c => [c.cocoClass, c])
  );

  const handleDetection = useCallback(async (dets: Detection[]) => {
    const modDets = dets.filter(d => classMap[d.class]);
    if (!modDets.length) return;

    const time = new Date().toLocaleTimeString("fr-CA");
    setLiveDetections(prev => [
      ...modDets.map(d => {
        const mc = classMap[d.class];
        return { label:mc?.label??d.label, icon:mc?.icon??"📦", severity:mc?.severity??"info", time, score:d.score };
      }),
      ...prev,
    ].slice(0, 60));

    const first = classMap[modDets[0].class];
    setLog(`${first?.icon??""} ${first?.label??modDets[0].label} — ${time}`);

    const org = orgRef.current;
    const cam = camRef.current;
    if (!org || !cam || !videoRef.current) return;

    for (const det of modDets) {
      const mc = classMap[det.class];
      if (!mc?.sendToEvents) continue;
      try {
        const result = await runDetectionPipeline({
          organizationId: org, cameraId: cam,
          detection: { ...det, label:mc.label, severity:mc.severity, category:mc.category },
          videoElement: videoRef.current,
        });
        if (result?.eventId && result.eventId !== "error" && !recording
            && videoRef.current?.srcObject
            && (mc.severity==="critical" || mc.severity==="warning")) {
          startClip({ organizationId:org, cameraId:cam, eventId:result.eventId, durationSec:12 });
        }
      } catch {}
    }
  }, [classMap, recording, startClip]);

  const { detections, isLoading, modelReady, fps } = useYoloDetection(videoRef, {
    mode:        aiOn && streaming ? "browser" : "off",
    fps:         8, confidence:0.42, voteFrames:2,
    onDetection: handleDetection,
  });

  const visibleDetections = detections.filter(d => classMap[d.class]);

  // ── Helpers UI ───────────────────────────────────────────────────────────────

  const severityColor = (s:string) =>
    s==="critical" ? "#EF4444" : s==="warning" ? "#F59E0B" : "#64748B";

  const formatDate = (iso:string) => {
    try { return new Date(iso).toLocaleString("fr-CA",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}); }
    catch { return iso; }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const TABS: { id: Tab; label: string; icon: string; badge?: number }[] = [
    { id:"camera",        label:"Caméra",         icon:"📷" },
    { id:"ai",            label:"AI Détection",   icon:"🤖", badge:liveDetections.length },
    { id:"events",        label:"Events",         icon:"🚨", badge:events.filter(e=>!e.acknowledged).length },
    { id:"notifications", label:"Notifs",         icon:"🔔", badge:notifs.filter(n=>!n.read).length },
    { id:"analytics",     label:"Analytics",      icon:"📊" },
    { id:"reports",       label:"Rapports",       icon:"📄" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* Picker emplacement */}
      {showPicker && (
        <ModuleLocationPicker
          moduleId={config.id} moduleName={config.name}
          moduleIcon={config.icon} moduleColor={config.color}
          onConfirm={loc => {
            setLocation(loc.name);
            setShowPicker(false);
            camRef.current = null; // forcer recréation avec bon nom
            startCam(facing);
          }}
          onSkip={() => { setShowPicker(false); startCam(facing); }}
        />
      )}

      {/* ── Header ── */}
      <div className="border-b border-slate-800 bg-slate-900/50 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/modules" className="text-slate-400 hover:text-white text-lg">←</Link>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
            style={{background:`${config.color}20`, border:`1px solid ${config.color}40`}}>
            {config.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white truncate">{config.name}</h1>
              <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium"
                style={{color:config.color, borderColor:`${config.color}50`, background:`${config.color}15`}}>
                {config.status==="available"?"✅ Disponible":config.status==="beta"?"🧪 Bêta":"🔜 Bientôt"}
              </span>
            </div>
            <p className="text-xs text-slate-500 truncate">{location ? `📍 ${location}` : config.tagline}</p>
          </div>
          {streaming && modelReady && aiOn && (
            <span className="shrink-0 text-xs text-emerald-400">{fps}fps</span>
          )}
          {recording && (
            <span className="shrink-0 flex items-center gap-1 rounded-full border border-red-700 bg-red-900/20 px-2 py-0.5 text-xs text-red-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500"/>REC
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 mt-3 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`relative flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                tab===t.id ? "text-white" : "text-slate-500 hover:text-slate-300"
              }`}
              style={tab===t.id ? {background:`${config.color}20`, color:config.color} : {}}>
              {t.icon} {t.label}
              {t.badge ? (
                <span className="ml-1 rounded-full px-1.5 py-0.5 text-xs font-bold text-white"
                  style={{background:config.color}}>{t.badge}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">

        {/* ════════════════════════════════════════════════════════════
            TAB: CAMÉRA
        ════════════════════════════════════════════════════════════ */}
        {tab === "camera" && (
          <>
            {/* Flux vidéo */}
            <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-900 border border-slate-800">
              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover"/>
              <DetectionOverlay detections={visibleDetections} videoRef={videoRef}/>

              {streaming && (
                <>
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-red-500"/>
                    <span className="text-xs text-white font-medium">LIVE · {location ?? config.name}</span>
                  </div>
                  <div className="absolute top-3 right-3 rounded-full bg-black/70 px-2.5 py-1 text-xs text-slate-300">
                    {facing==="user" ? "🤳 Avant" : "📷 Arrière"}
                  </div>
                  {aiOn && (
                    <div className="absolute bottom-3 right-3 rounded-lg bg-black/70 px-2.5 py-1.5 text-xs">
                      {isLoading ? <span className="text-amber-400">⏳ Chargement IA...</span>
                       : modelReady ? <span className="text-emerald-400">🎯 {visibleDetections.length} détection(s)</span>
                       : <span className="text-slate-500">Modèle en attente</span>}
                    </div>
                  )}
                </>
              )}

              {recording && (
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-red-900/90 border border-red-700 px-3 py-1">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-400"/>
                  <span className="text-xs text-red-300 font-bold">🔴 REC EN COURS</span>
                </div>
              )}

              {!streaming && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <span className="text-6xl">{config.icon}</span>
                  <p className="text-slate-400 text-sm">{config.tagline}</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowPicker(true)}
                      className="rounded-xl px-6 py-3 text-sm font-bold text-white"
                      style={{background:config.color}}>
                      📍 Choisir l'emplacement
                    </button>
                    <button
                      onClick={() => startCam()}
                      className="rounded-xl border border-slate-600 bg-slate-800 px-6 py-3 text-sm font-bold text-white">
                      ▶ Démarrer
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Boutons de contrôle ── */}
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {/* Démarrer / Arrêter */}
              {!streaming ? (
                <button onClick={() => startCam()}
                  className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white"
                  style={{background:config.color}}>
                  ▶ Démarrer la caméra
                </button>
              ) : (
                <button onClick={stopCam}
                  className="flex items-center justify-center gap-2 rounded-xl border border-red-700 bg-red-900/10 py-3 px-4 text-sm font-bold text-red-400">
                  ⏹ Arrêter
                </button>
              )}

              {/* 🔄 Vue avant / arrière */}
              <button onClick={toggleFacing}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-sm font-semibold text-white hover:border-slate-400 transition-colors">
                {facing==="environment" ? "🤳 Vue avant" : "📷 Vue arrière"}
              </button>

              {/* 🔴 Enregistrer */}
              <button onClick={handleRecord}
                disabled={!streaming || uploading}
                className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors disabled:opacity-40 ${
                  recording
                    ? "border border-red-500 bg-red-900/20 text-red-400"
                    : "bg-red-600 text-white hover:bg-red-700"
                }`}>
                {recording
                  ? <><span className="h-2 w-2 animate-pulse rounded-full bg-red-400"/>⏹ Arrêter clip</>
                  : uploading ? "⏳ Upload..."
                  : "🔴 Enregistrer"}
              </button>

              {/* 🤖 IA */}
              {streaming && (
                <button onClick={() => setAiOn(!aiOn)}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition-colors ${
                    aiOn ? "text-white" : "border-slate-600 bg-slate-800 text-slate-300"
                  }`}
                  style={aiOn ? {background:config.color, borderColor:config.color} : {}}>
                  🤖 IA {aiOn?"ON":"OFF"}
                </button>
              )}

              {/* 📍 Emplacement */}
              <button onClick={() => setShowPicker(true)}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-400 hover:text-white hover:border-slate-500 transition-colors">
                📍 {location ?? "Emplacement"}
              </button>
            </div>

            {/* Log */}
            <div className={`rounded-xl border px-4 py-3 text-xs font-mono ${
              log.startsWith("✅") ? "border-emerald-800 bg-emerald-900/10 text-emerald-400"
              : log.startsWith("❌") ? "border-red-800 bg-red-900/10 text-red-400"
              : log.startsWith("🔴") ? "border-red-700 bg-red-900/20 text-red-300"
              : "border-slate-800 bg-slate-900/50 text-slate-500"
            }`}>
              {clipLog || log}
            </div>

            {/* Note navigateur */}
            <div className="rounded-xl border border-amber-800/30 bg-amber-900/10 p-3 text-xs text-amber-400">
              ℹ️ {config.browserNote}
            </div>

            {/* Classes du module */}
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <h3 className="text-xs font-semibold text-slate-400 mb-3">
                CLASSES ACTIVES — {config.detections.length} DÉTECTIONS
              </h3>
              <div className="grid grid-cols-2 gap-1.5">
                {config.detections.map(cls => {
                  const isLive = visibleDetections.some(d => d.class===cls.cocoClass);
                  return (
                    <div key={cls.id}
                      className={`flex items-center gap-2 rounded-lg px-2.5 py-2 transition-all border ${
                        isLive ? "border-white/20 bg-slate-800" : "border-transparent"
                      }`}
                      style={isLive ? {borderColor:`${severityColor(cls.severity)}40`} : {}}>
                      <span className="text-base shrink-0">{cls.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{cls.label}</p>
                        <p className="text-xs truncate" style={{color:severityColor(cls.severity)}}>
                          {cls.severity==="critical"?"🔴 Critique":cls.severity==="warning"?"🟡 Alerte":"ℹ️ Info"}
                        </p>
                      </div>
                      {isLive && <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-400"/>}
                      {cls.alertOn && !isLive && <span className="text-xs text-red-400 shrink-0">🚨</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════
            TAB: AI DÉTECTION
        ════════════════════════════════════════════════════════════ */}
        {tab === "ai" && (
          <>
            {/* Mini-player */}
            {streaming && (
              <div className="relative aspect-video overflow-hidden rounded-xl bg-black border border-slate-800">
                <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover"/>
                <DetectionOverlay detections={visibleDetections} videoRef={videoRef}/>
                <div className="absolute bottom-2 right-2 text-xs text-emerald-400 bg-black/60 rounded px-2 py-1">
                  {modelReady ? `🎯 ${visibleDetections.length} obj · ${fps}fps` : "⏳ IA..."}
                </div>
              </div>
            )}

            {!streaming && (
              <div className="flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900 py-8">
                <div className="text-center">
                  <p className="text-3xl mb-2">🤖</p>
                  <p className="text-sm text-slate-400 mb-3">Démarrez la caméra pour détecter</p>
                  <button onClick={() => { setTab("camera"); startCam(); }}
                    className="rounded-xl px-4 py-2 text-sm font-bold text-white" style={{background:config.color}}>
                    ▶ Activer la caméra
                  </button>
                </div>
              </div>
            )}

            {/* Compteurs */}
            <div className="grid grid-cols-3 gap-3">
              {[
                {label:"Détections", value:liveDetections.length, color:"text-white"},
                {label:"Alertes", value:liveDetections.filter(d=>d.severity==="warning"||d.severity==="critical").length, color:"text-amber-400"},
                {label:"Critiques", value:liveDetections.filter(d=>d.severity==="critical").length, color:"text-red-400"},
              ].map(k=>(
                <div key={k.label} className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-center">
                  <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{k.label}</p>
                </div>
              ))}
            </div>

            {/* Log en temps réel */}
            <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5">
                <h3 className="text-xs font-semibold text-slate-400">DÉTECTIONS EN TEMPS RÉEL</h3>
                {liveDetections.length>0 && (
                  <button onClick={() => setLiveDetections([])} className="text-xs text-slate-600 hover:text-slate-400">Effacer</button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-800">
                {liveDetections.length === 0 ? (
                  <p className="text-xs text-slate-600 text-center py-8">
                    {streaming ? "Activez l'IA pour détecter" : "Démarrez la caméra"}
                  </p>
                ) : liveDetections.map((d,i) => (
                  <div key={i} className={`flex items-center gap-3 px-4 py-2.5 ${
                    d.severity==="critical"?"bg-red-900/15":d.severity==="warning"?"bg-amber-900/10":""
                  }`}>
                    <span className="text-xl shrink-0">{d.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{d.label}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-medium" style={{color:severityColor(d.severity)}}>
                          {d.severity==="critical"?"🔴 Critique":d.severity==="warning"?"🟡 Alerte":"ℹ️ Info"}
                        </span>
                        <span className="text-xs text-slate-600">{Math.round(d.score*100)}% · {d.time}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Boutons contextuels */}
            <div className="flex gap-2">
              {streaming ? (
                <button onClick={() => setAiOn(!aiOn)}
                  className={`flex-1 rounded-xl py-3 text-sm font-bold transition-colors ${aiOn?"text-white":"border border-slate-700 bg-slate-900 text-slate-300"}`}
                  style={aiOn?{background:config.color}:{}}>
                  🤖 IA {aiOn?"ON — Cliquer pour désactiver":"OFF — Cliquer pour activer"}
                </button>
              ) : (
                <button onClick={() => setTab("camera")}
                  className="flex-1 rounded-xl py-3 text-sm font-bold text-white" style={{background:config.color}}>
                  Aller à la caméra →
                </button>
              )}
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════
            TAB: EVENTS
        ════════════════════════════════════════════════════════════ */}
        {tab === "events" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">
                🚨 Events — {events.length} total · {events.filter(e=>!e.acknowledged).length} non-lus
              </h2>
              <Link href="/events" className="text-xs text-brand hover:underline">Voir tous →</Link>
            </div>

            {evLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent"/>
              </div>
            ) : events.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900 py-10 text-center">
                <p className="text-3xl mb-2">📭</p>
                <p className="text-sm text-slate-400">Aucun event — activez l'IA sur la caméra</p>
                <button onClick={() => setTab("camera")} className="mt-3 rounded-lg px-4 py-2 text-xs font-medium text-white" style={{background:config.color}}>
                  Aller à la caméra →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {events.map(ev => (
                  <div key={ev.id}
                    className={`rounded-xl border p-3.5 ${
                      ev.severity==="critical" ? "border-red-800/40 bg-red-900/10"
                      : ev.severity==="warning" ? "border-amber-800/40 bg-amber-900/10"
                      : "border-slate-800 bg-slate-900"
                    }`}>
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl text-xl"
                        style={{background:`${severityColor(ev.severity)}20`}}>
                        {ev.severity==="critical"?"🚨":ev.severity==="warning"?"⚠️":"ℹ️"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{ev.label}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-medium" style={{color:severityColor(ev.severity)}}>
                            {ev.severity==="critical"?"🔴 Critique":ev.severity==="warning"?"🟡 Alerte":"ℹ️ Info"}
                          </span>
                          <span className="text-xs text-slate-600">{formatDate(ev.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {ev.videoClipUrl && <span className="text-brand text-sm" title="Clip disponible">🎬</span>}
                        {ev.thumbnailUrl && <span className="text-slate-500 text-sm" title="Capture">📷</span>}
                        {!ev.acknowledged && (
                          <button
                            onClick={async () => {
                              if (!orgId) return;
                              await updateDoc(doc(db,"organizations",orgId,"events",ev.id),{acknowledged:true});
                            }}
                            className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-500 hover:border-emerald-700 hover:text-emerald-400">
                            ✓
                          </button>
                        )}
                        {ev.acknowledged && <span className="text-xs text-emerald-600">✓</span>}
                      </div>
                    </div>
                    {ev.videoClipUrl && (
                      <video src={ev.videoClipUrl} controls
                        className="mt-2 w-full rounded-lg max-h-40 bg-black"/>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════════
            TAB: NOTIFICATIONS
        ════════════════════════════════════════════════════════════ */}
        {tab === "notifications" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">
                🔔 Notifications — {notifs.filter(n=>!n.read).length} non-lues
              </h2>
              {notifs.length > 0 && (
                <button
                  onClick={async () => {
                    if (!orgId) return;
                    for (const n of notifs.filter(x=>!x.read)) {
                      await updateDoc(doc(db,"organizations",orgId,"notifications",n.id),{read:true});
                    }
                  }}
                  className="text-xs text-slate-500 hover:text-brand">
                  Tout lire
                </button>
              )}
            </div>

            {notifs.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900 py-10 text-center">
                <p className="text-3xl mb-2">🔕</p>
                <p className="text-sm text-slate-400">Aucune notification</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifs.map(n => (
                  <div key={n.id}
                    className={`flex items-start gap-3 rounded-xl border p-3.5 transition-colors ${
                      !n.read ? "border-slate-700 bg-slate-900" : "border-slate-800 bg-slate-950 opacity-60"
                    }`}>
                    <div className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl text-xl"
                      style={{background:`${severityColor(n.severity)}20`}}>
                      {n.severity==="critical"?"🚨":n.severity==="warning"?"⚠️":"ℹ️"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{n.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{n.body}</p>
                      <p className="text-xs text-slate-600 mt-1">{formatDate(n.createdAt)}</p>
                    </div>
                    {!n.read && (
                      <button
                        onClick={async () => {
                          if (!orgId) return;
                          await updateDoc(doc(db,"organizations",orgId,"notifications",n.id),{read:true});
                        }}
                        className="shrink-0 h-2 w-2 rounded-full mt-2"
                        style={{background:config.color}}/>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════════
            TAB: ANALYTICS
        ════════════════════════════════════════════════════════════ */}
        {tab === "analytics" && (
          <>
            <h2 className="text-sm font-semibold text-white mb-1">📊 Analytics — {config.name}</h2>
            <p className="text-xs text-slate-500 mb-4">Données de la session active + historique Firestore</p>
            <div className="grid grid-cols-2 gap-3">
              {config.analyticsKPIs.map(kpi => (
                <div key={kpi.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <span className="text-2xl block mb-2">{kpi.icon}</span>
                  <p className="text-xs text-slate-500 mb-1">{kpi.label}</p>
                  <p className="text-2xl font-bold" style={{color:config.color}}>
                    {kpi.id==="total_events"   ? events.length
                     :kpi.id==="critical_alerts"? events.filter(e=>e.severity==="critical").length
                     :kpi.id==="clips"          ? events.filter(e=>e.videoClipUrl).length
                     :kpi.id==="session_dets"   ? liveDetections.length
                     :"—"}
                  </p>
                  <p className="text-xs text-slate-600">{kpi.unit}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════
            TAB: RAPPORTS
        ════════════════════════════════════════════════════════════ */}
        {tab === "reports" && (
          <>
            <div className="rounded-xl border border-amber-800/30 bg-amber-900/10 p-3 text-xs text-amber-400 mb-4">
              📄 Génération PDF/Excel disponible après déploiement du serveur Python
            </div>
            <div className="space-y-2">
              {config.reports.map(r => (
                <div key={r.id} className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl text-2xl bg-slate-800">
                    {r.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{r.label}</p>
                    <p className="text-xs text-slate-500">
                      {r.freq==="daily"?"Quotidien":r.freq==="weekly"?"Hebdomadaire":r.freq==="monthly"?"Mensuel":r.freq==="on_event"?"À chaque événement":"À la demande"}
                    </p>
                  </div>
                  <button
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:border-brand hover:text-brand transition-colors"
                    onClick={() => alert(`Génération ${r.label} — disponible avec serveur Python déployé`)}>
                    Générer
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
