"use client";

import { useEffect, useState, useRef } from "react";
import {
  collection, query, orderBy, limit,
  onSnapshot, doc, updateDoc, deleteDoc, getDocs, where, getDoc,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase/client";
import { CATEGORY_LABELS } from "@/lib/detection/classMap";
import type { VGCategory } from "@/lib/detection/classMap";
import Link from "next/link";

interface OrgOption { id:string; name:string; }
interface EventDoc {
  id:string; primaryType:string; label:string; category:VGCategory;
  severity:"critical"|"warning"|"info"; cameraId:string;
  detectionIds:string[]; durationSeconds:number;
  thumbnailUrl?:string; videoClipUrl?:string;
  acknowledged:boolean; createdAt:string; updatedAt:string;
}
interface DetectionItem {
  id:string; label:string; confidence:number; detectedAt:string; snapshotUrl?:string; severity:string;
}

const SEV = {
  critical:{ border:"border-l-red-500",   badge:"bg-red-900/20 text-red-400 border-red-800",     label:"Critique" },
  warning: { border:"border-l-amber-500", badge:"bg-amber-900/20 text-amber-400 border-amber-800",label:"Alerte"   },
  info:    { border:"border-l-slate-600", badge:"bg-slate-800 text-slate-400 border-slate-700",   label:"Info"     },
};

// ── Lecteur vidéo ─────────────────────────────────────────────────────────────
function VideoPlayer({ url, thumbnail }: { url?:string; thumbnail?:string }) {
  const [err, setErr] = useState(false);

  if (!url) return (
    <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-950 border border-dashed border-slate-700 flex flex-col items-center justify-center gap-2">
      {thumbnail && <img src={thumbnail} className="absolute inset-0 h-full w-full object-cover opacity-30"/>}
      <span className="relative text-4xl">🎬</span>
      <p className="relative text-xs text-slate-500">Clip non disponible pour cet event</p>
      <p className="relative text-xs text-slate-600">
        Active l'IA sur <Link href="/cameras/phone" className="text-brand">Caméra Phone</Link> pour générer des clips automatiquement
      </p>
    </div>
  );

  if (err) return (
    <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-950 border border-amber-800/40 flex flex-col items-center justify-center gap-2">
      {thumbnail && <img src={thumbnail} className="absolute inset-0 h-full w-full object-cover opacity-40"/>}
      <span className="relative text-4xl">⚠️</span>
      <p className="relative text-xs text-amber-400">Erreur de lecture du clip</p>
      <a href={url} target="_blank" className="relative text-xs text-brand hover:underline">Ouvrir dans un nouvel onglet ↗</a>
    </div>
  );

  return (
    <div className="relative aspect-video overflow-hidden rounded-xl bg-black border border-slate-800">
      <video src={url} poster={thumbnail} controls preload="metadata"
        onError={()=>setErr(true)} className="h-full w-full"/>
      <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500"/>
        <span className="text-xs text-white font-medium">CLIP</span>
      </div>
    </div>
  );
}

// ── Timeline détections ───────────────────────────────────────────────────────
function DetectionTimeline({ orgId, detectionIds }: { orgId:string; detectionIds:string[] }) {
  const [items, setItems] = useState<DetectionItem[]>([]);
  useEffect(()=>{
    if (!detectionIds?.length) return;
    getDocs(query(
      collection(db,"organizations",orgId,"detections"),
      where("__name__","in",detectionIds.slice(0,10))
    )).then(s=>{
      setItems(s.docs.map(d=>({id:d.id,...d.data()}as DetectionItem))
        .sort((a,b)=>a.detectedAt.localeCompare(b.detectedAt)));
    }).catch(()=>{});
  },[orgId,detectionIds?.join(",")]);

  if (!items.length) return <p className="text-xs text-slate-600">Aucune détection liée</p>;
  return (
    <div className="space-y-2">
      {items.map((d,i)=>(
        <div key={d.id} className="flex items-center gap-2">
          <div className="flex flex-col items-center shrink-0">
            <div className={`h-2 w-2 rounded-full ${d.severity==="critical"?"bg-red-500":d.severity==="warning"?"bg-amber-500":"bg-slate-500"}`}/>
            {i<items.length-1&&<div className="w-0.5 h-4 bg-slate-800 mt-0.5"/>}
          </div>
          {d.snapshotUrl&&<img src={d.snapshotUrl} className="h-8 w-12 shrink-0 rounded object-cover border border-slate-700"/>}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white">{d.label}</p>
            <p className="text-xs text-slate-600">{new Date(d.detectedAt).toLocaleTimeString("fr-CA")} · {Math.round(d.confidence*100)}%</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Modale suppression ────────────────────────────────────────────────────────
function DeleteModal({ event, onConfirm, onCancel }: { event:EventDoc; onConfirm:()=>void; onCancel:()=>void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-red-800/50 bg-slate-900 p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-900/20 border border-red-800 text-2xl">🗑️</div>
          <div>
            <p className="font-semibold text-white">Supprimer cet event ?</p>
            <p className="text-xs text-slate-500">Action irréversible</p>
          </div>
        </div>
        <div className="mb-5 rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs">
          <p className="font-medium text-white mb-1">{event.label}</p>
          <p className="text-slate-500">{new Date(event.createdAt).toLocaleString("fr-CA")}</p>
          {event.videoClipUrl&&<p className="text-amber-400 mt-1">⚠️ Le clip sera perdu</p>}
          {event.thumbnailUrl&&<p className="text-amber-400">⚠️ Le snapshot sera perdu</p>}
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 rounded-xl border border-slate-700 py-2.5 text-sm text-slate-300 hover:border-slate-500">
            Annuler
          </button>
          <button onClick={onConfirm} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700">
            🗑️ Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function EventsPage() {
  const [orgs,      setOrgs]      = useState<OrgOption[]>([]);
  const [orgId,     setOrgId]     = useState<string|null>(null);
  const [events,    setEvents]    = useState<EventDoc[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [selected,  setSelected]  = useState<EventDoc|null>(null);
  const [filter,    setFilter]    = useState<"all"|"open"|"critical">("all");
  const [toDelete,  setToDelete]  = useState<EventDoc|null>(null);

  // Charger toutes les orgs de l'utilisateur
  useEffect(()=>{
    const user = auth.currentUser;
    if (!user) return;

    (async()=>{
      try {
        const userDoc = await getDoc(doc(db,"users",user.uid));
        const defaultOrgId = userDoc.data()?.defaultOrganizationId;

        // Lister toutes les orgs où l'user est membre
        const allOrgsSnap = await getDocs(collection(db,"organizations"));
        const myOrgs: OrgOption[] = [];

        for (const orgDoc of allOrgsSnap.docs) {
          const memberDoc = await getDoc(doc(db,"organizations",orgDoc.id,"members",user.uid));
          if (memberDoc.exists()) {
            myOrgs.push({ id:orgDoc.id, name:orgDoc.data()?.name??orgDoc.id });
          }
        }

        // Filtrer les orgs de diagnostic (les cacher complètement)
        const realOrgs = myOrgs.filter(o =>
          !o.id.includes("diag") &&
          !o.name.toLowerCase().includes("diagnostic") &&
          !o.name.toLowerCase().includes("test diagnostic") &&
          !o.name.toLowerCase().includes("test")
        );
        
        // Si aucune org réelle, garder la première quand même
        const orgsToShow = realOrgs.length > 0 ? realOrgs : myOrgs.slice(0,1);
        
        // Trier: defaultOrg en premier
        orgsToShow.sort((a,b) => a.id===defaultOrgId ? -1 : b.id===defaultOrgId ? 1 : 0);

        setOrgs(orgsToShow);
        setOrgId(orgsToShow[0]?.id ?? null);
      } catch(e){ console.error(e); }
    })();
  },[]);

  // Charger les events de l'org sélectionnée
  useEffect(()=>{
    if (!orgId) { setLoading(false); return; }
    setLoading(true);
    const q = query(
      collection(db,"organizations",orgId,"events"),
      orderBy("createdAt","desc"),
      limit(500),
    );
    const unsub = onSnapshot(q, snap=>{
      const docs = snap.docs.map(d=>({id:d.id,...d.data()}as EventDoc));
      setEvents(docs);
      if (docs.length>0) setSelected(prev=>docs.find(e=>e.id===prev?.id)??docs[0]);
      setLoading(false);
    },()=>setLoading(false));
    return unsub;
  },[orgId]);

  async function acknowledge(ev:EventDoc){
    if(!orgId) return;
    await updateDoc(doc(db,"organizations",orgId,"events",ev.id),{
      acknowledged:true, acknowledgedAt:new Date().toISOString(),
    });
  }

  async function confirmDelete(){
    if(!toDelete||!orgId) return;
    await deleteDoc(doc(db,"organizations",orgId,"events",toDelete.id));
    setToDelete(null);
  }

  const filteredEvents = filter==="all" ? events
    : filter==="open"     ? events.filter(e=>!e.acknowledged)
    : events.filter(e=>e.severity==="critical");

  const critical = events.filter(e=>e.severity==="critical"&&!e.acknowledged).length;
  const open     = events.filter(e=>!e.acknowledged).length;
  const withClip = events.filter(e=>!!e.videoClipUrl).length;

  return (
    <div>
      {toDelete&&<DeleteModal event={toDelete} onConfirm={confirmDelete} onCancel={()=>setToDelete(null)}/>}

      {/* Header + sélecteur org */}
      <div className="mb-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Events</h1>
            <p className="text-sm text-slate-400 mt-0.5">{events.length} events · historique complet</p>
          </div>
        </div>

        {/* Sélecteur organisation — seulement si > 1 org */}
        {orgs.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {orgs.map(org=>{
              const isDiag = org.id.includes("diag")||org.name.includes("Diagnostic")||org.name.includes("Test");
              return (
                <button key={org.id} onClick={()=>setOrgId(org.id)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    orgId===org.id
                      ? "border-brand bg-brand/10 text-brand"
                      : isDiag
                      ? "border-slate-800 text-slate-600 hover:border-slate-700"
                      : "border-slate-700 text-slate-300 hover:border-slate-500"
                  }`}>
                  {isDiag?"🧪":"🏢"} {org.name.slice(0,20)}{orgId===org.id?" ✓":""}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-4 gap-3">
        {[
          { label:"Total",       value:events.length, color:"text-white"     },
          { label:"Critiques",   value:critical,      color:"text-red-400"   },
          { label:"Ouverts",     value:open,          color:"text-amber-400" },
          { label:"Avec clips",  value:withClip,      color:"text-brand"     },
        ].map(k=>(
          <div key={k.label} className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-center">
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

      {loading && (
        <div className="flex items-center justify-center py-16 gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent"/>
          <span className="text-sm text-slate-400">Chargement...</span>
        </div>
      )}

      {!loading && events.length===0 && (
        <div className="rounded-xl border border-dashed border-slate-700 p-12 text-center">
          <p className="text-3xl mb-3">🚨</p>
          <p className="text-slate-400 mb-2">Aucun event dans cette organisation</p>
          <p className="text-xs text-slate-600 mb-4">Essayez une autre organisation ci-dessus</p>
          <Link href="/cameras/phone" className="rounded-lg bg-brand px-5 py-2">📱 Activer la caméra</Link>
        </div>
      )}

      {/* Contenu principal */}
      {!loading && filteredEvents.length>0 && (
        <div className="flex gap-4">
          {/* Liste */}
          <div className="w-80 shrink-0 space-y-1.5 overflow-y-auto" style={{maxHeight:"70vh"}}>
            {filteredEvents.map(ev=>{
              const s      = SEV[ev.severity]??SEV.info;
              const catDef = CATEGORY_LABELS[ev.category]??{icon:"📦",color:"#64748B"};
              return (
                <div key={ev.id} onClick={()=>setSelected(ev)}
                  className={`rounded-xl border-l-4 border p-3 cursor-pointer transition-all ${s.border} ${
                    selected?.id===ev.id?"border-brand bg-brand/5":"border-slate-800 bg-slate-900 hover:border-slate-700"
                  } ${ev.acknowledged?"opacity-50":""}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xl">{catDef.icon}</span>
                    <span className="flex-1 text-sm font-medium text-white truncate">{ev.label??ev.primaryType}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {ev.videoClipUrl&&<span className="text-brand">🎬</span>}
                      {ev.thumbnailUrl&&<span className="text-slate-500 text-xs">📷</span>}
                      {ev.acknowledged&&<span className="text-slate-600 text-xs">✓</span>}
                      <button onClick={e=>{e.stopPropagation();setToDelete(ev);}}
                        title="Supprimer"
                        className="ml-1 rounded p-0.5 text-slate-700 hover:text-red-400 hover:bg-red-900/20 transition-colors">
                        🗑️
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${s.badge}`}>{s.label}</span>
                    <span className="text-xs text-slate-600">
                      {new Date(ev.createdAt).toLocaleString("fr-CA",{month:"short",day:"2-digit",hour:"2-digit",minute:"2-digit"})}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Détail */}
          {selected && orgId && (
            <div className="flex-1 min-w-0 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{CATEGORY_LABELS[selected.category]?.icon??"📦"}</span>
                  <div>
                    <h2 className="text-lg font-semibold text-white">{selected.label}</h2>
                    <p className="text-xs text-slate-500">{new Date(selected.createdAt).toLocaleString("fr-CA")}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!selected.acknowledged&&(
                    <button onClick={()=>acknowledge(selected)}
                      className="rounded-lg border border-emerald-800 bg-emerald-900/10 px-3 py-2 text-sm text-emerald-400 hover:bg-emerald-900/20">
                      ✓ Acquitter
                    </button>
                  )}
                  <button onClick={()=>setToDelete(selected)}
                    className="rounded-lg border border-red-800 bg-red-900/10 px-3 py-2 text-sm text-red-400 hover:bg-red-900/20">
                    🗑️ Supprimer
                  </button>
                </div>
              </div>

              {/* Lecteur vidéo */}
              <VideoPlayer url={selected.videoClipUrl} thumbnail={selected.thumbnailUrl}/>

              {/* Infos + Timeline */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <h3 className="mb-3 text-xs font-semibold text-slate-400">DÉTAILS</h3>
                  <div className="space-y-2 text-xs mb-4">
                    {[
                      ["Sévérité",   SEV[selected.severity]?.label],
                      ["Type",       selected.primaryType],
                      ["Durée",      `${selected.durationSeconds}s`],
                      ["Détections", `${selected.detectionIds?.length??1}`],
                      ["Clip",       selected.videoClipUrl?"✅":"❌"],
                      ["Snapshot",   selected.thumbnailUrl?"✅":"—"],
                      ["Statut",     selected.acknowledged?"✅ Acquitté":"🔴 Ouvert"],
                      ["Date",       new Date(selected.createdAt).toLocaleString("fr-CA")],
                    ].map(([l,v])=>(
                      <div key={l as string} className="flex justify-between">
                        <span className="text-slate-500">{l}</span>
                        <span className="text-slate-300">{v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    {selected.videoClipUrl&&(
                      <a href={selected.videoClipUrl} target="_blank"
                        className="flex items-center justify-center w-full rounded-lg border border-slate-700 py-2 text-xs text-slate-300 hover:border-brand hover:text-brand">
                        ⬇️ Télécharger le clip
                      </a>
                    )}
                    {selected.thumbnailUrl&&(
                      <a href={selected.thumbnailUrl} target="_blank"
                        className="flex items-center justify-center w-full rounded-lg border border-slate-700 py-2 text-xs text-slate-300 hover:border-brand hover:text-brand">
                        📷 Voir le snapshot
                      </a>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <h3 className="mb-3 text-xs font-semibold text-slate-400">
                    TIMELINE ({selected.detectionIds?.length??0})
                  </h3>
                  <DetectionTimeline orgId={orgId} detectionIds={selected.detectionIds??[]}/>
                  {selected.thumbnailUrl&&(
                    <div className="mt-4 pt-3 border-t border-slate-800">
                      <p className="text-xs font-semibold text-slate-400 mb-2">SNAPSHOT</p>
                      <img src={selected.thumbnailUrl} className="w-full rounded-lg border border-slate-700 object-contain max-h-32"/>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
