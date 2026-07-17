"use client";

import { useEffect, useState, useCallback } from "react";
import {
  collection, query, orderBy, limit,
  onSnapshot, doc, updateDoc, deleteDoc,
  getDocs, where, getDoc, collectionGroup,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase/client";
import { useAuth } from "@/lib/context/AuthContext";
import { CATEGORY_LABELS } from "@/lib/detection/classMap";
import type { VGCategory } from "@/lib/detection/classMap";
import Link from "next/link";

interface OrgInfo { id:string; name:string; eventCount:number; }
interface EventDoc {
  id:string; primaryType:string; label:string; category:VGCategory;
  severity:"critical"|"warning"|"info"; cameraId:string;
  detectionIds:string[]; durationSeconds:number;
  thumbnailUrl?:string; videoClipUrl?:string;
  acknowledged:boolean; createdAt:string; updatedAt:string;
  organizationId?:string;
}

const SEV = {
  critical:{ border:"border-l-red-500",   badge:"bg-red-900/20 text-red-400 border-red-800",     dot:"bg-red-500",  label:"Critique" },
  warning: { border:"border-l-amber-500", badge:"bg-amber-900/20 text-amber-400 border-amber-800",dot:"bg-amber-500",label:"Alerte"   },
  info:    { border:"border-l-slate-600", badge:"bg-slate-800 text-slate-400 border-slate-700",   dot:"bg-slate-500",label:"Info"     },
};

function VideoPlayer({ url, thumbnail }: { url?:string; thumbnail?:string }) {
  if (!url) return (
    <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center gap-2">
      {thumbnail&&<img src={thumbnail} className="absolute inset-0 h-full w-full object-cover opacity-40"/>}
      <span className="relative z-10 text-3xl">🎬</span>
      <p className="relative z-10 text-xs text-slate-500">Clip non disponible</p>
    </div>
  );
  return (
    <div className="relative aspect-video rounded-xl bg-black border border-slate-800 overflow-hidden">
      <video src={url} poster={thumbnail} controls preload="metadata" className="h-full w-full"/>
      <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500"/><span className="text-xs text-white">CLIP</span>
      </div>
    </div>
  );
}

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
          {event.videoClipUrl&&<p className="text-amber-400 mt-1">⚠️ Le clip vidéo sera perdu</p>}
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 rounded-xl border border-slate-700 py-2.5 text-sm text-slate-300">Annuler</button>
          <button onClick={onConfirm} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white">🗑️ Supprimer</button>
        </div>
      </div>
    </div>
  );
}

export default function EventsPage() {
  const { profile } = useAuth();

  const [allOrgs,    setAllOrgs]    = useState<OrgInfo[]>([]);
  const [activeOrgId,setActiveOrgId]= useState<string|null>(null);
  const [events,     setEvents]     = useState<EventDoc[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [scanning,   setScanning]   = useState(false);
  const [selected,   setSelected]   = useState<EventDoc|null>(null);
  const [filter,     setFilter]     = useState<"all"|"open"|"critical">("all");
  const [toDelete,   setToDelete]   = useState<EventDoc|null>(null);

  // ── Étape 1 : scanner TOUTES les organisations de l'utilisateur ──────────
  const scanAllOrgs = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;
    setScanning(true);

    try {
      // Chercher toutes les orgs où l'utilisateur est membre
      const orgsSnap = await getDocs(collection(db, "organizations"));
      const found: OrgInfo[] = [];

      await Promise.all(orgsSnap.docs.map(async orgDoc => {
        // Vérifier si l'utilisateur est membre
        const memberDoc = await getDoc(doc(db,"organizations",orgDoc.id,"members",user.uid));
        if (!memberDoc.exists()) return;

        // Compter les events
        const evSnap = await getDocs(query(
          collection(db,"organizations",orgDoc.id,"events"),
          limit(1)
        ));

        // Inclure seulement les vraies orgs (pas diag)
        const name = orgDoc.data()?.name ?? orgDoc.id;
        found.push({
          id:         orgDoc.id,
          name,
          eventCount: evSnap.size,
        });
      }));

      // Trier: orgs avec events en premier, puis exclure les org-diag
      const sorted = found.sort((a,b) => {
        const aIsDiag = a.id.includes("diag") || a.name.includes("Diagnostic");
        const bIsDiag = b.id.includes("diag") || b.name.includes("Diagnostic");
        if (aIsDiag && !bIsDiag) return 1;
        if (!aIsDiag && bIsDiag) return -1;
        return b.eventCount - a.eventCount;
      });

      setAllOrgs(sorted);

      // Sélectionner automatiquement la meilleure org
      const bestOrg = sorted.find(o => !o.id.includes("diag") && !o.name.includes("Diagnostic"))
        ?? sorted[0];

      if (bestOrg) setActiveOrgId(bestOrg.id);
    } catch (err) {
      console.error("scanAllOrgs:", err);
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => { scanAllOrgs(); }, [scanAllOrgs]);

  // ── Étape 2 : charger les events de l'org sélectionnée ──────────────────
  useEffect(() => {
    if (!activeOrgId) return;
    setLoading(true);
    setEvents([]);

    const q = query(
      collection(db,"organizations",activeOrgId,"events"),
      orderBy("createdAt","desc"),
      limit(500),  // TOUT l'historique
    );

    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d=>({id:d.id,...d.data(),organizationId:activeOrgId}as EventDoc));
      setEvents(docs);
      if (docs.length>0 && !selected) setSelected(docs[0]);
      setLoading(false);
    }, () => setLoading(false));

    return unsub;
  }, [activeOrgId]);

  // Sync selected avec updates Firestore
  useEffect(() => {
    if (selected) {
      const updated = events.find(e=>e.id===selected.id);
      if (updated) setSelected(updated);
    }
  }, [events]);

  async function acknowledge(ev:EventDoc) {
    if (!activeOrgId) return;
    await updateDoc(doc(db,"organizations",activeOrgId,"events",ev.id),{
      acknowledged:true, acknowledgedAt:new Date().toISOString(),
    });
  }

  async function confirmDelete() {
    if (!toDelete||!activeOrgId) return;
    await deleteDoc(doc(db,"organizations",activeOrgId,"events",toDelete.id));
    if (selected?.id===toDelete.id) setSelected(events.find(e=>e.id!==toDelete.id)??null);
    setToDelete(null);
  }

  const filtered = events.filter(e=>
    filter==="open"?"!e.acknowledged" &&!e.acknowledged:
    filter==="critical"?e.severity==="critical":
    true
  );

  const filteredEvents = filter==="all" ? events
    : filter==="open" ? events.filter(e=>!e.acknowledged)
    : events.filter(e=>e.severity==="critical");

  const critical = events.filter(e=>e.severity==="critical"&&!e.acknowledged).length;
  const open     = events.filter(e=>!e.acknowledged).length;
  const withClip = events.filter(e=>e.videoClipUrl).length;

  const activeOrg = allOrgs.find(o=>o.id===activeOrgId);

  return (
    <div>
      {toDelete&&(
        <DeleteModal event={toDelete} onConfirm={confirmDelete} onCancel={()=>setToDelete(null)}/>
      )}

      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Events</h1>
          <p className="text-sm text-slate-400 mt-0.5">Historique complet · {events.length} events</p>
        </div>
        <button onClick={scanAllOrgs} disabled={scanning}
          className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:text-white disabled:opacity-50">
          {scanning
            ? <><span className="h-3 w-3 animate-spin rounded-full border border-brand border-t-transparent"/>Scan...</>
            : "🔍 Scanner les orgs"}
        </button>
      </div>

      {/* Sélecteur d'organisation */}
      {allOrgs.length > 1 && (
        <div className="mb-4 rounded-xl border border-amber-800/30 bg-amber-900/10 p-3">
          <p className="text-xs text-amber-400 mb-2">
            ⚠️ {allOrgs.length} organisations trouvées — sélectionnez celle qui contient vos events
          </p>
          <div className="flex flex-wrap gap-2">
            {allOrgs.map(org => (
              <button key={org.id} onClick={()=>setActiveOrgId(org.id)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                  activeOrgId===org.id
                    ? "border-brand bg-brand/10 text-brand"
                    : org.id.includes("diag")||org.name.includes("Diagnostic")
                    ? "border-slate-700 text-slate-600"
                    : "border-slate-700 text-slate-300 hover:border-slate-500"
                }`}>
                {org.id.includes("diag")||org.name.includes("Diagnostic") ? "🧪" : "🏢"}
                <span className="max-w-32 truncate">{org.name}</span>
                {activeOrgId===org.id && <span className="text-emerald-400">✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="mb-4 grid grid-cols-4 gap-3">
        {[
          { label:"Total",       value:events.length, color:"text-white"     },
          { label:"Critiques",   value:critical,      color:"text-red-400"   },
          { label:"Ouverts",     value:open,          color:"text-amber-400" },
          { label:"Clips vidéo", value:withClip,      color:"text-brand"     },
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
      {(loading||scanning) && (
        <div className="flex items-center justify-center py-16 gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent"/>
          <span className="text-sm text-slate-400">
            {scanning ? "Scan des organisations..." : "Chargement de l'historique..."}
          </span>
        </div>
      )}

      {!loading && !scanning && events.length===0 && (
        <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center">
          <p className="text-3xl mb-3">🚨</p>
          <p className="text-slate-400 mb-2">Aucun event dans cette organisation</p>
          {allOrgs.length>1&&(
            <p className="text-xs text-slate-500 mb-4">
              Essayez une autre organisation ci-dessus
            </p>
          )}
          <Link href="/cameras/phone" className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium">
            📱 Activer la caméra →
          </Link>
        </div>
      )}

      {/* Liste + Détail */}
      {!loading && !scanning && filteredEvents.length>0 && (
        <div className="flex gap-4">
          {/* Liste */}
          <div className="w-80 shrink-0 space-y-1.5 overflow-y-auto" style={{maxHeight:"65vh"}}>
            {filteredEvents.map(ev=>{
              const s      = SEV[ev.severity]??SEV.info;
              const catDef = CATEGORY_LABELS[ev.category]??{icon:"📦",color:"#64748B"};
              return (
                <div key={ev.id}
                  onClick={()=>setSelected(ev)}
                  className={`rounded-xl border-l-4 border p-3 cursor-pointer transition-all ${s.border} ${
                    selected?.id===ev.id?"border-brand bg-brand/5":"border-slate-800 bg-slate-900 hover:border-slate-700"
                  } ${ev.acknowledged?"opacity-60":""}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xl">{catDef.icon}</span>
                    <span className="flex-1 text-sm font-medium text-white truncate">{ev.label??ev.primaryType}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {ev.videoClipUrl&&<span className="text-brand text-xs">🎬</span>}
                      {ev.thumbnailUrl&&<span className="text-slate-500 text-xs">📷</span>}
                      <button onClick={e=>{e.stopPropagation();setToDelete(ev);}}
                        className="rounded p-0.5 text-slate-700 hover:text-red-400 hover:bg-red-900/20" title="Supprimer">
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
                </div>
              );
            })}
          </div>

          {/* Détail */}
          {selected && (
            <div className="flex-1 min-w-0 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{CATEGORY_LABELS[selected.category]?.icon??"📦"}</span>
                  <div>
                    <h2 className="text-lg font-semibold text-white">{selected.label}</h2>
                    <p className="text-xs text-slate-500">
                      {new Date(selected.createdAt).toLocaleString("fr-CA")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!selected.acknowledged&&(
                    <button onClick={()=>acknowledge(selected)}
                      className="rounded-lg border border-emerald-800 bg-emerald-900/10 px-3 py-2 text-sm text-emerald-400">
                      ✓ Acquitter
                    </button>
                  )}
                  <button onClick={()=>setToDelete(selected)}
                    className="rounded-lg border border-red-800 bg-red-900/10 px-3 py-2 text-sm text-red-400">
                    🗑️ Supprimer
                  </button>
                </div>
              </div>

              <VideoPlayer url={selected.videoClipUrl} thumbnail={selected.thumbnailUrl}/>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <h3 className="mb-3 text-xs font-semibold text-slate-400">DÉTAILS</h3>
                  <div className="space-y-2 text-xs">
                    {[
                      ["Sévérité",  SEV[selected.severity]?.label],
                      ["Type",      selected.primaryType],
                      ["Durée",     `${selected.durationSeconds}s`],
                      ["Détections",`${selected.detectionIds?.length??1}`],
                      ["Clip",      selected.videoClipUrl?"✅":"❌"],
                      ["Snapshot",  selected.thumbnailUrl?"✅":"—"],
                      ["Statut",    selected.acknowledged?"✅ Acquitté":"🔴 Ouvert"],
                    ].map(([l,v])=>(
                      <div key={l as string} className="flex justify-between">
                        <span className="text-slate-500">{l}</span>
                        <span className="text-slate-300">{v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
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

                {selected.thumbnailUrl && (
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                    <h3 className="mb-3 text-xs font-semibold text-slate-400">SNAPSHOT</h3>
                    <img src={selected.thumbnailUrl} alt={selected.label}
                      className="w-full rounded-lg border border-slate-700 object-contain max-h-40"/>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
