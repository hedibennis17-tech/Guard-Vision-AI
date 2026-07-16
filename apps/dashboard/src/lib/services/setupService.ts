/**
 * SetupService — Initialisation complète pour un nouvel utilisateur.
 * Crée directement dans Firestore SANS Cloud Functions.
 * Nécessite uniquement Firebase Auth + Firestore activés.
 */

import {
  doc, setDoc, getDoc, collection, addDoc,
  serverTimestamp, query, where, getDocs,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase/client";

export interface SetupStatus {
  authenticated:    boolean;
  hasOrganization:  boolean;
  hasCamera:        boolean;
  functionsDeployed: boolean;
  organizationId?:  string;
  organizationName?: string;
  error?:           string;
}

/** Vérifie l'état complet du setup */
export async function checkSetup(): Promise<SetupStatus> {
  const user = auth.currentUser;

  if (!user) {
    return { authenticated: false, hasOrganization: false, hasCamera: false, functionsDeployed: false };
  }

  try {
    // Chercher l'organisation de l'utilisateur
    const userSnap = await getDoc(doc(db, "users", user.uid));
    const userData = userSnap.data();
    const orgId    = userData?.defaultOrganizationId;

    if (!orgId) {
      return { authenticated: true, hasOrganization: false, hasCamera: false, functionsDeployed: false };
    }

    // Vérifier l'organisation
    const orgSnap = await getDoc(doc(db, "organizations", orgId));
    if (!orgSnap.exists()) {
      return { authenticated: true, hasOrganization: false, hasCamera: false, functionsDeployed: false };
    }

    // Vérifier les caméras
    const camsSnap = await getDocs(
      collection(db, "organizations", orgId, "cameras")
    );

    // Tester si les Cloud Functions sont déployées (appel rapide)
    let functionsDeployed = false;
    try {
      const { httpsCallable } = await import("firebase/functions");
      const { functions }     = await import("@/lib/firebase/client");
      // On ne fait pas vraiment l'appel, on vérifie juste si la config est là
      functionsDeployed = !!functions;
    } catch {}

    return {
      authenticated:     true,
      hasOrganization:   true,
      hasCamera:         camsSnap.size > 0,
      functionsDeployed,
      organizationId:    orgId,
      organizationName:  orgSnap.data()?.name,
    };
  } catch (err: any) {
    return {
      authenticated: !!user,
      hasOrganization: false,
      hasCamera: false,
      functionsDeployed: false,
      error: err.message,
    };
  }
}

/**
 * Crée tout le nécessaire pour un nouvel utilisateur EN DIRECT dans Firestore.
 * Ne nécessite PAS les Cloud Functions.
 */
export async function quickSetup(organizationName: string = "Mon organisation"): Promise<{
  organizationId: string;
  subscriptionId: string;
}> {
  const user = auth.currentUser;
  if (!user) throw new Error("Vous devez être connecté.");

  const now   = new Date().toISOString();
  const orgId = doc(collection(db, "organizations")).id;
  const subId = doc(collection(db, "subscriptions")).id;

  // 1. Organisation
  await setDoc(doc(db, "organizations", orgId), {
    id:             orgId,
    name:           organizationName,
    slug:           organizationName.toLowerCase().replace(/\s+/g, "-"),
    ownerId:        user.uid,
    vertical:       "home",
    subscriptionId: subId,
    timezone:       Intl.DateTimeFormat().resolvedOptions().timeZone,
    createdAt:      now,
    updatedAt:      now,
    createdBy:      user.uid,
  });

  // 2. Subscription (plan Free par défaut)
  await setDoc(doc(db, "subscriptions", subId), {
    id:                  subId,
    organizationId:      orgId,
    planId:              "free",
    status:              "trialing",
    currentCameraCount:  0,
    currentSiteCount:    0,
    currentUserCount:    1,
    trialEndsAt:         new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt:           now,
    updatedAt:           now,
  });

  // 3. Membership (owner)
  await setDoc(
    doc(db, "organizations", orgId, "members", user.uid),
    {
      userId:         user.uid,
      organizationId: orgId,
      role:           "owner",
      status:         "active",
      joinedAt:       now,
      createdAt:      now,
    }
  );

  // 4. Site par défaut
  await setDoc(
    doc(db, "organizations", orgId, "sites", "default"),
    {
      id:             "default",
      organizationId: orgId,
      name:           "Site principal",
      timezone:       Intl.DateTimeFormat().resolvedOptions().timeZone,
      createdAt:      now,
    }
  );

  // 5. Module Home activé par défaut
  await setDoc(
    doc(db, "organizations", orgId, "modules", "home"),
    {
      slug:           "home",
      organizationId: orgId,
      enabled:        true,
      enabledAt:      now,
      enabledBy:      user.uid,
    }
  );

  // 6. Mettre à jour le profil utilisateur
  await setDoc(doc(db, "users", user.uid), {
    id:                      user.uid,
    email:                   user.email,
    displayName:             user.displayName ?? user.email?.split("@")[0],
    defaultOrganizationId:   orgId,
    createdAt:               now,
    lastLoginAt:             now,
  }, { merge: true });

  return { organizationId: orgId, subscriptionId: subId };
}

/**
 * Crée une caméra directement dans Firestore SANS Cloud Function.
 * (Bypass pour tester sans déployer les fonctions)
 */
export async function createCameraDirectly(input: {
  organizationId: string;
  name:           string;
  brand:          string;
  connector:      string;
  timezone:       string;
}): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("Non authentifié.");

  const now      = new Date().toISOString();
  const cameraId = doc(collection(db, "organizations", input.organizationId, "cameras")).id;

  await setDoc(
    doc(db, "organizations", input.organizationId, "cameras", cameraId),
    {
      id:                    cameraId,
      organizationId:        input.organizationId,
      siteId:                "default",
      name:                  input.name,
      brand:                 input.brand,
      model:                 "WebRTC",
      connector:             input.connector,
      status:                "online",
      streamUrl:             "webrtc://browser",
      streamProtocol:        "webrtc",
      enabledDetectionTypes: ["person", "vehicle", "animal", "fire", "smoke"],
      timezone:              input.timezone,
      location:              "Caméra navigateur",
      createdAt:             now,
      updatedAt:             now,
      createdBy:             user.uid,
    }
  );

  return cameraId;
}
