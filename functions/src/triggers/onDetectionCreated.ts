import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

const AGGREGATION_WINDOW_SEC = 30;

const DETECTION_SEVERITY: Record<string, "info" | "warning" | "critical"> = {
  fire:          "critical",
  smoke:         "critical",
  ppe_violation: "critical",
  person:        "warning",
  motorcycle:    "warning",
  license_plate: "info",
  car:           "info",
  bus:           "info",
  truck:         "info",
  dog:           "info",
  cat:           "info",
  bird:          "info",
};

const ESCALATION_THRESHOLDS: Record<string, number> = {
  person: 5,
  car:    3,
};

function computeSeverity(type: string, count: number): "info" | "warning" | "critical" {
  const base = DETECTION_SEVERITY[type] ?? "info";
  if (base === "critical") return "critical";
  if (ESCALATION_THRESHOLDS[type] && count >= ESCALATION_THRESHOLDS[type]) return "critical";
  return base;
}

/**
 * Event Aggregator — Phase 6.
 *
 * Déclenché à chaque nouvelle détection YOLO.
 * Cherche un Event ouvert (même caméra + même type, dans les 30 dernières secondes).
 *   → Si trouvé  : ajoute la détection à l'Event existant + recalcule la sévérité.
 *   → Si absent  : crée un nouvel Event.
 *
 * Ce mécanisme évite de créer un Event par frame et regroupe les détections
 * en épisodes cohérents (ex: "intrusion — 8 détections person — 24s").
 */
export const onDetectionCreated = onDocumentCreated(
  "organizations/{orgId}/detections/{detectionId}",
  async (event) => {
    const detection = event.data?.data();
    if (!detection) return;

    const { orgId } = event.params;
    const db        = admin.firestore();
    const now       = new Date();
    const windowStart = new Date(now.getTime() - AGGREGATION_WINDOW_SEC * 1000).toISOString();

    // Chercher un Event ouvert sur la même caméra + même type dans la fenêtre
    const existingSnap = await db
      .collection("organizations").doc(orgId)
      .collection("events")
      .where("cameraId",    "==", detection.cameraId)
      .where("primaryType", "==", detection.type)
      .where("acknowledged","==", false)
      .where("createdAt",   ">=", windowStart)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      // ── Ajouter au Event existant ──────────────────────────────────────
      const eventRef  = existingSnap.docs[0].ref;
      const eventData = existingSnap.docs[0].data();
      const newCount  = (eventData.detectionIds?.length ?? 0) + 1;
      const newSeverity = computeSeverity(detection.type, newCount);

      await eventRef.update({
        detectionIds:    admin.firestore.FieldValue.arrayUnion(event.params.detectionId),
        severity:        newSeverity,
        durationSeconds: Math.round(
          (now.getTime() - new Date(eventData.createdAt).getTime()) / 1000
        ),
        thumbnailUrl:    detection.snapshotUrl ?? eventData.thumbnailUrl,
        updatedAt:       now.toISOString(),
      });

    } else {
      // ── Créer un nouvel Event ──────────────────────────────────────────
      const eventRef = db
        .collection("organizations").doc(orgId)
        .collection("events")
        .doc();

      const severity = computeSeverity(detection.type, 1);

      await eventRef.set({
        id:             eventRef.id,
        organizationId: orgId,
        siteId:         detection.siteId ?? "",
        cameraId:       detection.cameraId,
        detectionIds:   [event.params.detectionId],
        primaryType:    detection.type,
        severity,
        durationSeconds: 0,
        thumbnailUrl:   detection.snapshotUrl ?? null,
        videoClipUrl:   null,
        acknowledged:   false,
        acknowledgedBy: null,
        acknowledgedAt: null,
        createdAt:      now.toISOString(),
        updatedAt:      now.toISOString(),
      });

      // ── Déclencher une notification si sévérité >= warning ─────────────
      if (severity !== "info") {
        await triggerNotification(db, orgId, eventRef.id, detection.type, severity, detection.cameraId);
      }
    }
  }
);

/** Crée un NotificationDoc pour les membres de l'organisation (Preview Phase 7). */
async function triggerNotification(
  db: admin.firestore.Firestore,
  orgId: string,
  eventId: string,
  type: string,
  severity: string,
  cameraId: string
): Promise<void> {
  const membersSnap = await db
    .collection("organizations").doc(orgId)
    .collection("members")
    .where("status", "==", "active")
    .get();

  const batch = db.batch();
  const now   = new Date().toISOString();
  const titles: Record<string, string> = {
    critical: "🚨 Alerte critique",
    warning:  "⚠️ Alerte",
  };
  const bodies: Record<string, string> = {
    fire:          "Feu ou fumée détecté — vérifiez immédiatement.",
    smoke:         "Fumée détectée — vérifiez immédiatement.",
    ppe_violation: "Violation EPI détectée.",
    person:        "Personne détectée.",
  };

  for (const member of membersSnap.docs) {
    const notifRef = db
      .collection("organizations").doc(orgId)
      .collection("notifications")
      .doc();

    batch.set(notifRef, {
      id:             notifRef.id,
      organizationId: orgId,
      userId:         member.id,
      eventId,
      channel:        "push",
      title:          titles[severity] ?? "Alerte",
      body:           bodies[type] ?? `Détection : ${type}`,
      read:           false,
      sentAt:         null,
      createdAt:      now,
    });
  }
  await batch.commit();
}
