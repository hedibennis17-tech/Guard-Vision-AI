/**
 * pipelineService — Pipeline complet Vision Guard SANS Cloud Functions.
 * Écrit directement dans Firestore :
 *   DetectionDoc → EventDoc → NotificationDoc
 *
 * Quand les Cloud Functions seront déployées, elles prendront le relai
 * (onDetectionCreated crée l'event, onNotificationCreated envoie le push).
 * Ce service sert de fallback pour le développement/test.
 */

import {
  doc, setDoc, collection, getDoc, query, where,
  getDocs, updateDoc, arrayUnion, increment,
} from "firebase/firestore";
import {
  ref, uploadBytes, getDownloadURL,
} from "firebase/storage";
import { db, storage, auth } from "@/lib/firebase/client";
import { getClassDef } from "@/lib/detection/classMap";
import type { Detection } from "@/lib/hooks/useYoloDetection";

// Debounce par classe pour éviter le flood
const lastSavedPerClass: Record<string, number> = {};
const DEBOUNCE_MS = 6000; // 6 secondes entre 2 saves de la même classe

export interface PipelineResult {
  detectionId:   string | null;
  eventId:       string | null;
  notificationId: string | null;
  snapshotUrl:   string | null;
}

/**
 * Pipeline complet : une détection → snapshot → Firestore (detection + event + notification)
 */
export async function runDetectionPipeline(input: {
  organizationId: string;
  cameraId:       string;
  detection:      Detection;
  videoElement:   HTMLVideoElement;
}): Promise<PipelineResult | null> {
  const { organizationId, cameraId, detection, videoElement } = input;
  const user = auth.currentUser;

  // Debounce
  const debounceKey = `${cameraId}:${detection.class}`;
  if (Date.now() - (lastSavedPerClass[debounceKey] ?? 0) < DEBOUNCE_MS) return null;
  lastSavedPerClass[debounceKey] = Date.now();

  const classDef = getClassDef(detection.class);
  const now      = new Date().toISOString();
  const detId    = doc(collection(db, "tmp")).id; // génère un ID unique

  // 1. Capturer + uploader le snapshot
  const snapshotUrl = await uploadSnapshot(videoElement, organizationId, cameraId, detId);

  // 2. Normaliser la bounding box
  const vw = videoElement.videoWidth  || 640;
  const vh = videoElement.videoHeight || 480;
  const [bx, by, bw, bh] = detection.bbox;

  // 3. Écrire le DetectionDoc
  await setDoc(doc(db, "organizations", organizationId, "detections", detId), {
    id:             detId,
    organizationId,
    siteId:         "default",
    cameraId,
    type:           detection.class,
    category:       detection.category,
    label:          detection.label,
    confidence:     Math.round(detection.score * 1000) / 1000,
    severity:       classDef.severity,
    boundingBox: {
      x:      bx / vw,
      y:      by / vh,
      width:  bw / vw,
      height: bh / vh,
    },
    snapshotUrl,
    videoClipUrl:  null,
    source:        "browser_webrtc",
    detectedAt:    now,
    createdAt:     now,
  });

  // 4. Chercher un Event ouvert récent (même caméra + même type, dernières 30s)
  const windowStart = new Date(Date.now() - 30_000).toISOString();
  const eventsSnap  = await getDocs(
    query(
      collection(db, "organizations", organizationId, "events"),
      where("cameraId",     "==", cameraId),
      where("primaryType",  "==", detection.class),
      where("acknowledged", "==", false),
      where("createdAt",    ">=", windowStart),
    )
  );

  let eventId: string;

  if (!eventsSnap.empty) {
    // Mettre à jour l'event existant
    const existingEvent = eventsSnap.docs[0];
    eventId = existingEvent.id;
    const newCount = (existingEvent.data().detectionIds?.length ?? 0) + 1;
    const severity = computeSeverity(detection.class, newCount);
    await updateDoc(existingEvent.ref, {
      detectionIds:    arrayUnion(detId),
      severity,
      durationSeconds: Math.round((Date.now() - new Date(existingEvent.data().createdAt).getTime()) / 1000),
      thumbnailUrl:    snapshotUrl ?? existingEvent.data().thumbnailUrl,
      updatedAt:       now,
    });
  } else {
    // Créer un nouvel Event
    eventId = doc(collection(db, "tmp")).id;
    await setDoc(doc(db, "organizations", organizationId, "events", eventId), {
      id:             eventId,
      organizationId,
      siteId:         "default",
      cameraId,
      detectionIds:   [detId],
      primaryType:    detection.class,
      category:       detection.category,
      label:          detection.label,
      severity:       classDef.severity,
      durationSeconds: 0,
      thumbnailUrl:   snapshotUrl,
      videoClipUrl:   null,
      acknowledged:   false,
      acknowledgedBy: null,
      acknowledgedAt: null,
      createdAt:      now,
      updatedAt:      now,
    });
  }

  // 5. Créer une Notification si sévérité >= warning
  let notificationId: string | null = null;
  if (classDef.severity !== "info" && user) {
    notificationId = doc(collection(db, "tmp")).id;
    const titles: Record<string, string> = {
      critical: "🚨 Alerte critique",
      warning:  "⚠️ Alerte",
    };
    const bodies: Record<string, string> = {
      fire:    "Feu ou fumée détecté — vérifiez immédiatement !",
      smoke:   "Fumée détectée — vérifiez immédiatement !",
      person:  `Personne détectée (${Math.round(detection.score * 100)}% confiance)`,
      default: `${detection.label} détecté (${Math.round(detection.score * 100)}%)`,
    };

    await setDoc(doc(db, "organizations", organizationId, "notifications", notificationId), {
      id:             notificationId,
      organizationId,
      userId:         user.uid,
      eventId,
      channel:        "push",
      title:          titles[classDef.severity] ?? "⚠️ Alerte",
      body:           bodies[detection.class] ?? bodies.default,
      severity:       classDef.severity,
      read:           false,
      sentAt:         null,
      createdAt:      now,
    });
  }

  return { detectionId: detId, eventId, notificationId, snapshotUrl };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function uploadSnapshot(
  video:          HTMLVideoElement,
  organizationId: string,
  cameraId:       string,
  detectionId:    string,
): Promise<string | null> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width  = Math.min(video.videoWidth,  1280);
    canvas.height = Math.min(video.videoHeight, 720);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.80));
    const path    = `organizations/${organizationId}/snapshots/${cameraId}/${detectionId}.jpg`;
    const sRef    = ref(storage, path);
    await uploadBytes(sRef, blob, { contentType: "image/jpeg" });
    return await getDownloadURL(sRef);
  } catch (err) {
    console.warn("[pipeline] Snapshot upload failed:", err);
    return null;
  }
}

function computeSeverity(cls: string, count: number): "info" | "warning" | "critical" {
  if (["fire","smoke","weapon","fall_detection","ppe_violation","bear"].includes(cls)) return "critical";
  if (cls === "person" && count >= 5) return "critical";
  if (["person","motorcycle","truck","knife","shoplifting"].includes(cls)) return "warning";
  return "info";
}
