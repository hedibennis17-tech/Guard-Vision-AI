"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { useCameras } from "@/lib/hooks/useCameras";
import { useOrganization } from "@/lib/context/OrganizationContext";
import { STATUS_LABELS, STATUS_COLORS, CONNECTOR_LABELS } from "@/lib/services/cameraService";
import type { CameraDoc } from "@visionguard/shared";

type FilterStatus = "all" | CameraDoc["status"];

export default function CamerasPage() {
  const { currentOrg, subscription } = useOrganization();
  const { cameras, loading, error }  = useCameras(currentOrg?.id ?? null);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [search,       setSearch]       = useState("");

  const filtered = cameras.filter((cam) => {
    if (statusFilter !== "all" && cam.status !== statusFilter) return false;
    if (search && !cam.name.toLowerCase().includes(search.toLowerCase()) &&
                  !cam.brand.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const onlineCount  = cameras.filter((c) => c.status === "online").length;
  const offlineCount = cameras.filter((c) => c.status === "offline").length;
  const errorCount   = cameras.filter((c) => c.status === "error").length;

  // Quota d'abonnement
  const maxCams = subscription?.planId === "free" ? 1
    : subscription?.planId === "home"     ? 5
    : subscription?.planId === "pro"      ? 10
    : subscription?.planId === "business" ? 20
    : -1;
  const usedCams = subscription?.currentCameraCount ?? cameras.length;

  return (
    <div>
      <PageHeader
        title="Cameras"
        description={currentOrg ? `Organisation : ${currentOrg.name}` : "Sélectionnez une organisation."}
      />

      {/* Quota + bouton ajouter */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Compteurs rapides */}
          {[
            { label: "En ligne",  count: onlineCount,  color: "text-emerald-400" },
            { label: "Hors ligne",count: offlineCount, color: "text-slate-400"   },
            { label: "Erreur",    count: errorCount,   color: "text-red-400"     },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-1.5 text-sm">
              <span className={`font-semibold ${s.color}`}>{s.count}</span>
              <span className="text-slate-500">{s.label}</span>
            </div>
          ))}

          {maxCams !== -1 && (
            <div className="ml-4 flex items-center gap-2 text-xs text-slate-500">
              <div className="h-1.5 w-24 rounded-full bg-slate-800">
                <div
                  className={`h-1.5 rounded-full ${usedCams >= maxCams ? "bg-red-500" : "bg-brand"}`}
                  style={{ width: `${Math.min((usedCams / maxCams) * 100, 100)}%` }}
                />
              </div>
              <span>{usedCams} / {maxCams} caméras</span>
            </div>
          )}
        </div>

        <Link
          href="/cameras/add"
          className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white"
        >
          + Ajouter une caméra
        </Link>
      </div>

      {/* Filtres */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une caméra..."
          className="w-56 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600"
        />
        <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
          {(["all","online","offline","error","connecting"] as FilterStatus[]).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === s ? "bg-brand text-white" : "text-slate-400 hover:text-slate-200"
              }`}>
              {s === "all" ? "Toutes" : STATUS_LABELS[s as CameraDoc["status"]]}
            </button>
          ))}
        </div>
      </div>

      {/* États de chargement */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <span className="ml-3 text-sm text-slate-400">Chargement des caméras...</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-900 bg-red-900/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 py-16 text-center">
          <span className="mb-3 text-4xl">📷</span>
          <p className="mb-1 text-sm font-medium text-slate-300">
            {cameras.length === 0 ? "Aucune caméra connectée" : "Aucune caméra correspond aux filtres"}
          </p>
          <p className="mb-5 text-xs text-slate-600">
            {cameras.length === 0
              ? "Ajoutez votre première caméra pour commencer la surveillance."
              : "Modifiez les filtres pour voir d'autres caméras."
            }
          </p>
          {cameras.length === 0 && (
            <Link href="/cameras/add"
              className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white">
              + Ajouter une caméra
            </Link>
          )}
        </div>
      )}

      {/* Grille de caméras */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((cam) => (
            <CameraCard key={cam.id} camera={cam} organizationId={currentOrg?.id ?? ""} />
          ))}
        </div>
      )}
    </div>
  );
}

function CameraCard({ camera, organizationId }: { camera: CameraDoc; organizationId: string }) {
  const statusCfg = STATUS_COLORS[camera.status];

  return (
    <Link
      href={`/cameras/${camera.id}`}
      className="group block rounded-xl border border-slate-800 bg-slate-900 p-4 transition-all hover:border-slate-700"
    >
      {/* Preview placeholder */}
      <div className="relative mb-3 flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-black">
        <span className="text-slate-700 text-xs">
          {camera.status === "online" ? "Flux live — brancher Firebase" : "📵 Hors ligne"}
        </span>
        {/* Badge statut */}
        <div className={`absolute top-2 left-2 flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${statusCfg}`}>
          {camera.status === "online" && (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          )}
          {STATUS_LABELS[camera.status]}
        </div>
        {/* Badge connecteur */}
        <div className="absolute top-2 right-2 rounded-full border border-slate-700 bg-slate-900/80 px-2 py-0.5 text-xs text-slate-400">
          {CONNECTOR_LABELS[camera.connector]}
        </div>
      </div>

      {/* Infos */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="truncate font-medium text-white group-hover:text-brand transition-colors">
            {camera.name}
          </h3>
          <p className="text-xs text-slate-500">{camera.brand}{camera.model ? ` · ${camera.model}` : ""}</p>
        </div>
        <span className="ml-2 text-xs text-brand opacity-0 transition-opacity group-hover:opacity-100">
          Voir →
        </span>
      </div>

      {/* Métriques */}
      <div className="mt-3 flex items-center gap-4 border-t border-slate-800 pt-3">
        {camera.batteryLevel !== undefined && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>{camera.batteryLevel >= 50 ? "🔋" : camera.batteryLevel >= 20 ? "🪫" : "❗"}</span>
            <span>{camera.batteryLevel}%</span>
          </div>
        )}
        {camera.signalQuality !== undefined && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>📶</span>
            <span>{camera.signalQuality}%</span>
          </div>
        )}
        {camera.location && (
          <div className="flex items-center gap-1 text-xs text-slate-500 ml-auto">
            <span>📍</span>
            <span className="truncate max-w-24">{camera.location}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
