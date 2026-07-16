import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

interface AcknowledgeEventInput {
  organizationId: string;
  eventId: string;
}

/**
 * Acquitte un événement (marque comme vu/traité par un utilisateur).
 * Seuls les rôles owner/admin/manager peuvent acquitter.
 */
export const acknowledgeEvent = onCall<AcknowledgeEventInput>(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentification requise.");

  const { organizationId, eventId } = request.data;
  const db  = admin.firestore();
  const now = new Date().toISOString();

  const memberSnap = await db
    .collection("organizations").doc(organizationId)
    .collection("members").doc(request.auth.uid)
    .get();

  if (
    !memberSnap.exists ||
    !["owner", "admin", "manager"].includes(memberSnap.data()?.role)
  ) {
    throw new HttpsError("permission-denied", "Rôle insuffisant pour acquitter un événement.");
  }

  await db
    .collection("organizations").doc(organizationId)
    .collection("events").doc(eventId)
    .update({
      acknowledged:   true,
      acknowledgedBy: request.auth.uid,
      acknowledgedAt: now,
      updatedAt:      now,
    });

  return { success: true };
});
