"use client";

import { useEffect, useState, useRef } from "react";
import {
  collection, query, orderBy, limit,
  onSnapshot, doc, updateDoc, getDocs, where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useOrganization } from "@/lib/context/OrganizationContext";
import { PageHeader } from "@/components/PageHeader";
import { CATEGORY_LABELS } from "@/lib/detection/classMap";
import type { VGCategory } from "@/lib/detection/classMap";
import Link from "next/link";

interface EventDoc {
  id:              string;
  primaryType:     string;
  label:           string;
  category:        VGCategory;
  severity:        "critical" | "warning" | "info";
  cameraId:        string;
  detectionIds:    string[];
  durationSeconds: number;
  thumbnailUrl?:   string;
  videoClipUrl?:   string;
  clipStatus?:     "recording" | "ready" | "failed";
  acknowledged:    boolean;
  createdAt:       string;
  updatedAt:       string;
}

interface DetectionDoc {
  id:          string;
  label:       string;
  confidence:  number;
  detectedAt:  string;
  snapshotUrl?: string;
  severity:    string;
}

const SEV = {
  critical: { border:"border-l-red-500",   badge:"bg-red-900/20 text-red-400 border-red-800",     dot:"bg-red-500",   label:"Critique" },
  warning:  { border:"border-l-amber-500", badge:"bg-amber-900/20 text-amber-400 border-amber-800", dot:"bg-amber-500", label:"Alerte"   },
  info:     { border:"border-l-slate-600", badge:"bg-slate-800 text-slate-400 border-slate-700",   dot:"bg-slate-500", label:"Info"      },
};

// ── Lecteur vidéo ────────────────────────────────────────────────────────────
function VideoPlayer({ url, thumbnail, clipStatus }: { url?: string; thumbnail?: string; clipStatus?: "recording" | "ready" | "failed" }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  if (!url) {
    const isRecording = clipStatus === "recording";
    const isFailed    = clipStatus === "failed";

    return (
      <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">
        {thumbnail ? (
          <img src={thumbnail} alt="snapshot" className="h-full w-full object-cover opacity-60" />
        ) : null}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
          {isRecording ? (
            <>
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
                <span className="text-sm font-medium text-red-400">REC</span>
              </span>
              <p className="text-xs text-slate-300">Clip en cours d&apos;enregistrement...</p>
              <p className="text-xs text-slate-500">12 secondes · Firebase Storage</p>
            </>
          ) : isFailed ? (
            <>
              <span className="text-3xl">⚠️</span>
              <p className="text-xs text-amber-400">Clip non disponible</p>
              <p className="text-xs text-slate-500">Firebase Storage non configuré</p>
            </>
          ) : (
            <>
              <span className="text-3xl">📷</span>
              <p className="text-xs text-slate-400">Pas de clip pour cet événement</p>
              <p className="text-xs text-slate-600">
                Activez l&apos;IA sur <Link href="/cameras/phone" className="text-brand underline">Caméra Phone</Link> pour générer des clips
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-video overflow-hidden rounded-xl bg-black border border-slate-800">
      <video
        ref={videoRef}
        src={url}
        poster={thumbnail}
        controls
        preload="metadata"
        className="h-full w-full"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      {/* Badge */}
      <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        <span className="text-xs text-white font-medium">CLIP</span>
      </div>
    </div>
  );
}

// ── Timeline des détections ──────────────────────────────────────────────────
function DetectionTimeline({ orgId, detectionIds }: { orgId: string; detectionIds: string[] }) {
  const [detections, setDetections] = useState<DetectionDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!detectionIds?.length) { setLoading(false); return; }
    getDocs(
      query(
        collection(db, "organizations", orgId, "detections"),
        where("__name__", "in", detectionIds.slice(0, 10)),
      )
    ).then((snap) => {
      const docs = snap.docs
        .map((d) => ({ id:d.id, ...d.data() } as DetectionDoc))
        .sort((a,b) => a.detectedAt.localeCompare(b.detectedAt));
      setDetections(docs);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [orgId, detectionIds?.join(",")]);

  if (loading) return <div className="h-4 w-full animate-pulse rounded bg-slate-800" />;
  if (!detections.length) return <p className="text-xs text-slate-600">Aucune détection liée</p>;

  return (
    <div className="space-y-1.5">
      {detections.map((d, i) => (
        <div key={d.id} className="flex items-center gap-3">
          {/* Timeline */}
          <div className="flex flex-col items-center shrink-0">
            <div className={`h-2 w-2 rounded-full ${
              d.severity === "critical" ? "bg-red-500" : d.severity === "warning" ? "bg-amber-500" : "bg-slate-500"
            }`} />
            {i < detections.length - 1 && <div className="w-0.5 h-5 bg-slate-800 mt-0.5" />}
          </div>
          {/* Snapshot miniature */}
          {d.snapshotUrl && (
            <img src={d.snapshotUrl} alt={d.label}
              className="h-8 w-12 shrink-0 rounded object-cover border border-slate-700" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white">{d.label}</p>
            <p className="text-xs text-slate-600">
              {new Date(d.detectedAt).toLocaleTimeString("fr-CA")} ·{" "}
              {Math.round(d.confidence * 100)}%
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Page principale ──────────────────────────────────────────────────────────
export default function EventsPage() {
  const { currentOrg } = useOrganization();
  const [events,   setEvents]   = useState<EventDoc[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState<EventDoc | null>(null);
  const [filter,   setFilter]   = useState<"all"|"open"|"critical">("all");

  useEffect(() => {
    if (!currentOrg?.id) { setLoading(false); return; }
    const q = query(
      collection(db, "organizations", currentOrg.id, "events"),
      orderBy("createdAt", "desc"),
      limit(50),
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id:d.id, ...d.data() } as EventDoc));
      setEvents(docs);
      // Auto-sélectionner le premier event si aucun sélectionné
      if (docs.length > 0 && !selected) setSelected(docs[0]);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [currentOrg?.id]);

  // Mettre à jour selected quand Firestore met à jour (ex: videoClipUrl arrive)
  useEffect(() => {
    if (selected) {
      const updated = events.find((e) => e.id === selected.id);
      if (updated) setSelected(updated);
    }
  }, [events]);

  async function acknowledge(ev: EventDoc) {
    if (!currentOrg?.id) return;
    await updateDoc(doc(db, "organizations", currentOrg.id, "events", ev.id), {
      acknowledged: true,
      acknowledgedAt: new Date().toISOString(),
    });
  }

  const filtered = events.filter((e) =>
    filter === "open"     ? !e.acknowledged :
    filter === "critical" ? e.severity === "critical" :
    true
  );

  const critical = events.filter(e => e.severity === "critical" && !e.acknowledged).length;
  const open     = events.filter(e => !e.acknowledged).length;
  const withClip = events.filter(e => e.videoClipUrl).length;

  return (
    <div>
      <PageHeader title="Events" description="Événements détectés — Firestore live · Clips vidéo" />

      {/* Stats */}
      <div className="mb-5 grid grid-cols-4 gap-3">
        {[
          { label:"Total",          value: events.length, color:"text-white"       },
          { label:"Critiques",      value: critical,      color:"text-red-400"     },
          { label:"Ouverts",        value: open,          color:"text-amber-400"   },
          { label:"Avec clip vidéo",value: withClip,      color:"text-brand"       },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <p className="text-xs text-slate-500">{k.label}</p>
            <p className={`mt-1 text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="mb-4 flex gap-2">
        {(["all","open","critical"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f ? "bg-brand border-brand text-white" : "border-slate-700 text-slate-400 hover:text-white"
            }`}>
            {f === "all" ? `Tous (${events.length})` : f === "open" ? `Ouverts (${open})` : `Critiques (${critical})`}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <span className="text-sm text-slate-400">Chargement Firestore...</span>
        </div>
      )}

      {!loading && !currentOrg && (
        <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center">
          <p className="text-3xl mb-3">🚨</p>
          <p className="text-slate-400 mb-4">Aucune organisation configurée</p>
          <Link href="/cameras/phone" className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium">
            → Caméra Phone
          </Link>
        </div>
      )}

      {!loading && currentOrg && events.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center">
          <p className="text-3xl mb-3">🚨</p>
          <p className="text-slate-400 mb-2">Aucun event</p>
          <p className="text-xs text-slate-600 mb-4">Active l'IA sur la caméra pour générer des événements</p>
          <Link href="/cameras/phone" className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium">
            📱 Aller à la caméra →
          </Link>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="flex gap-4">
          {/* Liste des events */}
          <div className="w-80 shrink-0 space-y-2 overflow-y-auto" style={{maxHeight:"70vh"}}>
            {filtered.map((ev) => {
              const s      = SEV[ev.severity] ?? SEV.info;
              const catDef = CATEGORY_LABELS[ev.category] ?? { icon:"📦", color:"#64748B" };
              const isSelected = selected?.id === ev.id;

              return (
                <button key={ev.id} onClick={() => setSelected(ev)}
                  className={`w-full rounded-xl border-l-4 border text-left p-3 transition-all ${s.border} ${
                    isSelected ? "border-brand bg-brand/5" : "border-slate-800 bg-slate-900 hover:border-slate-700"
                  } ${ev.acknowledged ? "opacity-50" : ""}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-lg">{catDef.icon}</span>
                    <span className="flex-1 text-sm font-medium text-white truncate">
                      {ev.label ?? ev.primaryType}
                    </span>
                    {ev.videoClipUrl && <span className="text-xs text-brand">🎬</span>}
                    {ev.acknowledged && <span className="text-xs text-slate-600">✓</span>}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${s.badge}`}>
                      {s.label}
                    </span>
                    <span className="text-xs text-slate-600">
                      {new Date(ev.createdAt).toLocaleTimeString("fr-CA")}
                    </span>
                  </div>
                  {ev.detectionIds?.length > 0 && (
                    <p className="mt-1 text-xs text-slate-600">
                      {ev.detectionIds.length} détection{ev.detectionIds.length > 1 ? "s" : ""} · {ev.durationSeconds}s
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Détail de l'event sélectionné */}
          {selected && (
            <div className="flex-1 min-w-0 space-y-4">
              {/* En-tête */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">
                    {CATEGORY_LABELS[selected.category]?.icon ?? "📦"}
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-white">{selected.label}</h2>
                    <p className="text-xs text-slate-500">
                      {CATEGORY_LABELS[selected.category]?.label} · {new Date(selected.createdAt).toLocaleString("fr-CA")}
                    </p>
                  </div>
                </div>
                {!selected.acknowledged && (
                  <button onClick={() => acknowledge(selected)}
                    className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-emerald-700 hover:text-emerald-400">
                    ✓ Acquitter
                  </button>
                )}
              </div>

              {/* Lecteur vidéo */}
              <VideoPlayer url={selected.videoClipUrl} thumbnail={selected.thumbnailUrl} clipStatus={selected.clipStatus} />

              {/* Infos + Timeline */}
              <div className="grid grid-cols-2 gap-4">
                {/* Infos */}
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <h3 className="mb-3 text-xs font-semibold text-slate-400">DÉTAILS</h3>
                  <div className="space-y-2 text-xs">
                    {[
                      ["Sévérité",    SEV[selected.severity]?.label ?? selected.severity],
                      ["Durée",       `${selected.durationSeconds}s`],
                      ["Détections",  selected.detectionIds?.length ?? 1],
                      ["Clip vidéo",  selected.videoClipUrl ? "✅ Disponible" : "⏳ En attente"],
                      ["Snapshot",    selected.thumbnailUrl ? "✅ Disponible" : "—"],
                      ["Statut",      selected.acknowledged ? "✅ Acquitté" : "🔴 Ouvert"],
                    ].map(([l, v]) => (
                      <div key={l as string} className="flex justify-between">
                        <span className="text-slate-500">{l}</span>
                        <span className="text-slate-300">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Timeline détections */}
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <h3 className="mb-3 text-xs font-semibold text-slate-400">
                    TIMELINE ({selected.detectionIds?.length ?? 0} détections)
                  </h3>
                  {currentOrg?.id && selected.detectionIds?.length > 0 ? (
                    <DetectionTimeline
                      orgId={currentOrg.id}
                      detectionIds={selected.detectionIds}
                    />
                  ) : (
                    <p className="text-xs text-slate-600">Aucune détection liée</p>
                  )}
                </div>
              </div>

              {/* Snapshots de l'event */}
              {selected.thumbnailUrl && (
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <h3 className="mb-3 text-xs font-semibold text-slate-400">SNAPSHOT</h3>
                  <img src={selected.thumbnailUrl} alt={selected.label}
                    className="rounded-lg border border-slate-700 max-h-48 object-contain" />
                </div>
              )}

              {/* Liens */}
              <div className="flex gap-2">
                <a href={`https://console.firebase.google.com/project/ai-guard-vision-8ef41/firestore/data/organizations/${currentOrg?.id}/events/${selected.id}`}
                  target="_blank"
                  className="flex-1 rounded-lg border border-slate-700 py-2 text-center text-xs text-slate-400 hover:text-brand hover:border-brand">
                  Voir dans Firestore ↗
                </a>
                <Link href={`/cameras/${selected.cameraId}`}
                  className="flex-1 rounded-lg border border-slate-700 py-2 text-center text-xs text-slate-400 hover:text-brand hover:border-brand">
                  Voir la caméra →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
