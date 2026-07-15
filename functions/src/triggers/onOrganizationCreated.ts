import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

/**
 * Quand une organisation est créée :
 * 1. Crée automatiquement sa Subscription en plan "free"
 * 2. Crée le membership "owner" pour le créateur
 *
 * Ceci garantit qu'aucune organisation n'existe jamais sans abonnement associé
 * (invariant requis par les règles Firestore et par tout le reste de l'app).
 */
export const onOrganizationCreated = onDocumentCreated(
  "organizations/{orgId}",
  async (event) => {
    const orgId = event.params.orgId;
    const org = event.data?.data();
    if (!org) return;

    const db = admin.firestore();
    const now = new Date().toISOString();

    const subscriptionRef = db.collection("subscriptions").doc();

    const batch = db.batch();

    batch.set(subscriptionRef, {
      id: subscriptionRef.id,
      organizationId: orgId,
      planId: "free",
      status: "trialing",
      currentCameraCount: 0,
      currentSiteCount: 0,
      currentUserCount: 1,
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: now,
      updatedAt: now,
    });

    batch.update(db.collection("organizations").doc(orgId), {
      subscriptionId: subscriptionRef.id,
    });

    const memberRef = db
      .collection("organizations")
      .doc(orgId)
      .collection("members")
      .doc(org.ownerId);

    batch.set(memberRef, {
      userId: org.ownerId,
      organizationId: orgId,
      role: "owner",
      status: "active",
      joinedAt: now,
      createdAt: now,
    });

    await batch.commit();
  }
);
