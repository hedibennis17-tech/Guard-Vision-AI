"use client";

import { useEffect, useState } from "react";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useOrganization } from "@/lib/context/OrganizationContext";
import { PageHeader } from "@/components/PageHeader";
import Link from "next/link";

interface EventItem {
  id: string;
  primaryType: string;
  label: string;
  severity: "critical" | "warning" | "info";
  cameraId: string;
  detectionIds: string[];
  durationSeconds: number;
  acknowledged: boolean;
  createdAt: string;
  thumbnailUrl?: string;
}

const SEV: Record<string, { border:string; badge:string; dot:string }> = {
  critical: { border:"border-l-red-500",   badge:"bg-red-500/10 text-red-400 border-red-800",     dot:"bg-red-500"   },
  warning:  { border:"border-l-amber-500", badge:"bg-amber-500/10 text-amber-400 border-amber-800", dot:"bg-amber-500" },
  info:     { border:"border-l-slate-600", badge:"bg-slate-800 text-slate-400 border-slate-700",   dot:"bg-slate-500" },
};

export default function EventsPage() {
  const { currentOrg } = useOrganization();
  const [events,  setEvents]  = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected,setSelected]= useState<EventItem | null>(null);

  useEffect(() => {
    if (!currentOrg?.id) { setLoading(false); return; }

    const q = query(
      collection(db, "organizations", currentOrg.id, "events"),
      orderBy("createdAt", "desc"),
      limit(50),
    );

    const unsub = onSnapshot(q, (snap) => {
      setEvents(snap.docs.map((d) => ({ id:d.id, ...d.data() } as EventItem)));
      setLoading(false);
    }, () => setLoading(false));

    return unsub;
  }, [currentOrg?.id]);

  const critical = events.filter(e => e.severity === "critical" && !e.acknowledged).length;
  const open     = events.filter(e => !e.acknowledged).length;

  return (
    <div>
      <PageHeader title="Events" description="Événements détectés en temps réel — Firestore live." />

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-red-900/40 bg-red-900/10 p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{critical}</p>
          <p className="text-xs text-red-500">Critiques ouverts</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-center">
          <p className="text-2xl font-bold text-white">{open}</p>
          <p className="text-xs text-slate-500">Total ouverts</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-center">
          <p className="text-2xl font-bold text-white">{events.length}</p>
          <p className="text-xs text-slate-500">Total (50 derniers)</p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <span className="text-sm text-slate-400">Chargement depuis Firestore...</span>
        </div>
      )}

      {!loading && !currentOrg && (
        <div className="rounded-xl border border-amber-800/40 bg-amber-900/10 p-8 text-center">
          <p className="text-amber-400 mb-3">Aucune organisation configurée</p>
          <Link href="/cameras/phone" className="rounded-lg bg-brand px-4 py-2 text-sm">
            → Configurer via Caméra Phone
          </Link>
        </div>
      )}

      {!loading && currentOrg && events.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-700 p-12 text-center">
          <p className="text-4xl mb-3">🚨</p>
          <p className="text-slate-400 mb-2">Aucun event pour le moment</p>
          <p className="text-xs text-slate-600 mb-4">
            Org: {currentOrg.name} · Active l'IA sur /cameras/phone pour générer des détections
          </p>
          <Link href="/cameras/phone" className="rounded-lg bg-brand px-5 py-2 text-sm">
            📱 Aller à la caméra →
          </Link>
        </div>
      )}

      {!loading && events.length > 0 && (
        <div className="flex gap-5">
          {/* Liste */}
          <div className="flex-1 space-y-2">
            {events.map((ev) => {
              const s = SEV[ev.severity] ?? SEV.info;
              return (
                <button key={ev.id} onClick={() => setSelected(ev)}
                  className={`w-full rounded-xl border-l-4 border border-slate-800 bg-slate-900 p-4 text-left hover:border-slate-700 transition-colors ${s.border} ${selected?.id === ev.id ? "border-brand bg-brand/5" : ""} ${ev.acknowledged ? "opacity-60" : ""}`}>
                  <div className="flex items-center gap-3">
                    <div className={`h-2 w-2 shrink-0 rounded-full ${ev.acknowledged ? "bg-slate-700" : s.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${s.badge}`}>
                          {ev.severity}
                        </span>
                        <span className="text-sm font-medium text-white truncate">{ev.label ?? ev.primaryType}</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {ev.detectionIds?.length ?? 1} détection(s) · {ev.durationSeconds}s ·{" "}
                        {new Date(ev.createdAt).toLocaleTimeString("fr-CA")}
                      </p>
                    </div>
                    {ev.acknowledged && <span className="text-xs text-slate-600">✓</span>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Détail */}
          {selected && (
            <div className="w-72 shrink-0 rounded-xl border border-slate-800 bg-slate-900 p-5">
              <h3 className="mb-4 text-sm font-semibold text-white">{selected.label ?? selected.primaryType}</h3>
              <div className="space-y-2 text-xs">
                {[
                  ["Sévérité",    selected.severity],
                  ["Caméra",      selected.cameraId.slice(0,12) + "..."],
                  ["Détections",  selected.detectionIds?.length ?? 1],
                  ["Durée",       `${selected.durationSeconds}s`],
                  ["Statut",      selected.acknowledged ? "Acquitté" : "Ouvert"],
                  ["Créé",        new Date(selected.createdAt).toLocaleString("fr-CA")],
                ].map(([l, v]) => (
                  <div key={l as string} className="flex justify-between">
                    <span className="text-slate-500">{l}</span>
                    <span className="text-slate-300 text-right">{String(v)}</span>
                  </div>
                ))}
              </div>
              <a href={`https://console.firebase.google.com/project/ai-guard-vision-8ef41/firestore/data/organizations/${currentOrg?.id}/events/${selected.id}`}
                target="_blank"
                className="mt-4 block text-center text-xs text-brand hover:underline">
                Voir dans Firestore ↗
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
