/**
 * Vision Guard AI Server Client
 * Connecte le dashboard Next.js au serveur Python (YOLOv11 + ByteTrack + OCR)
 *
 * Si le serveur est disponible → utilise YOLOv11 serveur (précis)
 * Sinon → fallback vers COCO-SSD navigateur (80 classes basiques)
 */

const AI_SERVER_URL = process.env.NEXT_PUBLIC_AI_SERVER_URL ?? "";

export interface ServerDetection {
  class:       string;
  label:       string;
  icon:        string;
  category:    string;
  severity:    "critical" | "warning" | "info";
  score:       number;
  confidence:  number;
  bbox:        [number, number, number, number];
  center:      [number, number];
  track_id?:   number;
  alert:       boolean;
  ocr?:        { plate_text?: string; text?: string; confidence: number };
  module:      string;
}

export interface ServerResponse {
  detections:   ServerDetection[];
  count:        number;
  alerts:       ServerDetection[];
  critical:     ServerDetection[];
  ocr_results:  any[];
  module:       string;
  inference_ms: number;
  model:        string;
}

/** Vérifie si le serveur IA est disponible */
export async function checkServerAvailable(): Promise<boolean> {
  if (!AI_SERVER_URL) return false;
  try {
    const res = await fetch(`${AI_SERVER_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Récupère le status des modèles du serveur */
export async function getServerStatus() {
  if (!AI_SERVER_URL) return null;
  try {
    const res = await fetch(`${AI_SERVER_URL}/`, {
      signal: AbortSignal.timeout(5000),
    });
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Envoie une image au serveur pour détection.
 * Retourne les détections enrichies (casque, gilet, uniforme, etc.)
 */
export async function detectOnServer(options: {
  imageBase64:    string;
  moduleId:       string;
  organizationId: string;
  cameraId:       string;
  saveFirebase?:  boolean;
  runOCR?:        boolean;
}): Promise<ServerResponse | null> {
  if (!AI_SERVER_URL) return null;

  try {
    const res = await fetch(`${AI_SERVER_URL}/detect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image:            options.imageBase64,
        module_id:        options.moduleId,
        organization_id:  options.organizationId,
        camera_id:        options.cameraId,
        run_tracking:     true,
        run_ocr:          options.runOCR ?? (options.moduleId === "transportation"),
        save_to_firebase: options.saveFirebase ?? false,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Pipeline complet : image → YOLO → Track → OCR → Firebase
 * Utilisé pour les détections importantes
 */
export async function runServerPipeline(options: {
  imageBase64:    string;
  moduleId:       string;
  organizationId: string;
  cameraId:       string;
}): Promise<{ eventIds: string[]; detections: ServerDetection[] } | null> {
  if (!AI_SERVER_URL) return null;

  try {
    const res = await fetch(`${AI_SERVER_URL}/pipeline/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image:           options.imageBase64,
        module_id:       options.moduleId,
        organization_id: options.organizationId,
        camera_id:       options.cameraId,
        save_firebase:   true,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return { eventIds: data.events_saved ?? [], detections: data.detections ?? [] };
  } catch {
    return null;
  }
}

/**
 * Capture une frame du videoElement et l'envoie au serveur
 */
export function captureFrameBase64(video: HTMLVideoElement): string | null {
  try {
    const canvas    = document.createElement("canvas");
    canvas.width    = video.videoWidth  || 640;
    canvas.height   = video.videoHeight || 480;
    const ctx       = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    // Retourne base64 sans le header "data:image/..."
    return canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
  } catch {
    return null;
  }
}
