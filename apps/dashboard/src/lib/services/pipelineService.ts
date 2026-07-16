/**
 * pipelineService — Pipeline complet Vision Guard
 * Storage est OPTIONNEL — camera/detection/event/notification fonctionnent sans snapshots
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
  storageSkipped: boolean;
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

  // 1. Snapshot — OPTIONNEL, 3s max, ne bloque jamais le reste
  let snapshotUrl: string | null = null;
  let storageSkipped = false;
  try {
    const snapPromise = uploadSnapshot(videoElement, organizationId, cameraId, detId);
    const timeout     = new Promise<null>((r) => setTimeout(() => r(null), 3000));
    snapshotUrl = await Promise.race([snapPromise, timeout]);
    if (!snapshotUrl) storageSkipped = true;
  } catch {
    storageSkipped = true;
  }

  // 2. Normaliser bbox
  const vw = videoElement.videoWidth  || 640;
  const vh = videoElement.videoHeight || 480;
  const [bx, by, bw, bh] = detection.bbox;

  // 3. Detection doc
  const detRef = doc(db, "organizations", organizationId, "detections", detId);
  await setDoc(detRef, {
    id:detId, organizationId, siteId:"default", cameraId,
    type:       detection.class,
    category:   detection.category,
    label:      detection.label,
    confidence: Math.round(detection.score * 1000) / 1000,
    severity:   classDef.severity,
    boundingBox:{ x:bx/vw, y:by/vh, width:bw/vw, height:bh/vh },
    snapshotUrl: snapshotUrl,  // null si Storage pas encore activé — OK
    videoClipUrl: null,
    source: "browser_webrtc",
    detectedAt: now, createdAt: now,
  });

  // 4. Event
  let eventId: string;
  const windowStart = new Date(Date.now() - 30_000).toISOString();
  try {
    const evSnap = await getDocs(query(
      collection(db, "organizations", organizationId, "events"),
      where("cameraId",    "==", cameraId),
      where("primaryType", "==", detection.class),
      where("acknowledged","==", false),
      where("createdAt",   ">=", windowStart),
    ));

    if (!evSnap.empty) {
      eventId = evSnap.docs[0].id;
      const existing  = evSnap.docs[0].data();
      const newCount  = (existing.detectionIds?.length ?? 0) + 1;
      await updateDoc(evSnap.docs[0].ref, {
        detectionIds:    arrayUnion(detId),
        severity:        computeSeverity(detection.class, newCount),
        durationSeconds: Math.round((Date.now() - new Date(existing.createdAt).getTime()) / 1000),
        thumbnailUrl:    snapshotUrl ?? existing.thumbnailUrl ?? null,
        updatedAt:       now,
      });
    } else {
      eventId = doc(collection(db, "_tmp")).id;
      await setDoc(doc(db, "organizations", organizationId, "events", eventId), {
        id:eventId, organizationId, siteId:"default", cameraId,
        detectionIds:[detId], primaryType:detection.class,
        category:detection.category, label:detection.label,
        severity:classDef.severity,
        durationSeconds:0, thumbnailUrl:snapshotUrl, videoClipUrl:null,
        acknowledged:false, createdAt:now, updatedAt:now,
      });
    }
  } catch (err: any) {
    console.warn("[pipeline] event error:", err.message);
    eventId = "error";
  }

  // 5. Notification si sévérité >= warning
  let notificationId: string | null = null;
  const user = auth.currentUser;
  if (classDef.severity !== "info" && user) {
    try {
      notificationId = doc(collection(db, "_tmp")).id;
      await setDoc(doc(db, "organizations", organizationId, "notifications", notificationId), {
        id:notificationId, organizationId, userId:user.uid, eventId,
        channel:"push",
        title:  classDef.severity === "critical" ? "🚨 Alerte critique" : "⚠️ Alerte",
        body:   `${detection.label} détecté (${Math.round(detection.score*100)}%)`,
        severity:classDef.severity,
        read:false, sentAt:null, createdAt:now,
      });
    } catch (err: any) {
      console.warn("[pipeline] notif error:", err.message);
    }
  }

  return { detectionId:detId, eventId, notificationId, snapshotUrl, storageSkipped };
}

async function uploadSnapshot(
  video:string|HTMLVideoElement, orgId:string, camId:string, detId:string
): Promise<string|null> {
  if (typeof video === "string") return null;
  const canvas = document.createElement("canvas");
  canvas.width  = Math.min((video as HTMLVideoElement).videoWidth,  1280);
  canvas.height = Math.min((video as HTMLVideoElement).videoHeight, 720);
  canvas.getContext("2d")?.drawImage(video as HTMLVideoElement, 0, 0, canvas.width, canvas.height);
  const blob: Blob = await new Promise((r) =>
    canvas.toBlob((b) => r(b!), "image/jpeg", 0.78)
  );
  const sRef = ref(storage, `organizations/${orgId}/snapshots/${camId}/${detId}.jpg`);
  await uploadBytes(sRef, blob, { contentType:"image/jpeg" });
  return await getDownloadURL(sRef);
}

function computeSeverity(cls:string, count:number): "info"|"warning"|"critical" {
  if (["fire","smoke","weapon","fall_detection","ppe_violation","bear"].includes(cls)) return "critical";
  if (cls === "person" && count >= 5) return "critical";
  if (["person","motorcycle","truck","knife","shoplifting"].includes(cls)) return "warning";
  return "info";
}
