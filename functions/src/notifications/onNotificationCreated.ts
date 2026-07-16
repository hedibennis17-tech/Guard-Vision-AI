import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { sendEmail } from "../email/emailSender";

const SEVERITY_PRIORITY: Record<string, number> = {
  info: 1, warning: 2, critical: 3,
};

/**
 * onNotificationCreated — Phase 7
 *
 * Déclenché quand un NotificationDoc est créé (par onDetectionCreated, Phase 6).
 * Responsabilités :
 *   1. Récupérer les préférences de notification de l'utilisateur
 *   2. Vérifier : Do Not Disturb, sévérité minimale, types watchés
 *   3. Envoyer FCM push (si push activé + token disponible)
 *   4. Envoyer email (si email activé + adresse disponible)
 *   5. Mettre à jour sentAt dans le NotificationDoc
 */
export const onNotificationCreated = onDocumentCreated(
  "organizations/{orgId}/notifications/{notifId}",
  async (event) => {
    const notif = event.data?.data();
    if (!notif || notif.sentAt) return; // déjà envoyé

    const { orgId, notifId } = event.params;
    const db  = admin.firestore();
    const now = new Date().toISOString();

    // Récupérer les préférences de l'utilisateur
    const prefsSnap = await db
      .collection("organizations").doc(orgId)
      .collection("notification_preferences").doc(notif.userId)
      .get();

    const prefs = prefsSnap.exists ? prefsSnap.data()! : {
      channels:    { push: true, email: true, sms: false },
      minSeverity: "warning",
      watchedTypes: [],
      doNotDisturb: { enabled: false, startHour: 22, endHour: 7 },
      fcmTokens:   [],
    };

    // Récupérer le EventDoc associé pour la sévérité
    let eventSeverity = "warning";
    if (notif.eventId) {
      const eventSnap = await db
        .collection("organizations").doc(orgId)
        .collection("events").doc(notif.eventId)
        .get();
      if (eventSnap.exists) eventSeverity = eventSnap.data()?.severity ?? "warning";
    }

    // Vérifier la sévérité minimale
    if (
      SEVERITY_PRIORITY[eventSeverity] <
      SEVERITY_PRIORITY[prefs.minSeverity ?? "warning"]
    ) {
      return; // sous le seuil — ne pas envoyer
    }

    // Vérifier Do Not Disturb
    if (prefs.doNotDisturb?.enabled) {
      const hour = new Date().getHours();
      const { startHour, endHour } = prefs.doNotDisturb;
      const inDnd =
        startHour > endHour
          ? hour >= startHour || hour < endHour   // ex: 22h–7h (minuit inclus)
          : hour >= startHour && hour < endHour;
      if (inDnd) return;
    }

    const sentChannels: string[] = [];

    // ── Push FCM ─────────────────────────────────────────────────────────
    if (prefs.channels?.push && prefs.fcmTokens?.length > 0) {
      await sendFcmPush(prefs.fcmTokens, notif.title, notif.body, {
        orgId,
        eventId: notif.eventId ?? "",
        notifId,
      });
      sentChannels.push("push");
    }

    // ── Email ────────────────────────────────────────────────────────────
    if (prefs.channels?.email) {
      const userSnap = await db.collection("users").doc(notif.userId).get();
      const emailAddress =
        prefs.emailAddress ?? userSnap.data()?.email ?? null;

      if (emailAddress) {
        await sendEmail({
          to:      emailAddress,
          subject: notif.title,
          orgId,
          eventId: notif.eventId,
          title:   notif.title,
          body:    notif.body,
          severity: eventSeverity,
        });
        sentChannels.push("email");
      }
    }

    // Marquer comme envoyé
    await db
      .collection("organizations").doc(orgId)
      .collection("notifications").doc(notifId)
      .update({ sentAt: now, sentChannels });
  }
);

/** Envoie une notification FCM à plusieurs tokens. */
async function sendFcmPush(
  tokens:  string[],
  title:   string,
  body:    string,
  data:    Record<string, string>
): Promise<void> {
  if (!tokens.length) return;

  const messaging = admin.messaging();
  const message: admin.messaging.MulticastMessage = {
    tokens,
    notification: { title, body },
    data,
    android: {
      priority: "high",
      notification: { channelId: "visionguard_alerts", sound: "default" },
    },
    apns: {
      payload: { aps: { sound: "default", badge: 1 } },
    },
  };

  const response = await messaging.sendEachForMulticast(message);

  // Supprimer les tokens expirés
  const expiredTokens: string[] = [];
  response.responses.forEach((r, i) => {
    if (!r.success && r.error?.code === "messaging/registration-token-not-registered") {
      expiredTokens.push(tokens[i]);
    }
  });

  if (expiredTokens.length > 0) {
    console.log(JSON.stringify({
      module: "onNotificationCreated",
      action: "remove_expired_tokens",
      count: expiredTokens.length,
    }));
    // En production : purger les tokens expirés des préférences utilisateur
  }
}
