import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

/** Enregistre le token FCM d'un appareil pour un utilisateur. */
export const registerFcmToken = onCall<{
  organizationId: string;
  token: string;
}>(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentification requise.");

  const { organizationId, token } = request.data;
  if (!token) throw new HttpsError("invalid-argument", "Token FCM requis.");

  const db  = admin.firestore();
  const now = new Date().toISOString();

  const prefRef = db
    .collection("organizations").doc(organizationId)
    .collection("notification_preferences").doc(request.auth.uid);

  const snap = await prefRef.get();
  if (snap.exists) {
    await prefRef.update({
      fcmTokens: admin.firestore.FieldValue.arrayUnion(token),
      updatedAt: now,
    });
  } else {
    await prefRef.set({
      userId:         request.auth.uid,
      organizationId,
      channels:       { push: true, email: true, sms: false },
      minSeverity:    "warning",
      watchedTypes:   [],
      doNotDisturb:   { enabled: false, startHour: 22, endHour: 7 },
      fcmTokens:      [token],
      updatedAt:      now,
    });
  }

  return { success: true };
});

/** Met à jour les préférences de notification d'un utilisateur. */
export const updateNotificationPrefs = onCall<{
  organizationId: string;
  prefs: {
    channels?:       { push?: boolean; email?: boolean; sms?: boolean };
    minSeverity?:    string;
    watchedTypes?:   string[];
    doNotDisturb?:   { enabled: boolean; startHour: number; endHour: number };
    emailAddress?:   string;
  };
}>(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentification requise.");

  const { organizationId, prefs } = request.data;
  const db  = admin.firestore();
  const now = new Date().toISOString();

  await db
    .collection("organizations").doc(organizationId)
    .collection("notification_preferences").doc(request.auth.uid)
    .set({ ...prefs, userId: request.auth.uid, organizationId, updatedAt: now }, { merge: true });

  return { success: true };
});

/** Marque une notification comme lue. */
export const markNotificationRead = onCall<{
  organizationId: string;
  notificationId: string;
}>(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentification requise.");

  const { organizationId, notificationId } = request.data;
  const db = admin.firestore();

  const notifRef = db
    .collection("organizations").doc(organizationId)
    .collection("notifications").doc(notificationId);

  const snap = await notifRef.get();
  if (!snap.exists || snap.data()?.userId !== request.auth.uid) {
    throw new HttpsError("permission-denied", "Notification introuvable ou accès refusé.");
  }

  await notifRef.update({ read: true });
  return { success: true };
});
