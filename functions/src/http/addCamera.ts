import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { canAddCamera } from "../lib/plans";

interface AddCameraInput {
  organizationId: string;
  siteId: string;
  name: string;
  brand: string;
  connector: string;
  timezone: string;
}

/**
 * Point d'entrée unique pour ajouter une caméra. Le Dashboard et l'app mobile
 * appellent CETTE fonction plutôt que d'écrire directement dans Firestore,
 * pour garantir que la limite du plan d'abonnement est toujours respectée
 * (voir Phase 2 — Gestion des abonnements).
 *
 * La connexion réelle au flux (RTSP/ONVIF/Ring/...) sera branchée en Phase 3
 * (Camera Connector Engine) ; pour l'instant cette fonction crée uniquement
 * le document `cameras/{id}` avec status "connecting".
 */
export const addCamera = onCall<AddCameraInput>(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentification requise.");
  }

  const { organizationId, siteId, name, brand, connector, timezone } = request.data;
  if (!organizationId || !siteId || !name || !connector) {
    throw new HttpsError("invalid-argument", "Champs requis manquants.");
  }

  const db = admin.firestore();

  // Vérifie que l'appelant est bien membre de l'organisation avec les droits suffisants.
  const memberSnap = await db
    .collection("organizations")
    .doc(organizationId)
    .collection("members")
    .doc(request.auth.uid)
    .get();

  if (!memberSnap.exists || memberSnap.data()?.status !== "active") {
    throw new HttpsError("permission-denied", "Vous n'êtes pas membre actif de cette organisation.");
  }
  const role = memberSnap.data()?.role;
  if (!["owner", "admin", "manager"].includes(role)) {
    throw new HttpsError("permission-denied", "Rôle insuffisant pour ajouter une caméra.");
  }

  const orgSnap = await db.collection("organizations").doc(organizationId).get();
  const subscriptionId = orgSnap.data()?.subscriptionId;
  if (!subscriptionId) {
    throw new HttpsError("failed-precondition", "Aucun abonnement associé à cette organisation.");
  }

  const subRef = db.collection("subscriptions").doc(subscriptionId);

  return db.runTransaction(async (tx) => {
    const subSnap = await tx.get(subRef);
    const sub = subSnap.data();
    if (!sub) throw new HttpsError("not-found", "Abonnement introuvable.");

    if (!canAddCamera(sub.planId, sub.currentCameraCount)) {
      throw new HttpsError(
        "resource-exhausted",
        `Limite de caméras atteinte pour le plan "${sub.planId}". Veuillez mettre à niveau votre abonnement.`
      );
    }

    const now = new Date().toISOString();
    const cameraRef = db
      .collection("organizations")
      .doc(organizationId)
      .collection("cameras")
      .doc();

    tx.set(cameraRef, {
      id: cameraRef.id,
      organizationId,
      siteId,
      name,
      brand,
      connector,
      status: "connecting",
      timezone,
      enabledDetectionTypes: [],
      createdAt: now,
      updatedAt: now,
      createdBy: request.auth!.uid,
    });

    tx.update(subRef, {
      currentCameraCount: admin.firestore.FieldValue.increment(1),
      updatedAt: now,
    });

    return { cameraId: cameraRef.id };
  });
});
