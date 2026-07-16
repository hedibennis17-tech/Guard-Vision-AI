/**
 * pipelineService — Pipeline complet Vision Guard SANS Cloud Functions.
 * Détection → snapshot → Firestore (detection + event + notification)
 */

import {
  doc, setDoc, collection, query, where,
  getDocs, updateDoc, arrayUnion,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, auth } from "@/lib/firebase/client";
import { getClassDef } from "@/lib/detection/classMap";
import type { Detection } from "@/lib/hooks/useYoloDetection";

const lastSaved: Record<string, number> = {};
const DEBOUNCE_MS = 6000;

export interface PipelineResult {
  detectionId:    string | null;
  eventId:        string | null;
  notificationId: string | null;
  snapshotUrl:    string | null;
  error?:         string;
}

export async function runDetectionPipeline(input: {
  organizationId: string;
  cameraId:       string;
  detection:      Detection;
  videoElement:   HTMLVideoElement;
}): Promise<PipelineResult | null> {
  const { organizationId, cameraId, detection, videoElement } = input;

  // Debounce
  const key = `${cameraId}:${detection.class}`;
  if (Date.now() - (lastSaved[key] ?? 0) < DEBOUNCE_MS) return null;
  lastSaved[key] = Date.now();

  const classDef = getClassDef(detection.class);
  const now      = new Date().toISOString();
  const detId    = doc(collection(db, "_tmp")).id;

  // 1. Snapshot (si Storage accessible)
  let snapshotUrl: string | null = null;
  try {
    snapshotUrl = await uploadSnapshot(videoElement, organizationId, cameraId, detId);
  } catch (storageErr: any) {
    console.warn("[pipeline] Storage indisponible (snapshot ignoré):", storageErr.message);
    // On continue sans snapshot — ça ne bloque pas le reste
  }

  // 2. Detection doc
  try {
    const vw = videoElement.videoWidth  || 640;
    const vh = videoElement.videoHeight || 480;
    const [bx, by, bw, bh] = detection.bbox;
    await setDoc(doc(db, "organizations", organizationId, "detections", detId), {
      id: detId, organizationId, siteId: "default", cameraId,
      type:       detection.class,
      category:   detection.category,
      label:      detection.label,
      confidence: Math.round(detection.score * 1000) / 1000,
      severity:   classDef.severity,
      boundingBox: { x:bx/vw, y:by/vh, width:bw/vw, height:bh/vh },
      snapshotUrl, videoClipUrl: null,
      source: "browser_webrtc",
      detectedAt: now, createdAt: now,
    });
  } catch (err: any) {
    const msg = `Erreur Firestore détection: ${err.message}`;
    console.error("[pipeline]", msg);
    return { detectionId:null, eventId:null, notificationId:null, snapshotUrl:null, error:msg };
  }

  // 3. Event (cherche un event ouvert récent)
  let eventId: string;
  try {
    const windowStart = new Date(Date.now() - 30_000).toISOString();
    const evSnap = await getDocs(query(
      collection(db, "organizations", organizationId, "events"),
      where("cameraId",    "==", cameraId),
      where("primaryType", "==", detection.class),
      where("acknowledged","==", false),
      where("createdAt",   ">=", windowStart),
    ));

    if (!evSnap.empty) {
      eventId = evSnap.docs[0].id;
      const existing = evSnap.docs[0].data();
      const newCount = (existing.detectionIds?.length ?? 0) + 1;
      await updateDoc(evSnap.docs[0].ref, {
        detectionIds:    arrayUnion(detId),
        severity:        computeSeverity(detection.class, newCount),
        durationSeconds: Math.round((Date.now() - new Date(existing.createdAt).getTime()) / 1000),
        thumbnailUrl:    snapshotUrl ?? existing.thumbnailUrl,
        updatedAt:       now,
      });
    } else {
      eventId = doc(collection(db, "_tmp")).id;
      await setDoc(doc(db, "organizations", organizationId, "events", eventId), {
        id:eventId, organizationId, siteId:"default", cameraId,
        detectionIds: [detId], primaryType: detection.class,
        category: detection.category, label: detection.label,
        severity: classDef.severity,
        durationSeconds: 0, thumbnailUrl: snapshotUrl, videoClipUrl: null,
        acknowledged: false, acknowledgedBy: null, acknowledgedAt: null,
        createdAt: now, updatedAt: now,
      });
    }
  } catch (err: any) {
    console.error("[pipeline] Erreur event:", err.message);
    eventId = "error";
  }

  // 4. Notification si sévérité >= warning
  let notificationId: string | null = null;
  const user = auth.currentUser;
  if (classDef.severity !== "info" && user) {
    try {
      notificationId = doc(collection(db, "_tmp")).id;
      await setDoc(doc(db, "organizations", organizationId, "notifications", notificationId), {
        id:notificationId, organizationId, userId:user.uid, eventId,
        channel: "push",
        title:   classDef.severity === "critical" ? "🚨 Alerte critique" : "⚠️ Alerte",
        body:    buildNotifBody(detection),
        severity: classDef.severity,
        read: false, sentAt: null, createdAt: now,
      });
    } catch (err: any) { console.warn("[pipeline] Notification error:", err.message); }
  }

  return { detectionId:detId, eventId, notificationId, snapshotUrl };
}

async function uploadSnapshot(video:HTMLVideoElement, orgId:string, camId:string, detId:string): Promise<string|null> {
  const canvas = document.createElement("canvas");
  canvas.width  = Math.min(video.videoWidth,  1280);
  canvas.height = Math.min(video.videoHeight, 720);
  canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.78));
  const sRef = ref(storage, `organizations/${orgId}/snapshots/${camId}/${detId}.jpg`);
  await uploadBytes(sRef, blob, { contentType:"image/jpeg" });
  return await getDownloadURL(sRef);
}

function computeSeverity(cls:string, count:number): "info"|"warning"|"critical" {
  if (["fire","smoke","weapon","fall_detection","ppe_violation","bear"].includes(cls)) return "critical";
  if (cls === "person" && count >= 5) return "critical";
  if (["person","motorcycle","truck","knife","shoplifting","elephant"].includes(cls)) return "warning";
  return "info";
}

function buildNotifBody(d:Detection): string {
  const bodies: Record<string,string> = {
    fire:   "🔥 Feu détecté — vérifiez immédiatement !",
    smoke:  "💨 Fumée détectée — vérifiez immédiatement !",
    person: `🧍 Personne détectée (${Math.round(d.score*100)}%)`,
    default: `${d.label} détecté (${Math.round(d.score*100)}%)`,
  };
  return bodies[d.class] ?? bodies.default;
}
