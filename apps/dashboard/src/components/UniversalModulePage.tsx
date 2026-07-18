"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  collection, query, orderBy, limit, getDocs,
  onSnapshot, doc, setDoc, updateDoc,
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
  id: string; name: string; icon: string; color: string;
  sector: string; plan: string; status: string;
  tagline: string; description: string; browserNote: string;
  aiModels: string[];
  detections: ModuleDetectionClass[];
  locations: { cat: string; locs: string[] }[];
  analyticsKPIs: { id:string; label:string; icon:string; unit:string }[];
  reports: { id:string; label:string; icon:string; freq:string }[];
}

interface FirestoreEvent {
  id:string; label:string; severity:string; category?:string;
  createdAt:string; videoClipUrl?:string; thumbnailUrl?:string; acknowledged?:boolean;
}
interface FirestoreNotif {
  id:string; title:string; body:string; severity:string; createdAt:string; read:boolean;
}

type Tab = "camera"|"ai"|"events"|"notifications"|"analytics"|"reports";

const TABS: { id:Tab; label:string; icon:string }[] = [
  { id:"camera",        label:"Caméra",       icon:"📷" },
  { id:"ai",            label:"AI Détection", icon:"🤖" },
  { id:"events",        label:"Events",       icon:"🚨" },
  { id:"notifications", label:"Notifs",       icon:"🔔" },
  { id:"analytics",     label:"Analytics",    icon:"📊" },
  { id:"reports",       label:"Rapports",     icon:"📄" },
];

const SEV_COLOR = (s:string) =>
  s==="critical"?"#EF4444":s==="warning"?"#F59E0B":"#64748B";

const formatDate = (iso:string) => {
  try { return new Date(iso).toLocaleString("fr-CA",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}); }
  catch { return iso?.slice(0,16)??"-"; }
};

// ── Composant ─────────────────────────────────────────────────────────────────
export function UniversalModulePage({ config }: { config: ModulePageConfig }) {
  const router = useRouter();

  // Refs — ne causent pas de re-render
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream|null>(null);
  const orgRef    = useRef<string|null>(null);
  const camRef    = useRef<string|null>(null);
  const unsubsRef = useRef<(()=>void)[]>([]);

  // State caméra
  const [facing,    setFacing]    = useState<"user"|"environment">("environment");
  const [streaming, setStreaming] = useState(false);
  const [aiOn,      setAiOn]      = useState(false);
  const [log,       setLog]       = useState("▶ Démarrez la caméra pour commencer");
  const [orgId,     setOrgId]     = useState<string|null>(null);
  const [showPicker,setShowPicker]= useState(false);
  const [location,  setLocation]  = useState<string|null>(null);

  // State tabs
  const [tab, setTab] = useState<Tab>("camera");
  const [liveDets, setLiveDets] = useState<{
    label:string; icon:string; severity:string; time:string; score:number;
  }[]>([]);
  const [events,  setEvents]  = useState<FirestoreEvent[]>([]);
  const [notifs,  setNotifs]  = useState<FirestoreNotif[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Init org au montage ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    checkSetup().then(s => {
      if (cancelled) return;
      if (s.organizationId) { orgRef.current = s.organizationId; setOrgId(s.organizationId); }
    });
    return () => {
      cancelled = true;
      // Nettoyer le stream
      streamRef.current?.getTracks().forEach(t => t.stop());
      // Nettoyer tous les listeners Firestore
      unsubsRef.current.forEach(u => u());
      unsubsRef.current = [];
    };
  }, []);

  // ── Charger Events + Notifs quand orgId disponible ────────────────────────
  useEffect(() => {
    if (!orgId) return;

    // Nettoyer les anciens listeners
    unsubsRef.current.forEach(u => u());
    unsubsRef.current = [];

    // Events — query simple sans index composite
    const evUnsub = onSnapshot(
      query(
        collection(db,"organizations",orgId,"events"),
        orderBy("createdAt","desc"),
        limit(50)
      ),
      snap => setEvents(snap.docs.map(d => ({ id:d.id, ...d.data() } as FirestoreEvent))),
      err => {
        // Fallback sans orderBy si index manquant
        getDocs(collection(db,"organizations",orgId,"events"))
          .then(snap => {
            const docs = snap.docs.map(d=>({id:d.id,...d.data()}as FirestoreEvent));
            docs.sort((a,b) => (b.createdAt??"").localeCompare(a.createdAt??""));
            setEvents(docs.slice(0,50));
          })
          .catch(()=>{});
      }
    );

    // Notifications
    const notifUnsub = onSnapshot(
      query(
        collection(db,"organizations",orgId,"notifications"),
        orderBy("createdAt","desc"),
        limit(30)
      ),
      snap => setNotifs(snap.docs.map(d => ({ id:d.id, ...d.data() } as FirestoreNotif))),
      () => {}
    );

    unsubsRef.current = [evUnsub, notifUnsub];
    return () => {
      unsubsRef.current.forEach(u => u());
      unsubsRef.current = [];
    };
  }, [orgId]);

  // ── Démarrer caméra ────────────────────────────────────────────────────────
  async function startCam(face: "user"|"environment" = facing) {
    try {
      streamRef.current?.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode:face, width:{ideal:1280}, height:{ideal:720} },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setStreaming(true);

      // Init org si pas encore fait
      let org = orgRef.current;
      if (!org) {
        const r = await quickSetup(config.name);
        org = r.organizationId;
        orgRef.current = org;
        setOrgId(org);
      }

      // Créer la caméra
      if (org && !camRef.current) {
        const name = location
          ? `${config.name} — ${location}`
          : `${config.name} Caméra`;
        const id = await createCameraDirectly({
          organizationId: org, name,
          brand: "WebRTC", connector: "phone_webcam",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          location: location ?? config.name,
        });
        camRef.current = id;
        setLog(`✅ ${name} — flux actif`);
      } else {
        setLog(`✅ ${location ?? config.name} — flux actif`);
      }
    } catch(e:any) {
      const msg = e.name==="NotAllowedError"
        ? "❌ Permission caméra refusée — autorisez dans les paramètres"
        : `❌ ${e.message}`;
      setLog(msg);
    }
  }

  async function toggleFacing() {
    const next = facing==="environment" ? "user" : "environment";
    setFacing(next);
    if (streaming) await startCam(next);
  }

  function stopCam() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStreaming(false);
    setAiOn(false);
    setLog("Caméra arrêtée");
  }

  // ── Enregistrement ─────────────────────────────────────────────────────────
  const { startClip, recording, uploading, lastLog: clipLog } = useMediaRecorder(videoRef);

  async function handleRecord() {
    if (!streaming) { setLog("❌ Démarrez la caméra d'abord"); return; }
    if (recording || uploading) return;
    const org = orgRef.current;
    const cam = camRef.current;
    if (!org || !cam) { setLog("❌ Caméra non initialisée"); return; }

    const now = new Date().toISOString();
    const evId = doc(collection(db,"_")).id;
    try {
      await setDoc(doc(db,"organizations",org,"events",evId), {
        id:evId, organizationId:org, cameraId:cam, siteId:"default",
        detectionIds:[], primaryType:"manual_recording", category:"manual",
        label:`Enregistrement ${config.name}`, severity:"info",
        durationSeconds:0, thumbnailUrl:null, videoClipUrl:null,
        clipStatus:"recording", acknowledged:false, createdAt:now, updatedAt:now,
      });
      setLog("🔴 Enregistrement 15s en cours...");
      const result = await startClip({ organizationId:org, cameraId:cam, eventId:evId, durationSec:15 });
      if (result) setLog(`✅ Clip ${result.durationSeconds}s (${result.sizeKb}KB) → Storage`);
      else setLog("⚠️ Enregistrement terminé");
    } catch(e:any) { setLog(`❌ ${e.message}`); }
  }

  // ── Détection IA ──────────────────────────────────────────────────────────
  const classMap = useRef(
    Object.fromEntries(config.detections.map(c => [c.cocoClass, c]))
  ).current;

  const handleDetection = useCallback(async (dets: Detection[]) => {
    const modDets = dets.filter(d => classMap[d.class]);
    if (!modDets.length) return;

    const time = new Date().toLocaleTimeString("fr-CA");
    setLiveDets(prev => [
      ...modDets.map(d => {
        const mc = classMap[d.class];
        return { label:mc?.label??d.label, icon:mc?.icon??"📦", severity:mc?.severity??"info", time, score:d.score };
      }),
      ...prev,
    ].slice(0, 80));

    const first = classMap[modDets[0].class];
    setLog(`${first?.icon??""} ${first?.label??modDets[0].label} — ${time}`);

    const org = orgRef.current;
    const cam = camRef.current;
    if (!org || !cam || !videoRef.current) return;

    for (const det of modDets.slice(0, 3)) {
      const mc = classMap[det.class];
      if (!mc?.sendToEvents) continue;
      try {
        const result = await runDetectionPipeline({
          organizationId: org, cameraId: cam,
          detection: { ...det, label:mc.label, severity:mc.severity, category:mc.category },
          videoElement: videoRef.current,
        });
        if (result?.eventId && result.eventId !== "error"
            && !recording && videoRef.current?.srcObject
            && (mc.severity==="critical" || mc.severity==="warning")) {
          startClip({ organizationId:org, cameraId:cam, eventId:result.eventId, durationSec:12 });
        }
      } catch {}
    }
  }, [classMap, recording, startClip]);

  const { detections, isLoading, modelReady, fps } = useYoloDetection(videoRef, {
    mode: aiOn && streaming ? "browser" : "off",
    fps: 8, confidence:0.42, voteFrames:2,
    onDetection: handleDetection,
  });

  const visibleDets = detections.filter(d => classMap[d.class]);

  // ── Render ────────────────────────────────────────────────────────────────

  const unreadEvents = events.filter(e => !e.acknowledged).length;
  const unreadNotifs = notifs.filter(n => !n.read).length;

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-white">

      {/* Picker emplacement */}
      {showPicker && (
        <ModuleLocationPicker
          moduleId={config.id} moduleName={config.name}
          moduleIcon={config.icon} moduleColor={config.color}
          onConfirm={loc => {
            setLocation(loc.name);
            setShowPicker(false);
            camRef.current = null;
            startCam(facing);
          }}
          onSkip={() => { setShowPicker(false); startCam(facing); }}
        />
      )}

      {/* ── HEADER ── */}
      <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href="/modules"
            className="flex items-center justify-center h-8 w-8 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:border-slate-600 transition-colors">
            ←
          </Link>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xl"
            style={{background:`${config.color}20`, border:`1px solid ${config.color}40`}}>
            {config.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-white leading-none">{config.name}</h1>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {location ? `📍 ${location}` : config.tagline}
            </p>
          </div>
          {streaming && (
            <div className="shrink-0 flex items-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500"/>
              {aiOn && modelReady && <span className="text-xs text-emerald-400">{fps}fps</span>}
              {recording && <span className="text-xs font-bold text-red-400">REC</span>}
            </div>
          )}
        </div>

        {/* Tabs — scrollable horizontalement */}
        <div className="flex gap-0.5 px-3 pb-2 overflow-x-auto scrollbar-none">
          {TABS.map(t => {
            const badge = t.id==="events" ? unreadEvents : t.id==="notifications" ? unreadNotifs : 0;
            return (
              <button key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition-all ${
                  tab===t.id ? "text-white" : "text-slate-500 hover:text-slate-300"
                }`}
                style={tab===t.id ? {background:`${config.color}20`, color:config.color} : {}}>
                <span>{t.icon}</span>
                <span>{t.label}</span>
                {badge > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                    style={{background:config.color}}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── CONTENU ── */}
      <div className="flex-1 p-4 space-y-4">

        {/* ══════════════════════════════════════════════════
            📷 TAB CAMÉRA
        ══════════════════════════════════════════════════ */}
        {tab === "camera" && <>

          {/* Flux vidéo */}
          <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-900 border border-slate-800">
            <video ref={videoRef} autoPlay playsInline muted
              className="h-full w-full object-cover"/>
            <DetectionOverlay detections={visibleDets} videoRef={videoRef}/>

            {streaming && <>
              <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500"/>
                <span className="text-xs text-white font-medium">LIVE · {location ?? config.name}</span>
              </div>
              <div className="absolute top-3 right-3 rounded-full bg-black/70 px-2.5 py-1 text-xs text-slate-300">
                {facing==="user" ? "🤳 Avant" : "📷 Arrière"}
              </div>
              {aiOn && (
                <div className="absolute bottom-3 right-3 rounded-lg bg-black/70 px-2.5 py-1.5 text-xs">
                  {isLoading
                    ? <span className="text-amber-400">⏳ Chargement modèle...</span>
                    : modelReady
                    ? <span className="text-emerald-400">🎯 {visibleDets.length} obj · {fps}fps</span>
                    : <span className="text-slate-500">Modèle IA en attente</span>}
                </div>
              )}
            </>}

            {recording && (
              <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full border border-red-600 bg-red-900/80 px-3 py-1.5">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-400"/>
                <span className="text-xs font-bold text-red-300">🔴 ENREGISTREMENT</span>
              </div>
            )}

            {!streaming && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/90">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl text-5xl"
                  style={{background:`${config.color}20`, border:`2px solid ${config.color}40`}}>
                  {config.icon}
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-white">{config.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{config.tagline}</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowPicker(true)}
                    className="rounded-xl px-5 py-2.5 text-sm font-bold text-white"
                    style={{background:config.color}}>
                    📍 Choisir l'emplacement
                  </button>
                  <button onClick={() => startCam()}
                    className="rounded-xl border border-slate-600 bg-slate-800 px-5 py-2.5 text-sm font-bold text-white hover:border-slate-400">
                    ▶ Démarrer
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Boutons de contrôle ── */}
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
                className="flex items-center justify-center gap-2 rounded-xl border border-red-700 bg-red-900/20 py-3 text-sm font-bold text-red-400 hover:bg-red-900/30">
                ⏹ Arrêter
              </button>
            )}

            {/* Toggle avant / arrière */}
            <button onClick={toggleFacing}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-3 text-sm font-bold text-white hover:border-slate-500 transition-colors">
              {facing==="environment" ? "🤳 Vue avant" : "📷 Vue arrière"}
            </button>

            {/* Enregistrer */}
            <button onClick={handleRecord}
              disabled={!streaming || uploading}
              className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-colors disabled:opacity-40 ${
                recording
                  ? "border border-red-500 bg-red-900/20 text-red-300"
                  : "bg-red-600 text-white hover:bg-red-700"
              }`}>
              {recording
                ? <><span className="h-2 w-2 animate-pulse rounded-full bg-red-400"/>⏹ Arrêter clip</>
                : uploading ? <><span className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white"/>Upload...</>
                : "🔴 Enregistrer"}
            </button>

            {/* IA ON/OFF */}
            <button onClick={() => setAiOn(!aiOn)}
              disabled={!streaming}
              className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-colors disabled:opacity-40 ${
                aiOn ? "text-white" : "border border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500"
              }`}
              style={aiOn ? {background:config.color} : {}}>
              🤖 IA {aiOn ? "ON" : "OFF"}
            </button>

            {/* Emplacement */}
            <button onClick={() => setShowPicker(true)}
              className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900 py-2.5 text-xs text-slate-400 hover:text-white hover:border-slate-600 transition-colors">
              📍 {location ? `Emplacement: ${location}` : "Choisir l'emplacement de la caméra"}
            </button>
          </div>

          {/* Log */}
          <div className={`rounded-xl border px-4 py-3 text-xs font-mono leading-relaxed ${
            log.startsWith("✅") ? "border-emerald-800 bg-emerald-900/10 text-emerald-400"
            : log.startsWith("❌") ? "border-red-800 bg-red-900/10 text-red-400"
            : log.startsWith("🔴") ? "border-red-700 bg-red-900/20 text-red-300"
            : log.startsWith("⚠️") ? "border-amber-800 bg-amber-900/10 text-amber-400"
            : "border-slate-800 bg-slate-900/50 text-slate-500"
          }`}>
            {clipLog || log}
          </div>

          {/* Classes de détection */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5">
              <h3 className="text-xs font-bold text-slate-400">
                DÉTECTIONS MODULE — {config.detections.length} CLASSES
              </h3>
              <span className="text-xs text-slate-600">{config.browserNote.slice(0,40)}...</span>
            </div>
            <div className="grid grid-cols-2 gap-px bg-slate-800">
              {config.detections.map(cls => {
                const live = visibleDets.some(d => d.class===cls.cocoClass);
                return (
                  <div key={cls.id}
                    className={`flex items-center gap-2.5 p-2.5 transition-colors ${
                      live ? "bg-slate-800" : "bg-slate-900"
                    }`}>
                    <span className="text-xl shrink-0">{cls.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{cls.label}</p>
                      <p className="text-xs font-medium" style={{color:SEV_COLOR(cls.severity)}}>
                        {cls.severity==="critical"?"🔴 Critique":cls.severity==="warning"?"🟡 Alerte":"ℹ️ Info"}
                      </p>
                    </div>
                    {live && <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-400"/>}
                    {cls.alertOn && !live && <span className="text-xs text-red-500 shrink-0">🚨</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Note navigateur */}
          <div className="rounded-xl border border-amber-800/30 bg-amber-900/10 p-3">
            <p className="text-xs text-amber-400 leading-relaxed">
              ℹ️ {config.browserNote}
            </p>
          </div>

          {/* Modèles IA du module */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h3 className="text-xs font-bold text-slate-400 mb-3">🤖 MODÈLES IA — {config.name.toUpperCase()}</h3>
            <div className="flex flex-wrap gap-1.5">
              {config.aiModels.map(m => (
                <span key={m}
                  className="rounded-full border px-2.5 py-1 text-xs font-medium"
                  style={{borderColor:`${config.color}40`, color:config.color, background:`${config.color}10`}}>
                  {m}
                </span>
              ))}
            </div>
          </div>
        </>}

        {/* ══════════════════════════════════════════════════
            🤖 TAB AI DÉTECTION
        ══════════════════════════════════════════════════ */}
        {tab === "ai" && <>
          {/* Mini flux si streaming */}
          {streaming && (
            <div className="relative aspect-video overflow-hidden rounded-xl bg-black border border-slate-800">
              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover"/>
              <DetectionOverlay detections={visibleDets} videoRef={videoRef}/>
              <div className="absolute bottom-2 right-2 rounded-lg bg-black/70 px-2 py-1 text-xs">
                {isLoading ? <span className="text-amber-400">⏳ Chargement IA...</span>
                 : modelReady ? <span className="text-emerald-400">🎯 {visibleDets.length} · {fps}fps</span>
                 : <span className="text-slate-500">IA inactive</span>}
              </div>
            </div>
          )}

          {!streaming && (
            <div className="rounded-xl border border-slate-800 bg-slate-900 py-10 text-center">
              <p className="text-4xl mb-3">🤖</p>
              <p className="text-sm font-semibold text-white mb-1">Caméra inactive</p>
              <p className="text-xs text-slate-500 mb-4">Démarrez la caméra pour activer la détection IA</p>
              <button onClick={() => setTab("camera")}
                className="rounded-xl px-5 py-2.5 text-sm font-bold text-white"
                style={{background:config.color}}>
                📷 Aller à la caméra →
              </button>
            </div>
          )}

          {/* Compteurs */}
          <div className="grid grid-cols-3 gap-2">
            {[
              {label:"Détections", value:liveDets.length,                                           color:"text-white"},
              {label:"Alertes",    value:liveDets.filter(d=>d.severity!=="info").length,            color:"text-amber-400"},
              {label:"Critiques",  value:liveDets.filter(d=>d.severity==="critical").length,        color:"text-red-400"},
            ].map(k => (
              <div key={k.label} className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-center">
                <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Bouton IA */}
          {streaming && (
            <button onClick={() => setAiOn(!aiOn)}
              className={`w-full rounded-xl py-3 text-sm font-bold transition-colors ${
                aiOn ? "text-white" : "border border-slate-700 bg-slate-900 text-slate-300"
              }`}
              style={aiOn ? {background:config.color} : {}}>
              🤖 IA {aiOn ? "ACTIVE — Cliquer pour désactiver" : "INACTIVE — Cliquer pour activer"}
            </button>
          )}

          {/* Log live */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5">
              <h3 className="text-xs font-bold text-slate-400">DÉTECTIONS EN TEMPS RÉEL ({liveDets.length})</h3>
              {liveDets.length > 0 && (
                <button onClick={() => setLiveDets([])} className="text-xs text-slate-600 hover:text-slate-400">
                  Effacer
                </button>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-800">
              {liveDets.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-600">
                  {streaming && aiOn ? "Aucune détection du module actif" : "Activez l'IA pour détecter"}
                </p>
              ) : liveDets.map((d,i) => (
                <div key={i}
                  className={`flex items-center gap-3 px-4 py-2.5 ${
                    d.severity==="critical"?"bg-red-900/15":d.severity==="warning"?"bg-amber-900/10":""
                  }`}>
                  <span className="text-xl shrink-0">{d.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{d.label}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-medium" style={{color:SEV_COLOR(d.severity)}}>
                        {d.severity==="critical"?"🔴 Critique":d.severity==="warning"?"🟡 Alerte":"ℹ️ Info"}
                      </span>
                      <span className="text-xs text-slate-600">{Math.round(d.score*100)}% · {d.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>}

        {/* ══════════════════════════════════════════════════
            🚨 TAB EVENTS
        ══════════════════════════════════════════════════ */}
        {tab === "events" && <>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">
              🚨 Events — {events.length} total
              {unreadEvents > 0 && <span className="ml-2 text-amber-400">· {unreadEvents} non-lus</span>}
            </h2>
            <Link href="/events" className="text-xs text-brand hover:underline">Voir tout →</Link>
          </div>

          {events.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900 py-12 text-center">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-sm font-semibold text-white mb-1">Aucun event</p>
              <p className="text-xs text-slate-500 mb-4">Activez la caméra + IA pour créer des events</p>
              <button onClick={() => setTab("camera")} className="rounded-xl px-5 py-2 text-sm font-bold text-white" style={{background:config.color}}>
                📷 Démarrer la caméra →
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
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xl"
                      style={{background:`${SEV_COLOR(ev.severity)}20`}}>
                      {ev.severity==="critical"?"🚨":ev.severity==="warning"?"⚠️":"ℹ️"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{ev.label}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-semibold" style={{color:SEV_COLOR(ev.severity)}}>
                          {ev.severity==="critical"?"Critique":ev.severity==="warning"?"Alerte":"Info"}
                        </span>
                        <span className="text-xs text-slate-600">{formatDate(ev.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {ev.videoClipUrl && <span title="Clip disponible" className="text-brand">🎬</span>}
                      {ev.thumbnailUrl && <span title="Capture" className="text-slate-500">📷</span>}
                      {!ev.acknowledged && orgId && (
                        <button onClick={() =>
                          updateDoc(doc(db,"organizations",orgId,"events",ev.id),{acknowledged:true}).catch(()=>{})
                        }
                          className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-500 hover:border-emerald-700 hover:text-emerald-400">
                          ✓ Lu
                        </button>
                      )}
                    </div>
                  </div>
                  {ev.videoClipUrl && (
                    <video src={ev.videoClipUrl} controls
                      className="mt-3 w-full rounded-lg max-h-48 bg-black"/>
                  )}
                </div>
              ))}
            </div>
          )}
        </>}

        {/* ══════════════════════════════════════════════════
            🔔 TAB NOTIFICATIONS
        ══════════════════════════════════════════════════ */}
        {tab === "notifications" && <>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">
              🔔 Notifications — {unreadNotifs > 0 ? `${unreadNotifs} non-lues` : "toutes lues"}
            </h2>
            {unreadNotifs > 0 && orgId && (
              <button onClick={() => {
                notifs.filter(n=>!n.read).forEach(n =>
                  updateDoc(doc(db,"organizations",orgId,"notifications",n.id),{read:true}).catch(()=>{})
                );
              }} className="text-xs text-brand hover:underline">
                Tout marquer lu
              </button>
            )}
          </div>

          {notifs.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900 py-12 text-center">
              <p className="text-4xl mb-3">🔕</p>
              <p className="text-sm font-semibold text-white">Aucune notification</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifs.map(n => (
                <div key={n.id}
                  className={`flex items-start gap-3 rounded-xl border p-3.5 transition-all ${
                    !n.read ? "border-slate-700 bg-slate-900" : "border-slate-800 bg-slate-950 opacity-50"
                  }`}>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xl"
                    style={{background:`${SEV_COLOR(n.severity)}20`}}>
                    {n.severity==="critical"?"🚨":n.severity==="warning"?"⚠️":"ℹ️"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{n.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{n.body}</p>
                    <p className="text-xs text-slate-600 mt-1">{formatDate(n.createdAt)}</p>
                  </div>
                  {!n.read && orgId && (
                    <button onClick={() =>
                      updateDoc(doc(db,"organizations",orgId,"notifications",n.id),{read:true}).catch(()=>{})
                    }
                      className="shrink-0 h-2.5 w-2.5 rounded-full mt-1"
                      style={{background:config.color}}/>
                  )}
                </div>
              ))}
            </div>
          )}
        </>}

        {/* ══════════════════════════════════════════════════
            📊 TAB ANALYTICS
        ══════════════════════════════════════════════════ */}
        {tab === "analytics" && <>
          <h2 className="text-sm font-bold text-white">📊 Analytics — {config.name}</h2>
          <div className="grid grid-cols-2 gap-3">
            {config.analyticsKPIs.map(kpi => {
              const value =
                kpi.id==="total_events"    ? events.length
                : kpi.id==="critical_alerts" ? events.filter(e=>e.severity==="critical").length
                : kpi.id==="clips"           ? events.filter(e=>e.videoClipUrl).length
                : kpi.id==="session_dets"    ? liveDets.length
                : "—";
              return (
                <div key={kpi.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <span className="text-3xl block mb-2">{kpi.icon}</span>
                  <p className="text-xs text-slate-500 mb-1 leading-tight">{kpi.label}</p>
                  <p className="text-2xl font-bold" style={{color:config.color}}>{value}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{kpi.unit}</p>
                </div>
              );
            })}
          </div>

          {/* Emplacements */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h3 className="text-xs font-bold text-slate-400 mb-3">
              📍 EMPLACEMENTS CAMÉRA RECOMMANDÉS
            </h3>
            <div className="space-y-3">
              {config.locations.map(cat => (
                <div key={cat.cat}>
                  <p className="text-xs font-semibold text-slate-500 mb-1.5">{cat.cat}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {cat.locs.map(loc => (
                      <button key={loc}
                        onClick={() => setLocation(loc)}
                        className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                          location===loc
                            ? "text-white font-semibold"
                            : "border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-500 hover:text-white"
                        }`}
                        style={location===loc ? {borderColor:config.color, background:`${config.color}20`, color:config.color} : {}}>
                        {loc}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>}

        {/* ══════════════════════════════════════════════════
            📄 TAB RAPPORTS
        ══════════════════════════════════════════════════ */}
        {tab === "reports" && <>
          <h2 className="text-sm font-bold text-white">📄 Rapports — {config.name}</h2>
          <div className="rounded-xl border border-amber-800/30 bg-amber-900/10 p-3 text-xs text-amber-400">
            📋 Génération PDF/Excel automatique disponible après déploiement du serveur Python (Railway)
          </div>
          <div className="space-y-2">
            {config.reports.map(r => (
              <div key={r.id}
                className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-2xl">
                  {r.icon}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">{r.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {r.freq==="daily"?"Quotidien":r.freq==="weekly"?"Hebdomadaire":r.freq==="monthly"?"Mensuel":r.freq==="on_event"?"Déclenché par event":"À la demande"}
                  </p>
                </div>
                <button
                  onClick={() => setLog(`📄 Génération ${r.label} — disponible avec serveur Python`)}
                  className="shrink-0 rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:border-brand hover:text-brand transition-colors">
                  Générer
                </button>
              </div>
            ))}
          </div>
        </>}

      </div>
    </div>
  );
}
