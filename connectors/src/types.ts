/**
 * Vision Guard — Camera Connector Engine
 * Types communs partagés entre tous les connecteurs.
 *
 * PRINCIPE CLÉ (Phase 5) : le moteur YOLO ne connaît jamais le type de connecteur.
 * Il reçoit uniquement un `streamUrl` normalisé (RTSP ou HLS) produit par ce module.
 */

export type ConnectorType =
  | "ring"
  | "nest"
  | "reolink"
  | "hikvision"
  | "dahua"
  | "axis"
  | "onvif"
  | "rtsp"
  | "generic_ip";

/** Credentials passées au connecteur (jamais stockées en clair dans Firestore — voir CameraCredentialsDoc) */
export interface ConnectorCredentials {
  username?: string;
  password?: string;
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  host?: string;      // IP ou hostname de la caméra
  port?: number;
  path?: string;      // chemin du stream RTSP ex: /stream1
  channel?: number;   // pour Hikvision/Dahua multi-canal
}

/** Résultat d'un test de connexion */
export interface ConnectionTestResult {
  success: boolean;
  latencyMs?: number;
  errorCode?: string;
  errorMessage?: string;
  /** URL du stream normalisée si succès */
  streamUrl?: string;
  /** URL de snapshot statique si disponible */
  snapshotUrl?: string;
  /** Infos caméra découvertes (marque, modèle, firmware...) */
  deviceInfo?: DeviceInfo;
}

export interface DeviceInfo {
  manufacturer?: string;
  model?: string;
  firmware?: string;
  serialNumber?: string;
  macAddress?: string;
  resolution?: { width: number; height: number };
  fps?: number;
}

/** Résultat d'une découverte ONVIF sur le réseau local */
export interface DiscoveredDevice {
  name: string;
  host: string;
  port: number;
  manufacturer?: string;
  model?: string;
  serviceUrls: string[];
}

/** État en temps réel d'un connecteur actif */
export interface ConnectorStatus {
  cameraId: string;
  connected: boolean;
  streamUrl?: string;
  lastHeartbeatAt?: string;
  errorMessage?: string;
  reconnectAttempts: number;
}

/** Interface implémentée par chaque connecteur */
export interface ICameraConnector {
  readonly type: ConnectorType;
  testConnection(credentials: ConnectorCredentials): Promise<ConnectionTestResult>;
  getStreamUrl(credentials: ConnectorCredentials): Promise<string>;
  getSnapshotUrl(credentials: ConnectorCredentials): Promise<string | null>;
  getDeviceInfo(credentials: ConnectorCredentials): Promise<DeviceInfo | null>;
  /** Certains connecteurs (Ring, Nest) nécessitent un OAuth flow */
  requiresOAuth?: boolean;
  getOAuthUrl?: (organizationId: string, cameraId: string) => string;
}
