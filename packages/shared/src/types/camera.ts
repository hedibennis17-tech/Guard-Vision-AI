export type CameraConnectorType =
  | "ring"
  | "nest"
  | "reolink"
  | "hikvision"
  | "dahua"
  | "axis"
  | "onvif"
  | "rtsp"
  | "usb"
  | "generic_ip";

export type CameraStatus = "online" | "offline" | "connecting" | "error";

/**
 * Camera — indépendante du moteur IA (YOLO n'a jamais connaissance du connecteur).
 * Le Camera Connector Engine (Phase 3) est responsable de peupler `streamUrl`
 * et de maintenir `status`/`signalQuality` à jour.
 *
 * Collection Firestore: `organizations/{organizationId}/cameras/{cameraId}`
 */
export interface CameraDoc {
  id: string;
  organizationId: string;
  siteId: string;
  groupId?: string;

  name: string;
  brand: string;
  model?: string;

  connector: CameraConnectorType;
  /** Identifiants spécifiques au connecteur (jamais le secret/token — voir camera_credentials) */
  connectorMeta?: Record<string, string>;

  /** URL de stream normalisée produite par le Connector Engine, consommée par le Live Stream Manager */
  streamUrl?: string;
  streamProtocol?: "rtsp" | "hls" | "webrtc";

  status: CameraStatus;
  batteryLevel?: number; // null si alimentée secteur
  signalQuality?: number; // 0-100

  location?: string; // description libre, ex: "Entrée principale"
  timezone: string;

  /** Modules IA activés pour cette caméra spécifique (ex: fire detection en plus de motion) */
  enabledDetectionTypes: string[];

  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

/**
 * Credentials caméra — SÉPARÉES du document Camera principal pour ne jamais
 * exposer de secrets via les règles Firestore de lecture classique.
 * Accès restreint aux Cloud Functions uniquement (jamais lu côté client).
 *
 * Collection Firestore: `organizations/{organizationId}/camera_credentials/{cameraId}`
 */
export interface CameraCredentialsDoc {
  cameraId: string;
  connector: CameraConnectorType;
  /** Stocké chiffré (KMS) — jamais en clair, jamais renvoyé au client */
  encryptedSecret: string;
  refreshToken?: string;
  expiresAt?: string;
}
