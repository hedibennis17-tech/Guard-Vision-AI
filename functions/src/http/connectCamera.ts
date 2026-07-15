import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { ConnectorEngine } from "../../connectors/src/engine/ConnectorEngine";
import type { ConnectorType, ConnectorCredentials } from "../../connectors/src/types";

const engine = new ConnectorEngine({
  ringCallbackUrl: process.env.VISIONGUARD_CALLBACK_URL,
  nestProjectId: process.env.GOOGLE_SDM_PROJECT_ID,
});

interface ConnectCameraInput {
  organizationId: string;
  cameraId: string;
  connectorType: ConnectorType;
  credentials: ConnectorCredentials;
}

/**
 * Teste la connexion à une caméra, récupère les infos device et le streamUrl,
 * puis met à jour le document Firestore cameras/{cameraId} avec status "online".
 * Les credentials sont stockées dans camera_credentials/{cameraId} (jamais dans cameras/).
 */
export const connectCamera = onCall<ConnectCameraInput>(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentification requise.");

  const { organizationId, cameraId, connectorType, credentials } = request.data;
  if (!organizationId || !cameraId || !connectorType) {
    throw new HttpsError("invalid-argument", "Champs requis manquants.");
  }

  const db = admin.firestore();
  const now = new Date().toISOString();

  // Vérifier le membership
  const memberSnap = await db
    .collection("organizations").doc(organizationId)
    .collection("members").doc(request.auth.uid)
    .get();
  if (!memberSnap.exists || !["owner", "admin", "manager"].includes(memberSnap.data()?.role)) {
    throw new HttpsError("permission-denied", "Rôle insuffisant.");
  }

  // Tester la connexion via le ConnectorEngine
  const result = await engine.testConnection(connectorType, credentials);
  if (!result.success) {
    throw new HttpsError("unavailable", result.errorMessage ?? "Connexion échouée.");
  }

  const batch = db.batch();

  // Mettre à jour le document caméra (métadonnées publiques uniquement)
  const cameraRef = db
    .collection("organizations").doc(organizationId)
    .collection("cameras").doc(cameraId);

  batch.update(cameraRef, {
    status: "online",
    streamUrl: result.streamUrl,
    ...(result.deviceInfo?.model && { model: result.deviceInfo.model }),
    ...(result.deviceInfo?.manufacturer && { brand: result.deviceInfo.manufacturer }),
    updatedAt: now,
  });

  // Stocker les credentials chiffrées séparément (Admin SDK bypass les règles Firestore)
  if (credentials.password || credentials.accessToken || credentials.refreshToken) {
    const credRef = db
      .collection("organizations").doc(organizationId)
      .collection("camera_credentials").doc(cameraId);

    batch.set(credRef, {
      cameraId,
      connector: connectorType,
      // En production : chiffrer avec KMS avant de stocker
      encryptedSecret: JSON.stringify(credentials),
      updatedAt: now,
    });
  }

  await batch.commit();

  return {
    success: true,
    streamUrl: result.streamUrl,
    deviceInfo: result.deviceInfo,
    latencyMs: result.latencyMs,
  };
});

interface DiscoverCamerasInput {
  organizationId: string;
  timeoutMs?: number;
}

/** Scan réseau ONVIF — retourne les caméras trouvées sur le LAN. */
export const discoverCameras = onCall<DiscoverCamerasInput>(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentification requise.");
  const devices = await engine.discoverOnvif({ timeoutMs: request.data.timeoutMs ?? 5000 });
  return { devices };
});
