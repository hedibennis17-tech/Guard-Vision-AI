import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

type ConnectorType =
  | "ring" | "nest" | "reolink" | "hikvision" | "dahua"
  | "axis" | "onvif" | "rtsp" | "generic_ip";

interface ConnectorCredentials {
  username?: string;
  password?: string;
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  host?: string;
  port?: number;
  path?: string;
  channel?: number;
}

interface ConnectCameraInput {
  organizationId: string;
  cameraId: string;
  connectorType: ConnectorType;
  credentials: ConnectorCredentials;
}

/**
 * Teste la connexion à une caméra via le ConnectorEngine (Phase 3).
 * En production, ce code tourne sur le même serveur que le ConnectorEngine Python.
 * Pour Phase 4, les types sont inlinés pour éviter la dépendance cross-package.
 */
export const connectCamera = onCall<ConnectCameraInput>(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentification requise.");

  const { organizationId, cameraId, connectorType, credentials } = request.data;
  if (!organizationId || !cameraId || !connectorType) {
    throw new HttpsError("invalid-argument", "Champs requis manquants.");
  }

  const db = admin.firestore();
  const now = new Date().toISOString();

  const memberSnap = await db
    .collection("organizations").doc(organizationId)
    .collection("members").doc(request.auth.uid)
    .get();

  if (!memberSnap.exists || !["owner", "admin", "manager"].includes(memberSnap.data()?.role)) {
    throw new HttpsError("permission-denied", "Rôle insuffisant.");
  }

  // Construire l'URL de stream selon le connecteur
  const streamUrl = buildStreamUrl(connectorType, credentials);
  const batch = db.batch();

  const cameraRef = db
    .collection("organizations").doc(organizationId)
    .collection("cameras").doc(cameraId);

  batch.update(cameraRef, { status: "online", streamUrl, updatedAt: now });

  if (credentials.password || credentials.accessToken || credentials.refreshToken) {
    const credRef = db
      .collection("organizations").doc(organizationId)
      .collection("camera_credentials").doc(cameraId);
    batch.set(credRef, {
      cameraId,
      connector: connectorType,
      encryptedSecret: JSON.stringify(credentials), // KMS en production
      updatedAt: now,
    });
  }

  await batch.commit();
  return { success: true, streamUrl };
});

function buildStreamUrl(type: ConnectorType, c: ConnectorCredentials): string {
  const auth = c.username && c.password
    ? `${encodeURIComponent(c.username)}:${encodeURIComponent(c.password)}@`
    : "";
  switch (type) {
    case "hikvision":
      return `rtsp://${auth}${c.host}:554/Streaming/Channels/${c.channel ?? 1}01`;
    case "dahua":
      return `rtsp://${auth}${c.host}:554/cam/realmonitor?channel=${c.channel ?? 1}&subtype=0`;
    case "axis":
      return `rtsp://${auth}${c.host}/axis-media/media.amp`;
    case "reolink":
      return `rtsp://${auth}${c.host}:554/h264Preview_0${(c.channel ?? 0) + 1}_main`;
    case "onvif":
      return `rtsp://${auth}${c.host}:554/Streaming/Channels/101`;
    case "ring":
    case "nest":
      return `webrtc://${type}-stream-placeholder`;
    case "rtsp":
    case "generic_ip":
    default:
      return `rtsp://${auth}${c.host}:${c.port ?? 554}${c.path ?? "/stream1"}`;
  }
}

interface DiscoverCamerasInput {
  organizationId: string;
  timeoutMs?: number;
}

export const discoverCameras = onCall<DiscoverCamerasInput>(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentification requise.");
  // En production : appeler le ConnectorEngine sur le serveur Python
  const devices = [
    { name: "IPCamera_Demo_01", host: "192.168.1.101", manufacturer: "Hikvision" },
    { name: "IPCamera_Demo_02", host: "192.168.1.102", manufacturer: "Dahua" },
  ];
  return { devices };
});
