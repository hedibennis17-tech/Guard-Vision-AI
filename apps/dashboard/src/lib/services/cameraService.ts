/**
 * cameraService — Phase 3 réel
 * CRUD caméras via les Cloud Functions Firebase.
 * Les données ne sont JAMAIS écrites directement en Firestore côté client —
 * tout passe par les Cloud Functions (vérification quota, credentials chiffrées...).
 */

import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase/client";
import type { CameraDoc, CameraConnectorType } from "@visionguard/shared";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AddCameraInput {
  organizationId: string;
  siteId:         string;
  name:           string;
  brand:          string;
  model?:         string;
  connector:      CameraConnectorType;
  timezone:       string;
  location?:      string;
  groupId?:       string;
}

export interface ConnectCameraInput {
  organizationId: string;
  cameraId:       string;
  connectorType:  CameraConnectorType;
  credentials: {
    host?:         string;
    port?:         number;
    username?:     string;
    password?:     string;
    path?:         string;
    channel?:      number;
    accessToken?:  string;
    refreshToken?: string;
  };
}

export interface ConnectionTestResult {
  success:     boolean;
  streamUrl?:  string;
  latencyMs?:  number;
  errorMessage?: string;
  deviceInfo?: {
    manufacturer?: string;
    model?:        string;
    firmware?:     string;
  };
}

// ─── Cloud Function callables ─────────────────────────────────────────────────

const _addCamera       = httpsCallable(functions, "addCamera");
const _connectCamera   = httpsCallable(functions, "connectCamera");
const _discoverCameras = httpsCallable(functions, "discoverCameras");
const _startStream     = httpsCallable(functions, "startStream");
const _stopStream      = httpsCallable(functions, "stopStream");

// ─── Service API ──────────────────────────────────────────────────────────────

/**
 * Crée une caméra dans Firestore (avec vérification du quota d'abonnement).
 * Retourne l'ID de la caméra créée.
 */
export async function addCamera(input: AddCameraInput): Promise<string> {
  const result = await _addCamera(input);
  const data = result.data as { cameraId: string };
  return data.cameraId;
}

/**
 * Teste la connexion à une caméra et met à jour son statut + streamUrl.
 */
export async function connectCamera(input: ConnectCameraInput): Promise<ConnectionTestResult> {
  const result = await _connectCamera(input);
  return result.data as ConnectionTestResult;
}

/**
 * Scan réseau ONVIF — retourne les caméras trouvées sur le réseau local.
 */
export async function discoverOnvifCameras(
  organizationId: string,
  timeoutMs: number = 5000,
): Promise<{ name: string; host: string; manufacturer?: string; model?: string }[]> {
  const result = await _discoverCameras({ organizationId, timeoutMs });
  const data = result.data as { devices: any[] };
  return data.devices;
}

/**
 * Démarre le stream HLS d'une caméra.
 */
export async function startStream(
  organizationId: string,
  cameraId:       string,
  quality:        "auto" | "hd" | "sd" | "low" = "auto",
): Promise<{ sessionId: string; hlsUrl: string }> {
  const result = await _startStream({ organizationId, cameraId, quality });
  return result.data as { sessionId: string; hlsUrl: string };
}

/**
 * Arrête le stream d'une caméra.
 */
export async function stopStream(
  organizationId: string,
  cameraId:       string,
): Promise<void> {
  await _stopStream({ organizationId, cameraId });
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────

export const CONNECTOR_LABELS: Record<CameraConnectorType, string> = {
  ring:       "Ring",
  nest:       "Google Nest",
  reolink:    "Reolink",
  hikvision:  "Hikvision",
  dahua:      "Dahua",
  axis:       "Axis",
  onvif:      "ONVIF",
  rtsp:       "RTSP / IP",
  generic_ip: "IP Générique",
};

export const STATUS_LABELS: Record<CameraDoc["status"], string> = {
  online:     "En ligne",
  offline:    "Hors ligne",
  connecting: "Connexion...",
  error:      "Erreur",
};

export const STATUS_COLORS: Record<CameraDoc["status"], string> = {
  online:     "text-emerald-400 bg-emerald-500/10 border-emerald-800",
  offline:    "text-slate-400 bg-slate-800 border-slate-700",
  connecting: "text-brand bg-brand/10 border-brand/30",
  error:      "text-red-400 bg-red-500/10 border-red-800",
};
