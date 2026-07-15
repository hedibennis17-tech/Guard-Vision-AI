import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

/**
 * startStream — déclenche un stream HLS pour une caméra.
 *
 * En production, cette fonction communique avec le service Python AI Server
 * (qui héberge le LiveStreamManager + FFmpeg). Pour Phase 4, elle met à jour
 * Firestore et retourne une URL HLS simulée.
 *
 * Le service AI Python (Phase 5) écoute les changements Firestore
 * sur cameras/{cameraId} et démarre FFmpeg quand status passe à "streaming".
 */

interface StartStreamInput {
  organizationId: string;
  cameraId: string;
  quality?: "auto" | "hd" | "sd" | "low";
}

export const startStream = onCall<StartStreamInput>(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentification requise.");

  const { organizationId, cameraId, quality = "auto" } = request.data;
  const db = admin.firestore();
  const now = new Date().toISOString();

  // Vérifier le membership
  const memberSnap = await db
    .collection("organizations").doc(organizationId)
    .collection("members").doc(request.auth.uid)
    .get();

  if (!memberSnap.exists || memberSnap.data()?.status !== "active") {
    throw new HttpsError("permission-denied", "Accès refusé.");
  }

  // Récupérer la caméra et son streamUrl
  const cameraSnap = await db
    .collection("organizations").doc(organizationId)
    .collection("cameras").doc(cameraId)
    .get();

  if (!cameraSnap.exists) throw new HttpsError("not-found", "Caméra introuvable.");

  const camera = cameraSnap.data()!;
  if (!camera.streamUrl) {
    throw new HttpsError("failed-precondition", "Caméra non connectée. Lancez connectCamera() d'abord.");
  }

  // Mettre à jour le statut pour signaler au service Python de démarrer FFmpeg
  await db.collection("organizations").doc(organizationId)
    .collection("cameras").doc(cameraId)
    .update({ streamingStatus: "requested", streamingQuality: quality, updatedAt: now });

  // En production : attendre la confirmation du service Python (via Firestore realtime)
  // Pour Phase 4 : retourner l'URL HLS simulée
  const sessionId = `${organizationId}_${cameraId}`.replace(/[^a-z0-9]/gi, "_");
  const hlsUrl = `${process.env.STREAM_SERVER_URL ?? "https://stream.visionguard.ai"}/streams/${sessionId}/stream.m3u8`;

  return { sessionId, hlsUrl, quality };
});

interface StopStreamInput {
  organizationId: string;
  cameraId: string;
}

export const stopStream = onCall<StopStreamInput>(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentification requise.");

  const { organizationId, cameraId } = request.data;
  const db = admin.firestore();

  await db.collection("organizations").doc(organizationId)
    .collection("cameras").doc(cameraId)
    .update({ streamingStatus: "stopped", updatedAt: new Date().toISOString() });

  return { success: true };
});
