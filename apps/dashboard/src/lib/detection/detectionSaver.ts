/**
 * detectionSaver — Pipeline complet Vision Guard (Phase 5+6+7)
 *
 * Quand une détection arrive depuis le navigateur (TF.js ou YOLOv11) :
 *   1. Capture un snapshot JPEG depuis la vidéo
 *   2. Upload dans Firebase Storage
 *   3. Écrit un DetectionDoc dans Firestore
 *   → La Cloud Function onDetectionCreated prend le relai automatiquement
 *   → Elle crée l'EventDoc
 *   → onNotificationCreated envoie push + email
 */

import {
  collection, addDoc, serverTimestamp, type Firestore,
} from "firebase/firestore";
import {
  ref, uploadBytes, getDownloadURL, type FirebaseStorage,
} from "firebase/storage";
import { db, storage } from "@/lib/firebase/client";
import { getClassDef } from "@/lib/detection/classMap";

export interface BrowserDetection {
  class:  string;
  score:  number;
  bbox:   [number, number, number, number];
  color:  string;
}

export interface SaveDetectionInput {
  organizationId: string;
  siteId?:        string;
  cameraId:       string;
  detection:      BrowserDetection;
  videoElement:   HTMLVideoElement;
}

/** Durée minimum entre deux sauvegardes pour la même classe (évite le flood) */
const DEBOUNCE_MS: Record<string, number> = {};
const DEBOUNCE_INTERVAL = 5000; // 5 secondes par classe

/**
 * Sauvegarde une détection dans Firebase.
 * Appelé depuis le hook useYoloDetection quand une détection a une confidence > seuil.
 */
export async function saveDetection(input: SaveDetectionInput): Promise<string | null> {
  const { organizationId, siteId = "", cameraId, detection, videoElement } = input;

  // Debounce par classe — évite 50 docs "person" par seconde
  const debounceKey = `${cameraId}:${detection.class}`;
  const lastSaved   = DEBOUNCE_MS[debounceKey] ?? 0;
  if (Date.now() - lastSaved < DEBOUNCE_INTERVAL) return null;
  DEBOUNCE_MS[debounceKey] = Date.now();

  const classDef = getClassDef(detection.class);
  const now      = new Date().toISOString();

  try {
    // 1. Capturer snapshot
    const snapshotUrl = await captureAndUpload(videoElement, organizationId, cameraId);

    // 2. Normaliser la bounding box (pixels → 0-1)
    const vw = videoElement.videoWidth  || 640;
    const vh = videoElement.videoHeight || 480;
    const [bx, by, bw, bh] = detection.bbox;

    // 3. Écrire le DetectionDoc dans Firestore
    const detectionRef = await addDoc(
      collection(db, "organizations", organizationId, "detections"),
      {
        organizationId,
        siteId,
        cameraId,
        type:       detection.class,
        category:   classDef.category,
        label:      classDef.label,
        confidence: Math.round(detection.score * 1000) / 1000,
        severity:   classDef.severity,
        boundingBox: {
          x:      bx / vw,
          y:      by / vh,
          width:  bw / vw,
          height: bh / vh,
        },
        snapshotUrl,
        videoClipUrl:  null,
        source:        "browser_webrtc",   // vs "rtsp_stream" pour le serveur Python
        detectedAt:    now,
        createdAt:     now,
      }
    );

    console.log(`[VisionGuard] Detection saved: ${detection.class} (${Math.round(detection.score*100)}%) → ${detectionRef.id.slice(0,8)}`);
    return detectionRef.id;

  } catch (err) {
    console.error("[detectionSaver] Erreur:", err);
    return null;
  }
}

/** Capture une frame de la vidéo et l'uploade dans Firebase Storage */
async function captureAndUpload(
  video:          HTMLVideoElement,
  organizationId: string,
  cameraId:       string,
): Promise<string | null> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);

    // Canvas → Blob JPEG
    const blob: Blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.80)
    );

    const detectionId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const path        = `organizations/${organizationId}/snapshots/${cameraId}/${detectionId}.jpg`;
    const storageRef  = ref(storage, path);

    await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;

  } catch (err) {
    console.warn("[detectionSaver] Snapshot upload failed:", err);
    return null;  // On continue sans snapshot si le Storage échoue
  }
}

/** Sauvegarde réelle d'une caméra dans Firestore via Cloud Function */
export async function saveCameraToFirestore(input: {
  organizationId: string;
  name:           string;
  connector:      "phone_webcam";
  brand:          string;
  timezone:       string;
}): Promise<{ cameraId: string }> {
  const { httpsCallable } = await import("firebase/functions");
  const { functions }     = await import("@/lib/firebase/client");

  // Vérifier si l'utilisateur est connecté
  const { auth } = await import("@/lib/firebase/client");
  if (!auth.currentUser) {
    throw new Error("Vous devez être connecté pour enregistrer une caméra. Rendez-vous sur /login.");
  }

  const addCameraFn = httpsCallable(functions, "addCamera");
  const result = await addCameraFn({
    organizationId: input.organizationId,
    siteId:         "default",
    name:           input.name,
    brand:          input.brand,
    connector:      input.connector,
    timezone:       Intl.DateTimeFormat().resolvedOptions().timeZone,
    location:       "Caméra téléphone / webcam",
  });

  // Mettre à jour le statut à "online" immédiatement
  const connectCameraFn = httpsCallable(functions, "connectCamera");
  await connectCameraFn({
    organizationId: input.organizationId,
    cameraId:       (result.data as any).cameraId,
    connectorType:  "phone_webcam",
    credentials:    { host: "browser-webrtc" },
  });

  return { cameraId: (result.data as any).cameraId };
}
