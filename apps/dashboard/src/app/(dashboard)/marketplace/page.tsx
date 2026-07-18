"use client";

import { useState, useEffect } from "react";
import { doc, setDoc, getDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { db, auth } from "@/lib/firebase/client";
import { useOrganization } from "@/lib/context/OrganizationContext";
import {
  AI_BUNDLES, AI_MODELS, BUNDLE_STATUS_LABELS,
  getBundlesByStatus, type AIBundle, type BundleStatus,
} from "@/lib/orchestrator/bundles";

type Tab = "bundles" | "models" | "workflows";

export default function MarketplacePage() {
  const { currentOrg } = useOrganization();
  const [tab,          setTab]          = useState<Tab>("bundles");
  const [selected,     setSelected]     = useState<AIBundle | null>(null);
  const [installing,   setInstalling]   = useState<string | null>(null);
  const [installed,    setInstalled]    = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<BundleStatus | "all">("all");

  // Charger les modules installés
  useEffect(() => {
    if (!currentOrg?.id) return;
    getDocs(collection(db, "organizations", currentOrg.id, "modules"))
      .then(snap => {
        const active = snap.docs.filter(d => d.data()?.enabled).map(d => d.id);
        setInstalled(new Set(active));
      }).catch(() => {});
  }, [currentOrg?.id]);

  async function installBundle(bundle: AIBundle) {
    if (!currentOrg?.id || !auth.currentUser) return;
    setInstalling(bundle.id);
    try {
      const now = new Date().toISOString();
      await setDoc(doc(db, "organizations", currentOrg.id, "modules", bundle.id), {
        slug:           bundle.id,
        organizationId: currentOrg.id,
        name:           bundle.name,
        enabled:        true,
        models:         bundle.models,
        detectionClasses: bundle.detectionClasses,
        enabledAt:      now,
        enabledBy:      auth.currentUser.uid,
      });
      setInstalled(prev => new Set([...prev, bundle.id]));
    } catch (err: any) {
      alert("Erreur installation : " + err.message);
    } finally {
      setInstalling(null);
    }
  }

  async function uninstallBundle(bundleId: string) {
    if (!currentOrg?.id) return;
    await deleteDoc(doc(db, "organizations", currentOrg.id, "modules", bundleId));
    setInstalled(prev => { const s = new Set(prev); s.delete(bundleId); return s; });
  }

  const filteredBundles = (filterStatus === "all"
    ? AI_BUNDLES
    : AI_BUNDLES.filter(b => b && b.status === filterStatus)).filter(Boolean) as AIBundle[];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 px-6 py-6">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-2xl font-bold text-white">Vision Guard AI Hub</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              App Store d'Intelligence Artificielle · {installed.size} bundle{installed.size !== 1 ? "s" : ""} installé{installed.size !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p className="text-slate-300 font-medium">{AI_BUNDLES.length} bundles</p>
            <p>{Object.keys(AI_MODELS).length} modèles IA</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-1 rounded-xl bg-slate-900 p-1 w-fit">
          {([
            { id:"bundles",   label:"🧩 Bundles IA",    count: AI_BUNDLES.length },
            { id:"models",    label:"🤖 Modèles",        count: Object.keys(AI_MODELS).length },
            { id:"workflows", label:"⚡ Workflows",      count: 0 },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.id ? "bg-brand text-white" : "text-slate-400 hover:text-white"
              }`}>
              {t.label}
              {t.count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-xs ${
                  tab === t.id ? "bg-white/20" : "bg-slate-800"
                }`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex h-[calc(100vh-180px)]">
        {/* Colonne gauche — liste */}
        <div className="w-96 shrink-0 border-r border-slate-800 overflow-y-auto">

          {tab === "bundles" && (
            <div>
              {/* Filtres */}
              <div className="sticky top-0 bg-slate-950 border-b border-slate-800 px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {(["all","available","beta","coming_soon","enterprise"] as const).map(f => (
                    <button key={f} onClick={() => setFilterStatus(f)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        filterStatus === f
                          ? "bg-brand border-brand text-white"
                          : "border-slate-700 text-slate-400 hover:text-white"
                      }`}>
                      {f === "all" ? `Tous (${AI_BUNDLES.length})`
                        : f === "coming_soon" ? "Bientôt"
                        : f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bundles installés en premier */}
              {installed.size > 0 && filterStatus === "all" && (
                <div className="px-4 pt-4 pb-2">
                  <p className="text-xs font-semibold text-emerald-400 mb-2">✅ INSTALLÉS</p>
                  {filteredBundles.filter(b => b && installed.has(b.id)).map(bundle => bundle && (
                    <BundleCard key={bundle.id} bundle={bundle} isInstalled={true}
                      isSelected={selected?.id === bundle.id}
                      onClick={() => setSelected(bundle)} />
                  ))}
                  <div className="mt-3 mb-1 border-t border-slate-800" />
                  <p className="text-xs font-semibold text-slate-500 mb-2 mt-3">DISPONIBLES</p>
                </div>
              )}

              <div className="px-4 pt-2 space-y-2 pb-4">
                {filteredBundles.filter(b => !installed.has(b.id) || filterStatus !== "all")
                  .map(bundle => (
                    <BundleCard key={bundle.id} bundle={bundle}
                      isInstalled={installed.has(bundle.id)}
                      isSelected={selected?.id === bundle.id}
                      onClick={() => setSelected(bundle)} />
                  ))}
              </div>
            </div>
          )}

          {tab === "models" && (
            <div className="px-4 py-4 space-y-3">
              <p className="text-xs text-slate-500">Modèles IA disponibles dans Vision Guard</p>
              {Object.values(AI_MODELS).map(model => (
                <div key={model.id}
                  className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{model.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white">{model.name}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs border ${
                          model.available
                            ? "bg-emerald-900/20 border-emerald-800 text-emerald-400"
                            : "bg-slate-800 border-slate-700 text-slate-500"
                        }`}>
                          {model.available ? "✅ Disponible" : model.comingSoon ? "🔜 Bientôt" : "—"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">v{model.version} · {model.size}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">{model.description}</p>
                  <span className="mt-2 inline-block rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-500">
                    {model.type}
                  </span>
                </div>
              ))}
            </div>
          )}

          {tab === "workflows" && (
            <div className="px-4 py-4">
              <p className="text-xs text-slate-500 mb-4">Workflows automatiques — bientôt disponibles</p>
              {[
                { icon:"🔥", name:"Détection incendie", steps:["YOLO","Smoke/Fire","Notifications SMS","PDF Report"] },
                { icon:"👥", name:"Comptage personnes", steps:["YOLO","ByteTrack","Analytics","Heatmap"] },
                { icon:"🚗", name:"Surveillance parking", steps:["YOLO","OCR Plaques","ByteTrack","Rapport"] },
                { icon:"🏪", name:"Prévention vol retail", steps:["YOLO","SAM","ByteTrack","Alerte","Clip Vidéo"] },
                { icon:"⛑️", name:"Conformité EPI", steps:["YOLO EPI","Zone Danger","Alerte SMS","Rapport Sécu"] },
              ].map(wf => (
                <div key={wf.name} className="mb-3 rounded-xl border border-slate-800 bg-slate-900 p-4 opacity-60">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">{wf.icon}</span>
                    <p className="text-sm font-medium text-white">{wf.name}</p>
                    <span className="ml-auto rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-500">Bientôt</span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {wf.steps.map((step, i) => (
                      <span key={i} className="flex items-center gap-1">
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400">{step}</span>
                        {i < wf.steps.length - 1 && <span className="text-slate-700">→</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Colonne droite — détail */}
        <div className="flex-1 overflow-y-auto">
          {selected ? (
            <BundleDetail
              bundle={selected}
              isInstalled={installed.has(selected.id)}
              installing={installing === selected.id}
              onInstall={() => installBundle(selected)}
              onUninstall={() => uninstallBundle(selected.id)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
              <span className="text-6xl">🧩</span>
              <h2 className="text-xl font-semibold text-white">Vision Guard AI Hub</h2>
              <p className="text-slate-400 max-w-md text-sm">
                Sélectionnez un bundle pour voir les détails et l'installer.
                Chaque bundle active automatiquement les modèles IA nécessaires.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-4 text-xs text-left max-w-sm w-full">
                {[
                  { icon:"🎯", label:"YOLOv11", desc:"Détection temps réel" },
                  { icon:"✂️", label:"SAM 2",   desc:"Segmentation précise" },
                  { icon:"📖", label:"OCR",     desc:"Lecture de texte" },
                  { icon:"🔗", label:"CLIP",    desc:"Vision-langage" },
                  { icon:"👁️", label:"ByteTrack",desc:"Tracking multi-objets" },
                  { icon:"🦙", label:"LLM",     desc:"Analyse contextuelle" },
                ].map(m => (
                  <div key={m.label} className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                    <p className="text-lg mb-1">{m.icon}</p>
                    <p className="font-medium text-slate-300">{m.label}</p>
                    <p className="text-slate-500">{m.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── BundleCard ─────────────────────────────────────────────────────────────

function BundleCard({ bundle, isInstalled, isSelected, onClick }: {
  bundle:       AIBundle;
  isInstalled:  boolean;
  isSelected:   boolean;
  onClick:      () => void;
}) {
  const statusDef = BUNDLE_STATUS_LABELS[bundle.status];
  return (
    <button onClick={onClick}
      className={`w-full rounded-xl border p-4 text-left transition-all ${
        isSelected
          ? "border-brand bg-brand/5"
          : "border-slate-800 bg-slate-900 hover:border-slate-700"
      }`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0">{bundle.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-medium text-white truncate">{bundle.name}</p>
            {bundle.popular && <span className="text-xs text-amber-400">🔥</span>}
            {isInstalled && <span className="text-xs text-emerald-400">✅</span>}
          </div>
          <p className="text-xs text-slate-500 truncate">{bundle.tagline}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs" style={{ color: statusDef.color }}>
              {statusDef.label}
            </span>
            <span className="text-slate-700">·</span>
            <span className="text-xs text-slate-600">{bundle.sector}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ── BundleDetail ─────────────────────────────────────────────────────────────

function BundleDetail({ bundle, isInstalled, installing, onInstall, onUninstall }: {
  bundle:       AIBundle;
  isInstalled:  boolean;
  installing:   boolean;
  onInstall:    () => void;
  onUninstall:  () => void;
}) {
  const statusDef = BUNDLE_STATUS_LABELS[bundle.status];
  const [activeTab, setActiveTab] = useState<"features"|"models"|"workflow"|"classes">("features");

  return (
    <div className="p-6">
      {/* Header bundle */}
      <div className="flex items-start gap-4 mb-6">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-4xl"
          style={{ background: bundle.color + "20", border: `1px solid ${bundle.color}40` }}>
          {bundle.icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-xl font-bold text-white">{bundle.name}</h2>
            <span className="rounded-full border px-2 py-0.5 text-xs font-medium"
              style={{ color:statusDef.color, borderColor:statusDef.color+"40", background:statusDef.color+"10" }}>
              {statusDef.label}
            </span>
          </div>
          <p className="text-sm text-slate-400">{bundle.tagline}</p>
          <p className="text-xs text-slate-500 mt-1">Secteur: {bundle.sector} · Plan requis: {bundle.minPlan}</p>
        </div>

        {/* Bouton installer */}
        <div className="shrink-0">
          {isInstalled ? (
            <button onClick={onUninstall}
              className="rounded-xl border border-red-800 bg-red-900/10 px-5 py-2.5 text-sm font-medium text-red-400 hover:bg-red-900/20">
              🗑️ Désinstaller
            </button>
          ) : bundle.status === "coming_soon" || bundle.status === "enterprise" ? (
            <button disabled
              className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-500 cursor-not-allowed">
              {bundle.status === "enterprise" ? "🔒 Entreprise" : "🔜 Bientôt"}
            </button>
          ) : (
            <button onClick={onInstall} disabled={installing}
              className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              style={{ background: bundle.color }}>
              {installing
                ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Installation...</>
                : "⚡ Installer ce bundle"}
            </button>
          )}
        </div>
      </div>

      <p className="mb-6 text-sm text-slate-300 leading-relaxed">{bundle.description}</p>

      {/* Sub-tabs */}
      <div className="flex gap-1 rounded-lg bg-slate-900 p-1 mb-5 w-fit">
        {(["features","models","workflow","classes"] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === t ? "bg-brand text-white" : "text-slate-400 hover:text-white"
            }`}>
            {t === "features" ? "✅ Fonctionnalités"
             : t === "models"  ? "🤖 Modèles IA"
             : t === "workflow" ? "⚡ Pipeline"
             : "🎯 Classes détectées"}
          </button>
        ))}
      </div>

      {/* Features */}
      {activeTab === "features" && (
        <div className="grid grid-cols-2 gap-2">
          {bundle.features.map((f, i) => (
            <div key={i} className={`flex items-center gap-2.5 rounded-lg border p-3 ${
              f.included
                ? "border-emerald-800/40 bg-emerald-900/10"
                : "border-slate-800 bg-slate-900 opacity-50"
            }`}>
              <span className={f.included ? "text-emerald-400" : "text-slate-600"}>
                {f.included ? "✅" : "○"}
              </span>
              <div>
                <p className="text-xs font-medium text-white">{f.label}</p>
                {f.model && f.model !== "—" && (
                  <p className="text-xs text-slate-500">{f.model}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Models */}
      {activeTab === "models" && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500 mb-4">
            Ces modèles sont activés automatiquement quand vous installez ce bundle.
          </p>
          {bundle.models.map(modelId => {
            const model = AI_MODELS[modelId];
            if (!model) return null;
            return (
              <div key={modelId} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
                <span className="text-2xl">{model.icon}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{model.name} <span className="text-slate-500 text-xs">v{model.version}</span></p>
                  <p className="text-xs text-slate-400">{model.description}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{model.size}</p>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-xs ${
                  model.available
                    ? "border-emerald-800 text-emerald-400"
                    : "border-slate-700 text-slate-500"
                }`}>
                  {model.available ? "✅" : "🔜"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Workflow */}
      {activeTab === "workflow" && (
        <div>
          <p className="text-xs text-slate-500 mb-4">Pipeline d'exécution IA pour ce bundle.</p>
          <div className="space-y-2">
            {bundle.workflow.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex flex-col items-center shrink-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
                    style={{ background: bundle.color + "20", color: bundle.color, border: `1px solid ${bundle.color}40` }}>
                    {i + 1}
                  </div>
                  {i < bundle.workflow.length - 1 && (
                    <div className="w-0.5 h-4 mt-1" style={{ background: bundle.color + "30" }} />
                  )}
                </div>
                <div className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
                  <p className="text-sm text-white">{step}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Classes */}
      {activeTab === "classes" && (
        <div>
          <p className="text-xs text-slate-500 mb-4">
            {bundle.detectionClasses.length} classes détectées par ce bundle.
          </p>
          <div className="flex flex-wrap gap-2">
            {bundle.detectionClasses.map(cls => (
              <span key={cls}
                className="rounded-full border px-3 py-1 text-xs font-medium"
                style={{ borderColor: bundle.color + "40", color: bundle.color, background: bundle.color + "10" }}>
                {cls}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
