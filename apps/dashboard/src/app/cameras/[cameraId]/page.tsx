"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { getCameraById } from "@/lib/hooks/useCameras";
import { startStream, stopStream, STATUS_LABELS, STATUS_COLORS, CONNECTOR_LABELS } from "@/lib/services/cameraService";
import { useOrganization } from "@/lib/context/OrganizationContext";
import type { CameraDoc } from "@visionguard/shared";

export default function CameraDetailPage() {
  const params = useParams();
  const cameraId = params.cameraId as string;
  const { currentOrg } = useOrganization();
  const [camera,    setCamera]    = useState<CameraDoc | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [hlsUrl,    setHlsUrl]    = useState<string | null>(null);

  useEffect(() => {
    if (!currentOrg?.id || !cameraId) return;
    getCameraById(currentOrg.id, cameraId).then((cam) => {
      setCamera(cam);
      setLoading(false);
    });
  }, [currentOrg?.id, cameraId]);

  async function handleStream() {
    if (!currentOrg?.id || !camera) return;
    if (streaming) {
      await stopStream(currentOrg.id, camera.id);
      setStreaming(false);
      setHlsUrl(null);
    } else {
      const result = await startStream(currentOrg.id, camera.id);
      setHlsUrl(result.hlsUrl);
      setStreaming(true);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
    </div>
  );

  if (!camera) return (
    <div className="text-center py-20">
      <p className="text-slate-400">Caméra introuvable.</p>
      <Link href="/cameras" className="mt-4 inline-block text-sm text-brand hover:underline">← Retour aux caméras</Link>
    </div>
  );

  const statusCfg = STATUS_COLORS[camera.status];

  return (
    <div>
      <div className="mb-6 flex items-center gap-3 text-sm text-slate-500">
        <Link href="/cameras" className="hover:text-slate-300">Caméras</Link>
        <span>/</span>
        <span className="text-slate-300">{camera.name}</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">{camera.name}</h1>
          <p className="mt-1 text-sm text-slate-400">{camera.brand}{camera.model ? ` · ${camera.model}` : ""}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusCfg}`}>
            {camera.status === "online" && <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />}
            {STATUS_LABELS[camera.status]}
          </span>
          <button onClick={handleStream} disabled={camera.status !== "online"}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40 ${
              streaming ? "bg-red-600 text-white" : "bg-brand text-white hover:bg-brand/90"
            }`}>
            {streaming ? "⏹ Arrêter" : "▶ Démarrer le flux"}
          </button>
          <Link href={`/cameras/${camera.id}/edit`}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500">
            ✏️ Modifier
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Flux vidéo */}
        <div className="lg:col-span-2 space-y-4">
          <div className="aspect-video rounded-xl border border-slate-800 bg-black flex items-center justify-center overflow-hidden">
            {streaming && hlsUrl ? (
              <div className="text-center">
                <p className="text-emerald-400 text-sm font-medium mb-2">🔴 LIVE</p>
                <p className="text-slate-500 text-xs">HLS : {hlsUrl}</p>
                <p className="text-slate-600 text-xs mt-1">Player HLS à brancher (hls.js / video.js)</p>
              </div>
            ) : (
              <div className="text-center">
                <span className="text-4xl">📷</span>
                <p className="mt-3 text-sm text-slate-500">
                  {camera.status === "online"
                    ? "Cliquez sur 'Démarrer le flux' pour voir le live."
                    : "Caméra hors ligne — vérifiez la connexion."}
                </p>
              </div>
            )}
          </div>

          {/* Onglets */}
          <div className="rounded-xl border border-slate-800 bg-slate-900">
            <div className="flex border-b border-slate-800">
              {["Événements récents","Détections","Historique"].map((tab, i) => (
                <button key={tab} className={`px-4 py-3 text-xs font-medium ${i===0 ? "text-brand border-b-2 border-brand" : "text-slate-500 hover:text-slate-300"}`}>
                  {tab}
                </button>
              ))}
            </div>
            <div className="p-4 text-center text-sm text-slate-600 py-8">
              Connecter Firebase pour afficher les événements de cette caméra.
            </div>
          </div>
        </div>

        {/* Fiche technique */}
        <div className="space-y-4">
          {/* Identité */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Identité</h2>
            <div className="space-y-3">
              {[
                { label:"ID",          value: camera.id.slice(0,12) + "..." },
                { label:"Nom",         value: camera.name         },
                { label:"Marque",      value: camera.brand        },
                { label:"Modèle",      value: camera.model ?? "—" },
                { label:"Connecteur",  value: CONNECTOR_LABELS[camera.connector] },
                { label:"Emplacement", value: camera.location ?? "—" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{label}</span>
                  <span className="text-xs text-slate-300 font-mono">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* État technique */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">État</h2>
            <div className="space-y-3">
              {camera.batteryLevel !== undefined && (
                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-slate-500">Batterie</span>
                    <span className={`font-medium ${camera.batteryLevel < 20 ? "text-red-400" : "text-slate-300"}`}>
                      {camera.batteryLevel}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800">
                    <div className={`h-1.5 rounded-full ${camera.batteryLevel < 20 ? "bg-red-500" : "bg-emerald-500"}`}
                      style={{width:`${camera.batteryLevel}%`}} />
                  </div>
                </div>
              )}
              {camera.signalQuality !== undefined && (
                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-slate-500">Signal</span>
                    <span className="font-medium text-slate-300">{camera.signalQuality}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800">
                    <div className="h-1.5 rounded-full bg-brand" style={{width:`${camera.signalQuality}%`}} />
                  </div>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Timezone</span>
                <span className="text-slate-300">{camera.timezone || "—"}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Créée le</span>
                <span className="text-slate-300">
                  {camera.createdAt ? new Date(camera.createdAt).toLocaleDateString("fr-CA") : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Modules IA actifs */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Détection IA</h2>
            {camera.enabledDetectionTypes?.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {camera.enabledDetectionTypes.map((t) => (
                  <span key={t} className="rounded-full bg-brand/10 border border-brand/30 px-2 py-0.5 text-xs text-brand">
                    {t}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-600">
                Aucune détection configurée — activez un module dans le Marketplace.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
