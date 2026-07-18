/**
 * pipelineService — Pipeline Vision Guard AI
 * Detection → Snapshot → Event → Notification
 * Robuste : chaque étape est optionnelle, rien ne bloque le suivant
 */

import {
  doc, setDoc, collection, query, where, orderBy, limit,
  getDocs, updateDoc, arrayUnion,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage, db } from "@/lib/firebase/client";

export interface PipelineDetection {
  class:      string;
  label:      string;
  category:   string;
  severity:   string;
  score:      number;
  bbox?:      [number,number,number,number];
  color?:     string;
}

export interface PipelineResult {
  detectionId:  string;
  eventId:      string | null;
  snapshotUrl:  string | null;
  notifId:      string | null;
}

function computeSeverity(cls: string, count: number): string {
  const fireCls = ["fire","smoke","gas_leak","flood","arc_electrique"];
  if (fireCls.includes(cls)) return "critical";
  if (count > 3) return "warning";
  return "info";
}

function captureSnapshot(videoEl: HTMLVideoElement): string | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width  = videoEl.videoWidth  || 640;
    canvas.height = videoEl.videoHeight || 480;
    canvas.getContext("2d")?.drawImage(videoEl,0,0);
    return canvas.toDataURL("image/jpeg",0.7);
  } catch { return null; }
}

async function uploadSnapshot(
  dataUrl: string,
  organizationId: string,
  detId: string,
): Promise<string | null> {
  try {
    const res  = await fetch(dataUrl);
    const blob = await res.blob();
    const path = `organizations/${organizationId}/snapshots/${detId}.jpg`;
    const sRef = ref(storage, path);
    await uploadBytes(sRef, blob, { contentType:"image/jpeg" });
    return await getDownloadURL(sRef);
  } catch { return null; }
}

export async function runDetectionPipeline(options: {
  organizationId: string;
  cameraId:       string;
  detection:      PipelineDetection;
  videoElement?:  HTMLVideoElement | null;
}): Promise<PipelineResult> {
  const { organizationId, cameraId, detection, videoElement } = options;
  const now   = new Date().toISOString();
  const detId = doc(collection(db,"_")).id;

  const result: PipelineResult = {
    detectionId: detId,
    eventId:     null,
    snapshotUrl: null,
    notifId:     null,
  };

  // ── 1. Snapshot (optionnel, timeout 3s) ──────────────────────────────────
  let snapshotUrl: string | null = null;
  if (videoElement) {
    const dataUrl = captureSnapshot(videoElement);
    if (dataUrl) {
      const snapshotPromise = uploadSnapshot(dataUrl, organizationId, detId);
      const timeout = new Promise<null>(r => setTimeout(()=>r(null), 3000));
      snapshotUrl = await Promise.race([snapshotPromise, timeout]);
      result.snapshotUrl = snapshotUrl;
    }
  }

  // ── 2. Detection doc ─────────────────────────────────────────────────────
  try {
    await setDoc(doc(db,"organizations",organizationId,"detections",detId),{
      id:detId, organizationId, cameraId,
      type:      detection.class,
      label:     detection.label,
      category:  detection.category,
      severity:  detection.severity,
      confidence:detection.score,
      bbox:      detection.bbox ?? null,
      snapshotUrl,
      detectedAt:now,
    });
  } catch(err:any) {
    console.error("[pipeline] detection write:", err.message);
    return result; // Arrêter si Firestore bloqué
  }

  // ── 3. Event — query SIMPLE (1 seul where = pas d'index requis) ──────────
  let eventId: string | null = null;
  const windowStart = new Date(Date.now()-30000).toISOString();

  try {
    // Query simple par cameraId uniquement → pas d'index composite
    const evSnap = await getDocs(query(
      collection(db,"organizations",organizationId,"events"),
      where("cameraId","==",cameraId),
      orderBy("createdAt","desc"),
      limit(5),
    ));

    // Filtrer côté client: même type + non acquitté + dans les 30s
    const existing = evSnap.docs
      .map(d=>({ ref:d.ref, ...d.data() as any }))
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
        durationSeconds: Math.round((Date.now()-new Date(existing.createdAt).getTime())/1000),
        thumbnailUrl:    snapshotUrl ?? existing.thumbnailUrl ?? null,
        updatedAt:       now,
      });
    } else {
      eventId = doc(collection(db,"_")).id;
      await setDoc(doc(db,"organizations",organizationId,"events",eventId),{
        id:eventId, organizationId, siteId:"default", cameraId,
        detectionIds:    [detId],
        primaryType:     detection.class,
        category:        detection.category,
        label:           detection.label,
        severity:        detection.severity,
        durationSeconds: 0,
        thumbnailUrl:    snapshotUrl,
        videoClipUrl:    null,
        clipStatus:      "pending",
        acknowledged:    false,
        createdAt:       now,
        updatedAt:       now,
      });
    }
    result.eventId = eventId;
  } catch(err:any) {
    console.error("[pipeline] event:", err.message);
    // Fallback : créer l'event sans vérif doublon
    try {
      eventId = doc(collection(db,"_")).id;
      await setDoc(doc(db,"organizations",organizationId,"events",eventId),{
        id:eventId, organizationId, siteId:"default", cameraId,
        detectionIds:[detId], primaryType:detection.class,
        category:detection.category, label:detection.label,
        severity:detection.severity, durationSeconds:0,
        thumbnailUrl:snapshotUrl, videoClipUrl:null,
        clipStatus:"pending", acknowledged:false,
        createdAt:now, updatedAt:now,
      });
      result.eventId = eventId;
    } catch(e2:any) {
      console.error("[pipeline] event fallback:", e2.message);
    }
  }

  // ── 4. Notification (seulement pour warning + critical) ─────────────────
  if (eventId && (detection.severity==="warning"||detection.severity==="critical")) {
    try {
      const notifId = doc(collection(db,"_")).id;
      await setDoc(doc(db,"organizations",organizationId,"notifications",notifId),{
        id:notifId, organizationId, eventId,
        type:     "detection",
        title:    detection.label,
        body:     `${detection.severity==="critical"?"🚨":"⚠️"} ${detection.label} détecté`,
        severity: detection.severity,
        read:     false,
        createdAt:now,
      });
      result.notifId = notifId;
    } catch(err:any) {
      console.error("[pipeline] notif:", err.message);
    }
  }

  return result;
}
