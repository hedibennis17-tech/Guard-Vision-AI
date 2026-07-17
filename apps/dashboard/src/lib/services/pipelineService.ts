/**
 * pipelineService — Pipeline complet Vision Guard
 * Storage est OPTIONNEL — camera/detection/event/notification fonctionnent sans snapshots
 */

import {
  doc, setDoc, collection, query, where, orderBy, limit,
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

  // 4. Event — query simple (1 seul where) pour éviter l'index composite
  let eventId: string;
  const windowStart = new Date(Date.now() - 30_000).toISOString();
  try {
    // Query simple: seulement cameraId pour éviter l'index composite
    const evSnap = await getDocs(query(
      collection(db, "organizations", organizationId, "events"),
      where("cameraId", "==", cameraId),
      orderBy("createdAt", "desc"),
      limit(5),
    ));

    // Filtrer côté client: même type + non acquitté + dans la fenêtre 30s
    const existing = evSnap.docs
      .map(d => ({ ref: d.ref, ...d.data() as any }))
      .find(e =>
        e.primaryType === detection.class &&
        !e.acknowledged &&
        e.createdAt >= windowStart
      );

    if (existing) {
      eventId = existing.ref.id;
      const newCount = (existing.detectionIds?.length ?? 0) + 1;
      await updateDoc(existing.ref, {
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
    console.error("[pipeline] event error:", err.message);
    // Créer l'event quand même en fallback
    try {
      eventId = doc(collection(db, "_tmp")).id;
      await setDoc(doc(db, "organizations", organizationId, "events", eventId), {
        id:eventId, organizationId, siteId:"default", cameraId,
        detectionIds:[detId], primaryType:detection.class,
        category:detection.category, label:detection.label,
        severity:classDef.severity,
        durationSeconds:0, thumbnailUrl:snapshotUrl, videoClipUrl:null,
        acknowledged:false, createdAt:now, updatedAt:now,
      });
    } catch {
      eventId = "error";
    }
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

/**
 * Marque le statut du clip sur un event (recording | ready | failed).
 * Appelé depuis la page caméra avant/après startClip.
 */
export async function markClipStatus(
  organizationId: string,
  eventId:        string,
  status:         "recording" | "ready" | "failed",
): Promise<void> {
  try {
    await updateDoc(
      doc(db, "organizations", organizationId, "events", eventId),
      { clipStatus: status, updatedAt: new Date().toISOString() },
    );
  } catch (err) {
    console.warn("[markClipStatus] failed:", err);
  }
}

/**
 * Met à jour un EventDoc avec l'URL du clip vidéo.
 * Appelé par useMediaRecorder après upload dans Storage.
 */
export async function updateEventWithClip(
  organizationId: string,
  eventId:        string,
  videoClipUrl:   string,
): Promise<void> {
  const { doc, updateDoc } = await import("firebase/firestore");
  const { db } = await import("@/lib/firebase/client");
  await updateDoc(
    doc(db, "organizations", organizationId, "events", eventId),
    { videoClipUrl, updatedAt: new Date().toISOString() }
  );
}

/**
 * Déclenche l'enregistrement d'un clip vidéo pour un event existant.
 * Appelé depuis la page caméra après qu'une détection a créé l'event.
 */
export async function startEventClip(options: {
  organizationId: string;
  cameraId:       string;
  eventId:        string;
  videoElement:   HTMLVideoElement;
  durationSec?:   number;
}): Promise<string | null> {
  const { organizationId, cameraId, eventId, videoElement, durationSec = 15 } = options;
  const stream = videoElement.srcObject as MediaStream | null;
  if (!stream) return null;

  const mimeType = ["video/webm;codecs=vp9,opus","video/webm","video/mp4"]
    .find((m) => MediaRecorder.isTypeSupported(m)) ?? "video/webm";
  const chunks: Blob[] = [];

  return new Promise((resolve) => {
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1_200_000 });
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: mimeType });
      const ext  = mimeType.includes("mp4") ? "mp4" : "webm";
      const path = `organizations/${organizationId}/clips/${cameraId}/${eventId}.${ext}`;
      try {
        const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
        const { storage } = await import("@/lib/firebase/client");
        const sRef = ref(storage, path);
        await uploadBytes(sRef, blob, { contentType: mimeType });
        const url = await getDownloadURL(sRef);
        const { doc, updateDoc } = await import("firebase/firestore");
        await updateDoc(doc(db, "organizations", organizationId, "events", eventId),
          { videoClipUrl: url, updatedAt: new Date().toISOString() });
        resolve(url);
      } catch { resolve(null); }
    };
    recorder.start(500);
    setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, durationSec * 1000);
  });
}
