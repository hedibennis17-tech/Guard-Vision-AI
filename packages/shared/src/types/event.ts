/**
 * Detection — sortie brute du moteur YOLO pour une frame/segment.
 * Le moteur IA reçoit un flux vidéo et produit des Detections ; il ne connaît
 * jamais Ring, Hikvision, etc. (voir docs/ARCHITECTURE.md — Phase 5).
 *
 * Collection Firestore: `organizations/{organizationId}/detections/{detectionId}`
 */
export interface DetectionDoc {
  id: string;
  organizationId: string;
  siteId: string;
  cameraId: string;

  type:
    | "person"
    | "vehicle"
    | "animal"
    | "object"
    | "fire"
    | "smoke"
    | "license_plate"
    | "ppe_violation";
  confidence: number; // 0-1
  boundingBox?: { x: number; y: number; width: number; height: number };

  snapshotUrl?: string;
  videoClipUrl?: string;

  detectedAt: string;
}

/**
 * Event — regroupe une ou plusieurs Detections en un événement actionnable
 * (ex: 12 detections "person" sur 8 secondes = 1 event "intrusion possible").
 * C'est l'Event Engine (Phase 6) qui fait cette agrégation.
 *
 * Collection Firestore: `organizations/{organizationId}/events/{eventId}`
 */
export interface EventDoc {
  id: string;
  organizationId: string;
  siteId: string;
  cameraId: string;

  detectionIds: string[];
  primaryType: DetectionDoc["type"];
  severity: "info" | "warning" | "critical";

  durationSeconds: number;
  thumbnailUrl?: string;
  videoClipUrl?: string;

  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;

  createdAt: string;
}

/**
 * Notification — Phase 7. Push / Email / (SMS plus tard).
 * Collection Firestore: `organizations/{organizationId}/notifications/{notificationId}`
 */
export interface NotificationDoc {
  id: string;
  organizationId: string;
  userId: string; // destinataire
  eventId?: string;

  channel: "push" | "email" | "sms";
  title: string;
  body: string;

  read: boolean;
  sentAt?: string;
  createdAt: string;
}

/**
 * Report — Phase 8. Rapports générés (journalier/hebdo/mensuel ou à la demande).
 * Collection Firestore: `organizations/{organizationId}/reports/{reportId}`
 */
export interface ReportDoc {
  id: string;
  organizationId: string;
  siteId?: string; // absent = tous les sites

  cadence: "daily" | "weekly" | "monthly" | "on_demand";
  format: "pdf" | "excel" | "csv";

  periodStart: string;
  periodEnd: string;
  fileUrl: string;

  generatedBy: "system" | string; // "system" si automatique, sinon uid
  createdAt: string;
}
