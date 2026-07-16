import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

const PLAN_ORDER = ["free","home","pro","business","enterprise"];
const MODULE_MIN_PLAN: Record<string, string> = {
  home:        "free",
  retail:      "pro",
  industry:    "business",
  construction:"business",
  smart_city:  "enterprise",
  agriculture: "pro",
  defense:     "enterprise",
};

function planIndex(plan: string): number {
  return PLAN_ORDER.indexOf(plan);
}

export const enableModule = onCall<{
  organizationId: string;
  slug:           string;
}>(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentification requise.");

  const { organizationId, slug } = request.data;
  const db  = admin.firestore();
  const now = new Date().toISOString();

  // Vérifier rôle (seuls owner/admin peuvent activer un module)
  const memberSnap = await db
    .collection("organizations").doc(organizationId)
    .collection("members").doc(request.auth.uid).get();

  if (!memberSnap.exists || !["owner","admin"].includes(memberSnap.data()?.role)) {
    throw new HttpsError("permission-denied", "Seuls les owners et admins peuvent gérer les modules.");
  }

  // Vérifier que le plan de l'organisation est suffisant
  const orgSnap = await db.collection("organizations").doc(organizationId).get();
  const subSnap = await db.collection("subscriptions")
    .where("organizationId","==",organizationId).limit(1).get();

  if (subSnap.empty) throw new HttpsError("failed-precondition", "Abonnement introuvable.");

  const currentPlan = subSnap.docs[0].data().planId as string;
  const required    = MODULE_MIN_PLAN[slug] ?? "enterprise";

  if (planIndex(currentPlan) < planIndex(required)) {
    throw new HttpsError(
      "failed-precondition",
      `Ce module nécessite le plan "${required}" (plan actuel : "${currentPlan}").`
    );
  }

  await db.collection("organizations").doc(organizationId)
    .collection("modules").doc(slug)
    .set({
      slug,
      organizationId,
      enabled:   true,
      enabledAt: now,
      enabledBy: request.auth.uid,
    });

  return { success: true, slug, enabled: true };
});

export const disableModule = onCall<{
  organizationId: string;
  slug:           string;
}>(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentification requise.");

  const { organizationId, slug } = request.data;
  const db = admin.firestore();

  const memberSnap = await db
    .collection("organizations").doc(organizationId)
    .collection("members").doc(request.auth.uid).get();

  if (!memberSnap.exists || !["owner","admin"].includes(memberSnap.data()?.role)) {
    throw new HttpsError("permission-denied", "Accès refusé.");
  }

  await db.collection("organizations").doc(organizationId)
    .collection("modules").doc(slug)
    .set({ slug, organizationId, enabled: false }, { merge: true });

  return { success: true, slug, enabled: false };
});
