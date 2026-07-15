/**
 * Vision Guard — Live Stream Manager (Phase 4)
 *
 * PRINCIPE CLÉ :
 * Ce module est entièrement indépendant du Camera Connector Engine.
 * Il reçoit uniquement un `rtspUrl` normalisé et le distribue vers :
 *   → Dashboard (HLS via HTTP)
 *   → App Mobile (HLS via HTTP)
 *   → AI Engine YOLO (RTSP direct — Phase 5)
 *
 * Il ne sait JAMAIS si la source est Ring, Hikvision, ONVIF, etc.
 */

export type StreamProtocol = "rtsp" | "hls" | "webrtc";
export type StreamQuality = "auto" | "hd" | "sd" | "low";
export type StreamStatus = "idle" | "starting" | "live" | "error" | "stopped";

export interface StreamSession {
  id: string;
  cameraId: string;
  organizationId: string;

  /** URL RTSP source (produite par le ConnectorEngine — Phase 3) */
  rtspUrl: string;

  /** URL HLS produite par ce module, consommée par les clients web/mobile */
  hlsUrl: string;

  /** URL RTSP locale pour YOLO (Phase 5) */
  yoloRtspUrl: string;

  status: StreamStatus;
  quality: StreamQuality;

  startedAt?: string;
  lastFrameAt?: string;
  viewerCount: number;
  errorMessage?: string;

  /** Métriques de performance */
  metrics: StreamMetrics;
}

export interface StreamMetrics {
  fps: number;
  bitrateBps: number;
  latencyMs: number;
  droppedFrames: number;
  resolution: { width: number; height: number };
}

export interface StartStreamOptions {
  cameraId: string;
  organizationId: string;
  rtspUrl: string;
  quality?: StreamQuality;
}

export interface GridLayout {
  id: string;
  label: string;
  cols: number;
  rows: number;
  maxCameras: number;
}

export const GRID_LAYOUTS: GridLayout[] = [
  { id: "1x1",  label: "1 caméra",   cols: 1, rows: 1, maxCameras: 1  },
  { id: "1x2",  label: "2 caméras",  cols: 2, rows: 1, maxCameras: 2  },
  { id: "2x2",  label: "4 caméras",  cols: 2, rows: 2, maxCameras: 4  },
  { id: "3x3",  label: "9 caméras",  cols: 3, rows: 3, maxCameras: 9  },
  { id: "4x4",  label: "16 caméras", cols: 4, rows: 4, maxCameras: 16 },
];
