"use client";

import { useEffect, useState } from "react";
import {
  collection, query, orderBy, limit,
  onSnapshot, where, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useOrganization } from "@/lib/context/OrganizationContext";
import { PageHeader } from "@/components/PageHeader";
import { CATEGORY_LABELS, CLASS_MAP, type VGCategory } from "@/lib/detection/classMap";
import Link from "next/link";

interface DetectionDoc {
  id:           string;
  type:         string;
  label:        string;
  category:     VGCategory;
  confidence:   number;
  severity:     string;
  cameraId:     string;
  snapshotUrl?: string;
  detectedAt:   string;
  source:       string;
}

type FilterCategory = "all" | VGCategory;

const CATEGORY_ORDER: VGCategory[] = [
  "human","animal","vehicle","fire","smoke",
  "retail_item","tool","electronic","food","sport","bag","furniture","unknown"
];

export default function AiDetectionPage() {
  const { currentOrg } = useOrganization();

  const [detections, setDetections] = useState<DetectionDoc[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState<FilterCategory>("all");
  const [selected,   setSelected]   = useState<DetectionDoc | null>(null);

  // Charger les 100 dernières détections en temps réel
  useEffect(() => {
    if (!currentOrg?.id) { setLoading(false); return; }

    const q = query(
      collection(db, "organizations", currentOrg.id, "detections"),
      orderBy("detectedAt", "desc"),
      limit(100),
    );

    const unsub = onSnapshot(q, (snap) => {
      setDetections(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DetectionDoc)));
      setLoading(false);
    }, () => setLoading(false));

    return unsub;
  }, [currentOrg?.id]);

  // Statistiques par catégorie
  const statsByCategory = CATEGORY_ORDER.reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = detections.filter((d) => d.category === cat).length;
    return acc;
  }, {});

  const totalToday = detections.length;
  const criticalCount = detections.filter((d) => d.severity === "critical").length;
  const avgConfidence = detections.length > 0
    ? Math.round(detections.reduce((s, d) => s + d.confidence, 0) / detections.length * 100)
    : 0;

  // Filtrage
  const filtered = filter === "all"
    ? detections
    : detections.filter((d) => d.category === filter);

  // Catégories avec au moins 1 détection
  const activeCategories = CATEGORY_ORDER.filter((c) => statsByCategory[c] > 0);

  return (
    <div>
      <PageHeader
        title="AI Detection"
        description="Détections en temps réel — YOLOv11 / TF.js · Firestore live"
      />

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label:"Détections",      value: totalToday,    color:"text-white"         },
          { label:"Critiques",       value: criticalCount, color:"text-red-400"        },
          { label:"Confiance moy.",  value: `${avgConfidence}%`, color:"text-brand"   },
          { label:"Catégories",      value: activeCategories.length, color:"text-emerald-400" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs text-slate-500">{k.label}</p>
            <p className={`mt-1 text-3xl font-semibold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Segmentations par catégorie */}
      <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="mb-4 text-sm font-medium text-slate-300">
          Segmentations détectées
        </h2>
        {activeCategories.length === 0 ? (
          <p className="text-xs text-slate-600 text-center py-4">
            Aucune détection — activez l'IA sur <Link href="/cameras/phone" className="text-brand">Caméra Phone</Link> ou <Link href="/live-monitoring" className="text-brand">Live Monitor</Link>
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {activeCategories.map((cat) => {
              const def    = CATEGORY_LABELS[cat];
              const count  = statsByCategory[cat];
              const pct    = Math.round((count / totalToday) * 100);
              const active = filter === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setFilter(active ? "all" : cat)}
                  className={`rounded-xl border p-3 text-left transition-all hover:border-slate-600 ${
                    active ? "border-current" : "border-slate-800 bg-slate-950"
                  }`}
                  style={active ? { borderColor: def.color, background: def.color + "15" } : {}}
                >
                  <span className="text-2xl block mb-1">{def.icon}</span>
                  <p className="text-xs font-medium text-white">{def.label}</p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-lg font-bold" style={{ color: def.color }}>{count}</span>
                    <span className="text-xs text-slate-600">{pct}%</span>
                  </div>
                  {/* Barre de progression */}
                  <div className="mt-1.5 h-1 w-full rounded-full bg-slate-800">
                    <div className="h-1 rounded-full transition-all"
                      style={{ width:`${pct}%`, background: def.color }} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Classes détectées */}
      {activeCategories.length > 0 && (
        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-4 text-sm font-medium text-slate-300">
            Détail par classe ({filtered.length} résultats
            {filter !== "all" ? ` — ${CATEGORY_LABELS[filter as VGCategory]?.label}` : ""})
          </h2>

          {/* Classes uniques dans les détections filtrées */}
          <div className="mb-4 flex flex-wrap gap-1.5">
            <button onClick={() => setFilter("all")}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filter === "all" ? "bg-brand text-white border-brand" : "border-slate-700 text-slate-400 hover:text-white"
              }`}>
              Toutes
            </button>
            {activeCategories.map((cat) => {
              const def = CATEGORY_LABELS[cat];
              return (
                <button key={cat}
                  onClick={() => setFilter(filter === cat ? "all" : cat)}
                  className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    filter === cat ? "text-white border-current" : "border-slate-700 text-slate-400 hover:text-white"
                  }`}
                  style={filter === cat ? { background:def.color+"20", borderColor:def.color, color:def.color } : {}}>
                  {def.icon} {def.label}
                  <span className="ml-0.5 text-slate-500">({statsByCategory[cat]})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Chargement */}
      {loading && (
        <div className="flex items-center justify-center py-16 gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <span className="text-sm text-slate-400">Chargement depuis Firestore...</span>
        </div>
      )}

      {/* Pas d'org */}
      {!loading && !currentOrg && (
        <div className="rounded-xl border border-dashed border-slate-700 p-12 text-center">
          <p className="text-4xl mb-3">🤖</p>
          <p className="text-slate-400 mb-4">Aucune organisation — configurez d'abord une caméra.</p>
          <Link href="/cameras/phone" className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium">
            → Caméra Phone
          </Link>
        </div>
      )}

      {/* Liste des détections */}
      {!loading && currentOrg && (
        <div className="flex gap-5">
          {/* Feed */}
          <div className="flex-1">
            <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
                <span className="text-sm font-medium text-slate-300">
                  Flux de détections — temps réel
                </span>
                <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Firestore onSnapshot
                </span>
              </div>

              {filtered.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <p className="text-4xl mb-3">🤖</p>
                  <p className="text-sm text-slate-500 mb-1">Aucune détection</p>
                  <p className="text-xs text-slate-600">
                    Active l'IA sur{" "}
                    <Link href="/cameras/phone" className="text-brand hover:underline">Caméra Phone</Link>
                    {" "}ou{" "}
                    <Link href="/live-monitoring" className="text-brand hover:underline">Live Monitor</Link>
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800 max-h-[600px] overflow-y-auto">
                  {filtered.map((det) => {
                    const catDef = CATEGORY_LABELS[det.category] ?? { icon:"📦", color:"#64748B", label:"Inconnu" };
                    const sevColor = det.severity === "critical" ? "#EF4444"
                      : det.severity === "warning" ? "#F59E0B" : "#64748B";

                    return (
                      <button key={det.id} onClick={() => setSelected(selected?.id === det.id ? null : det)}
                        className={`w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-slate-800/50 transition-colors ${
                          selected?.id === det.id ? "bg-brand/5" : ""
                        }`}>
                        {/* Snapshot ou icône */}
                        <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-800 flex items-center justify-center">
                          {det.snapshotUrl
                            ? <img src={det.snapshotUrl} alt={det.label}
                                className="h-full w-full object-cover" />
                            : <span className="text-2xl">{catDef.icon}</span>
                          }
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            {/* Badge sévérité */}
                            <span className="rounded-full px-2 py-0.5 text-xs font-medium"
                              style={{ background:sevColor+"20", color:sevColor, border:`1px solid ${sevColor}40` }}>
                              {det.severity}
                            </span>
                            {/* Label classe */}
                            <span className="text-sm font-medium text-white">{det.label}</span>
                            {/* Catégorie */}
                            <span className="text-xs" style={{ color: catDef.color }}>
                              {catDef.icon} {catDef.label}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">
                            {det.cameraId.slice(0,12)}... · {det.source === "browser_webrtc" ? "WebRTC" : "RTSP"} ·{" "}
                            {new Date(det.detectedAt).toLocaleTimeString("fr-CA")}
                          </p>
                        </div>

                        {/* Confiance */}
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-bold" style={{ color: catDef.color }}>
                            {Math.round(det.confidence * 100)}%
                          </p>
                          <div className="mt-1 h-1 w-16 rounded-full bg-slate-800">
                            <div className="h-1 rounded-full"
                              style={{ width:`${det.confidence*100}%`, background: catDef.color }} />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Détail */}
          {selected && (
            <div className="w-72 shrink-0 rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-3xl">
                  {CATEGORY_LABELS[selected.category]?.icon ?? "📦"}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-white">{selected.label}</h3>
                  <p className="text-xs text-slate-500">{selected.category}</p>
                </div>
              </div>

              {/* Snapshot */}
              {selected.snapshotUrl ? (
                <img src={selected.snapshotUrl} alt={selected.label}
                  className="mb-4 w-full rounded-lg object-cover border border-slate-700"
                  style={{ maxHeight:"160px" }} />
              ) : (
                <div className="mb-4 flex h-32 items-center justify-center rounded-lg bg-slate-800 text-xs text-slate-600">
                  Snapshot non disponible
                  <br />(Storage pas encore activé)
                </div>
              )}

              {/* Détails */}
              <div className="space-y-2 text-xs">
                {[
                  ["Classe",     selected.type],
                  ["Catégorie",  CATEGORY_LABELS[selected.category]?.label ?? selected.category],
                  ["Confiance",  `${Math.round(selected.confidence * 100)}%`],
                  ["Sévérité",   selected.severity],
                  ["Source",     selected.source === "browser_webrtc" ? "📱 WebRTC" : "📹 RTSP"],
                  ["Détecté à",  new Date(selected.detectedAt).toLocaleString("fr-CA")],
                ].map(([l, v]) => (
                  <div key={l as string} className="flex justify-between gap-2">
                    <span className="text-slate-500 shrink-0">{l}</span>
                    <span className="text-slate-300 text-right">{v}</span>
                  </div>
                ))}
              </div>

              <a href={`https://console.firebase.google.com/project/ai-guard-vision-8ef41/firestore/data/organizations/${currentOrg?.id}/detections/${selected.id}`}
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
