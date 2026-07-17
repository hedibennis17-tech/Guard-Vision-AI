"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  collection, query, orderBy, limit,
  onSnapshot, doc, updateDoc, deleteDoc,
  getDocs, where, getDoc,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase/client";
import { useOrganization } from "@/lib/context/OrganizationContext";
import { useAuth } from "@/lib/context/AuthContext";
import { CATEGORY_LABELS } from "@/lib/detection/classMap";
import type { VGCategory } from "@/lib/detection/classMap";
import Link from "next/link";

interface EventDoc {
  id:              string;
  primaryType:     string;
  label:           string;
  category:        VGCategory;
  severity:        "critical"|"warning"|"info";
  cameraId:        string;
  detectionIds:    string[];
  durationSeconds: number;
  thumbnailUrl?:   string;
  videoClipUrl?:   string;
  acknowledged:    boolean;
  createdAt:       string;
  updatedAt:       string;
}

interface DetectionItem {
  id:          string;
  label:       string;
  confidence:  number;
  detectedAt:  string;
  snapshotUrl?: string;
  severity:    string;
}

const SEV = {
  critical: { border:"border-l-red-500",   badge:"bg-red-900/20 text-red-400 border-red-800",     dot:"bg-red-500",    label:"Critique" },
  warning:  { border:"border-l-amber-500", badge:"bg-amber-900/20 text-amber-400 border-amber-800",dot:"bg-amber-500",  label:"Alerte"   },
  info:     { border:"border-l-slate-600", badge:"bg-slate-800 text-slate-400 border-slate-700",   dot:"bg-slate-500",  label:"Info"     },
};

// ── Lecteur vidéo ─────────────────────────────────────────────────────────────
function VideoPlayer({ url, thumbnail }: { url?:string; thumbnail?:string }) {
  if (!url) return (
    <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center gap-2">
      {thumbnail
        ? <img src={thumbnail} alt="snapshot" className="absolute inset-0 h-full w-full object-cover opacity-50"/>
        : null}
      <span className="relative z-10 text-3xl">🎬</span>
      <p className="relative z-10 text-xs text-slate-500">Clip non disponible</p>
      <p className="relative z-10 text-xs text-slate-600">
        Active l'IA sur{" "}
        <Link href="/cameras/phone" className="text-brand hover:underline">Caméra Phone</Link>
        {" "}pour générer des clips
      </p>
    </div>
  );
  return (
    <div className="relative aspect-video overflow-hidden rounded-xl bg-black border border-slate-800">
      <video src={url} poster={thumbnail} controls preload="metadata" className="h-full w-full"/>
      <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500"/>
        <span className="text-xs text-white font-medium">CLIP</span>
      </div>
    </div>
  );
}

// ── Timeline détections ───────────────────────────────────────────────────────
function DetectionTimeline({ orgId, detectionIds }: { orgId:string; detectionIds:string[] }) {
  const [items,   setItems]   = useState<DetectionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!detectionIds?.length) { setLoading(false); return; }
    const ids = detectionIds.slice(0,10);
    getDocs(query(
      collection(db,"organizations",orgId,"detections"),
      where("__name__","in",ids)
    )).then(snap=>{
      setItems(snap.docs.map(d=>({id:d.id,...d.data()}as DetectionItem))
        .sort((a,b)=>a.detectedAt.localeCompare(b.detectedAt)));
      setLoading(false);
    }).catch(()=>setLoading(false));
  }, [orgId, detectionIds?.join(",")]);

  if (loading) return <div className="h-4 w-full animate-pulse rounded bg-slate-800"/>;
  if (!items.length) return <p className="text-xs text-slate-600">Aucune détection liée</p>;

  return (
    <div className="space-y-2">
      {items.map((d,i)=>(
        <div key={d.id} className="flex items-center gap-2">
          <div className="flex flex-col items-center shrink-0">
            <div className={`h-2 w-2 rounded-full ${d.severity==="critical"?"bg-red-500":d.severity==="warning"?"bg-amber-500":"bg-slate-500"}`}/>
            {i<items.length-1&&<div className="w-0.5 h-4 bg-slate-800 mt-0.5"/>}
          </div>
          {d.snapshotUrl&&(
            <img src={d.snapshotUrl} alt={d.label}
              className="h-8 w-12 shrink-0 rounded object-cover border border-slate-700"/>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white">{d.label}</p>
            <p className="text-xs text-slate-600">
              {new Date(d.detectedAt).toLocaleTimeString("fr-CA")} · {Math.round(d.confidence*100)}%
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Modale de confirmation suppression ────────────────────────────────────────
function DeleteModal({ event, onConfirm, onCancel }: {
  event:     EventDoc;
  onConfirm: ()=>void;
  onCancel:  ()=>void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-red-800/50 bg-slate-900 p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-900/20 border border-red-800 text-2xl">🗑️</div>
          <div>
            <p className="font-semibold text-white">Supprimer cet event ?</p>
            <p className="text-xs text-slate-500">Cette action est irréversible</p>
          </div>
        </div>
        <div className="mb-5 rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-400">
          <p className="font-medium text-white mb-1">{event.label}</p>
          <p>{new Date(event.createdAt).toLocaleString("fr-CA")}</p>
          {event.videoClipUrl && <p className="text-amber-400 mt-1">⚠️ Le clip vidéo sera aussi supprimé</p>}
          {event.thumbnailUrl  && <p className="text-amber-400">⚠️ Le snapshot sera aussi supprimé</p>}
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-700 py-2.5 text-sm text-slate-300 hover:border-slate-500">
            Annuler
          </button>
          <button onClick={onConfirm}
            className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700">
            🗑️ Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function EventsPage() {
  const { currentOrg } = useOrganization();
  const { profile }    = useAuth();

  const [events,   setEvents]   = useState<EventDoc[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState<EventDoc|null>(null);
  const [filter,   setFilter]   = useState<"all"|"open"|"critical">("all");
  const [toDelete, setToDelete] = useState<EventDoc|null>(null);
  const [deleting, setDeleting] = useState(false);

  // Charger les events — SANS limite pour voir tout l'historique
  useEffect(()=>{
    if(!currentOrg?.id){ setLoading(false); return; }
    const q = query(
      collection(db,"organizations",currentOrg.id,"events"),
      orderBy("createdAt","desc"),
      limit(200),   // historique complet
    );
    const unsub = onSnapshot(q, snap=>{
      const docs = snap.docs.map(d=>({id:d.id,...d.data()}as EventDoc));
      setEvents(docs);
      // Auto-sélectionner le premier si rien de sélectionné
      if(docs.length>0 && !selected) setSelected(docs[0]);
      setLoading(false);
    }, ()=>setLoading(false));
    return unsub;
  }, [currentOrg?.id]);

  // Sync selected avec les mises à jour Firestore (ex: clip qui arrive)
  useEffect(()=>{
    if(selected){
      const updated = events.find(e=>e.id===selected.id);
      if(updated) setSelected(updated);
    }
  }, [events]);

  async function acknowledge(ev: EventDoc){
    if(!currentOrg?.id) return;
    await updateDoc(doc(db,"organizations",currentOrg.id,"events",ev.id),{
      acknowledged:true, acknowledgedAt:new Date().toISOString(),
      acknowledgedBy:profile?.uid ?? "unknown",
    });
  }

  async function confirmDelete(){
    if(!toDelete || !currentOrg?.id) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db,"organizations",currentOrg.id,"events",toDelete.id));
      if(selected?.id===toDelete.id) setSelected(events.find(e=>e.id!==toDelete.id)??null);
      setToDelete(null);
    } finally { setDeleting(false); }
  }

  const filtered = events.filter(e=>
    filter==="open"     ? !e.acknowledged :
    filter==="critical" ? e.severity==="critical" :
    true
  );

  const critical = events.filter(e=>e.severity==="critical"&&!e.acknowledged).length;
  const open     = events.filter(e=>!e.acknowledged).length;
  const withClip = events.filter(e=>e.videoClipUrl).length;

  return (
    <div>
      {/* Modale suppression */}
      {toDelete && (
        <DeleteModal
          event={toDelete}
          onConfirm={confirmDelete}
          onCancel={()=>setToDelete(null)}
        />
      )}

      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Events</h1>
          <p className="mt-1 text-sm text-slate-400">
            Historique complet · Firestore live · {events.length} events
          </p>
        </div>
        {events.length > 0 && (
          <span className="rounded-xl border border-emerald-800/40 bg-emerald-900/10 px-3 py-1.5 text-xs text-emerald-400">
            ✅ {events.length} events chargés
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="mb-5 grid grid-cols-4 gap-3">
        {[
          { label:"Total",         value:events.length, color:"text-white"     },
          { label:"Critiques",     value:critical,      color:"text-red-400"   },
          { label:"Ouverts",       value:open,          color:"text-amber-400" },
          { label:"Clips vidéo",   value:withClip,      color:"text-brand"     },
        ].map(k=>(
          <div key={k.label} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <p className="text-xs text-slate-500">{k.label}</p>
            <p className={`mt-1 text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="mb-4 flex gap-2">
        {(["all","open","critical"]as const).map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${filter===f?"bg-brand border-brand text-white":"border-slate-700 text-slate-400 hover:text-white"}`}>
            {f==="all"?`Tous (${events.length})`:f==="open"?`Ouverts (${open})`:`Critiques (${critical})`}
          </button>
        ))}
      </div>

      {/* Chargement */}
      {loading && (
        <div className="flex items-center justify-center py-16 gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent"/>
          <span className="text-sm text-slate-400">Chargement de l'historique...</span>
        </div>
      )}

      {/* Vide */}
      {!loading && !currentOrg && (
        <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center">
          <p className="text-3xl mb-3">🚨</p>
          <p className="text-slate-400 mb-4">Connectez-vous pour voir vos events</p>
          <Link href="/login" className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium">→ Connexion</Link>
        </div>
      )}

      {!loading && currentOrg && events.length===0 && (
        <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center">
          <p className="text-3xl mb-3">🚨</p>
          <p className="text-slate-400 mb-2">Aucun event dans l'historique</p>
          <p className="text-xs text-slate-600 mb-4">Org: {currentOrg.name}</p>
          <Link href="/cameras/phone" className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium">
            📱 Activer la caméra →
          </Link>
        </div>
      )}

      {/* Contenu */}
      {!loading && filtered.length>0 && (
        <div className="flex gap-4">

          {/* Liste events */}
          <div className="w-80 shrink-0 space-y-1.5 overflow-y-auto" style={{maxHeight:"72vh"}}>
            {filtered.map(ev=>{
              const s      = SEV[ev.severity]??SEV.info;
              const catDef = CATEGORY_LABELS[ev.category]??{icon:"📦",color:"#64748B"};
              return (
                <div key={ev.id}
                  className={`rounded-xl border-l-4 border text-left p-3 cursor-pointer transition-all ${s.border} ${
                    selected?.id===ev.id?"border-brand bg-brand/5":"border-slate-800 bg-slate-900 hover:border-slate-700"
                  } ${ev.acknowledged?"opacity-60":""}`}
                  onClick={()=>setSelected(ev)}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-lg">{catDef.icon}</span>
                    <span className="flex-1 text-sm font-medium text-white truncate">{ev.label??ev.primaryType}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {ev.videoClipUrl&&<span className="text-xs text-brand">🎬</span>}
                      {ev.thumbnailUrl&&<span className="text-xs text-slate-500">📷</span>}
                      {ev.acknowledged&&<span className="text-xs text-slate-600">✓</span>}
                      {/* Bouton supprimer */}
                      <button
                        onClick={e=>{e.stopPropagation();setToDelete(ev);}}
                        className="ml-1 rounded p-0.5 text-slate-700 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                        title="Supprimer">
                        🗑️
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${s.badge}`}>{s.label}</span>
                    <span className="text-xs text-slate-600">
                      {new Date(ev.createdAt).toLocaleString("fr-CA",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}
                    </span>
                  </div>
                  {ev.detectionIds?.length>0&&(
                    <p className="mt-1 text-xs text-slate-600">
                      {ev.detectionIds.length} détection(s) · {ev.durationSeconds}s
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Détail event sélectionné */}
          {selected && (
            <div className="flex-1 min-w-0 space-y-4">

              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{CATEGORY_LABELS[selected.category]?.icon??"📦"}</span>
                  <div>
                    <h2 className="text-lg font-semibold text-white">{selected.label}</h2>
                    <p className="text-xs text-slate-500">
                      {CATEGORY_LABELS[selected.category]?.label} ·{" "}
                      {new Date(selected.createdAt).toLocaleString("fr-CA")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!selected.acknowledged&&(
                    <button onClick={()=>acknowledge(selected)}
                      className="rounded-lg border border-emerald-800 bg-emerald-900/10 px-4 py-2 text-sm text-emerald-400 hover:bg-emerald-900/20">
                      ✓ Acquitter
                    </button>
                  )}
                  <button onClick={()=>setToDelete(selected)}
                    className="rounded-lg border border-red-800 bg-red-900/10 px-4 py-2 text-sm text-red-400 hover:bg-red-900/20">
                    🗑️ Supprimer
                  </button>
                </div>
              </div>

              {/* Lecteur vidéo */}
              <VideoPlayer url={selected.videoClipUrl} thumbnail={selected.thumbnailUrl}/>

              {/* Détails + Timeline */}
              <div className="grid grid-cols-2 gap-4">
                {/* Infos */}
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <h3 className="mb-3 text-xs font-semibold text-slate-400">DÉTAILS</h3>
                  <div className="space-y-2 text-xs">
                    {[
                      ["Sévérité",    SEV[selected.severity]?.label??selected.severity],
                      ["Catégorie",   CATEGORY_LABELS[selected.category]?.label??selected.category],
                      ["Type",        selected.primaryType],
                      ["Durée",       `${selected.durationSeconds}s`],
                      ["Détections",  `${selected.detectionIds?.length??1}`],
                      ["Clip vidéo",  selected.videoClipUrl?"✅ Disponible":"❌ Non disponible"],
                      ["Snapshot",    selected.thumbnailUrl?"✅ Disponible":"—"],
                      ["Statut",      selected.acknowledged?"✅ Acquitté":"🔴 Ouvert"],
                      ["Créé le",     new Date(selected.createdAt).toLocaleString("fr-CA")],
                    ].map(([l,v])=>(
                      <div key={l as string} className="flex justify-between gap-2">
                        <span className="text-slate-500 shrink-0">{l}</span>
                        <span className="text-slate-300 text-right text-xs">{v}</span>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
                    {selected.videoClipUrl&&(
                      <a href={selected.videoClipUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-slate-700 py-2 text-xs text-slate-300 hover:border-brand hover:text-brand">
                        ⬇️ Télécharger le clip
                      </a>
                    )}
                    {selected.thumbnailUrl&&(
                      <a href={selected.thumbnailUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-slate-700 py-2 text-xs text-slate-300 hover:border-brand hover:text-brand">
                        📷 Voir le snapshot
                      </a>
                    )}
                  </div>
                </div>

                {/* Timeline */}
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <h3 className="mb-3 text-xs font-semibold text-slate-400">
                    TIMELINE ({selected.detectionIds?.length??0} détections)
                  </h3>
                  {currentOrg?.id&&selected.detectionIds?.length>0?(
                    <DetectionTimeline orgId={currentOrg.id} detectionIds={selected.detectionIds}/>
                  ):(
                    <p className="text-xs text-slate-600">Aucune détection liée</p>
                  )}
                </div>
              </div>

              {/* Snapshots */}
              {selected.thumbnailUrl&&(
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <h3 className="mb-3 text-xs font-semibold text-slate-400">SNAPSHOT</h3>
                  <img src={selected.thumbnailUrl} alt={selected.label}
                    className="rounded-lg border border-slate-700 max-h-48 object-contain"/>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
