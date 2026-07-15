import { v4 as uuidv4 } from "uuid";
import { HlsTranscoder } from "../transcoder/HlsTranscoder";
import { StreamRouter } from "../router/StreamRouter";
import type {
  StreamSession,
  StreamStatus,
  StreamQuality,
  StartStreamOptions,
  StreamMetrics,
} from "../types";

/**
 * LiveStreamManager — orchestrateur central du Live Streaming (Phase 4).
 *
 * Responsabilités :
 *   1. Démarrer / arrêter les sessions de streaming
 *   2. Transcoder RTSP → HLS via FFmpeg (HlsTranscoder)
 *   3. Distribuer les flux aux clients via WebSocket (StreamRouter)
 *   4. Exposer les URLs RTSP directes pour YOLO (Phase 5)
 *   5. Monitorer la santé des streams (heartbeat, auto-reconnect)
 *
 * Ce module ne connaît JAMAIS le type de connecteur (Ring, Hikvision, etc.)
 * Il reçoit uniquement un `rtspUrl` normalisé depuis le ConnectorEngine.
 *
 * Flux de données :
 *
 *   ConnectorEngine → rtspUrl
 *       ↓
 *   LiveStreamManager
 *       ├── HlsTranscoder (FFmpeg) → HLS → Dashboard + App mobile
 *       ├── StreamRouter (WebSocket) → notifications clients
 *       └── yoloRtspUrl → YOLO AI Engine (Phase 5)
 */
export class LiveStreamManager {
  private sessions = new Map<string, SessionState>();
  private transcoder: HlsTranscoder;
  private router: StreamRouter;
  private healthCheckInterval?: NodeJS.Timer;

  constructor(options: {
    outputDir?: string;
    wsPort?: number;
    hlsBaseUrl?: string;
  } = {}) {
    this.transcoder = new HlsTranscoder(options.outputDir);
    this.router = new StreamRouter(options.wsPort ?? 8765);
    this.startHealthCheck();
  }

  /**
   * Démarre un stream pour une caméra.
   * Appelé par la Cloud Function startStream ou directement par le Live Monitor.
   */
  async startStream(options: StartStreamOptions): Promise<StreamSession> {
    const { cameraId, organizationId, rtspUrl, quality = "auto" } = options;

    // Si une session existe déjà pour cette caméra, on la retourne
    const existing = this.findSessionByCameraId(cameraId);
    if (existing && existing.session.status === "live") {
      return existing.session;
    }

    const sessionId = uuidv4();
    const now = new Date().toISOString();

    const session: StreamSession = {
      id: sessionId,
      cameraId,
      organizationId,
      rtspUrl,
      hlsUrl: "",         // rempli après démarrage du transcoder
      yoloRtspUrl: rtspUrl, // YOLO consomme le RTSP source directement
      status: "starting",
      quality,
      startedAt: now,
      viewerCount: 0,
      metrics: this.emptyMetrics(),
    };

    const { hlsUrl, process } = this.transcoder.start({
      sessionId,
      rtspUrl,
      outputDir: `/tmp/visionguard/streams/${sessionId}`,
      quality,
    });

    session.hlsUrl = hlsUrl;
    session.status = "live";

    this.sessions.set(sessionId, { session, ffmpegProcess: process });

    // Notifier les clients WebSocket que le stream est live
    this.router.notifyLive(session);

    this.log("info", "Stream démarré", { sessionId, cameraId, hlsUrl });
    return session;
  }

  /** Arrête un stream et libère les ressources FFmpeg */
  async stopStream(sessionId: string): Promise<void> {
    const state = this.sessions.get(sessionId);
    if (!state) return;

    this.transcoder.stop(state.ffmpegProcess, sessionId);
    this.sessions.delete(sessionId);
    this.router.broadcast(sessionId, { type: "stream_stopped", sessionId });
    this.log("info", "Stream arrêté", { sessionId });
  }

  /** Arrête tous les streams d'une organisation (ex: lors d'une déconnexion) */
  async stopAllStreams(organizationId: string): Promise<void> {
    for (const [sessionId, state] of this.sessions.entries()) {
      if (state.session.organizationId === organizationId) {
        await this.stopStream(sessionId);
      }
    }
  }

  /** Change la qualité d'un stream en cours */
  async changeQuality(sessionId: string, quality: StreamQuality): Promise<void> {
    const state = this.sessions.get(sessionId);
    if (!state) throw new Error(`Session ${sessionId} introuvable.`);

    const { session } = state;
    this.transcoder.stop(state.ffmpegProcess, sessionId);

    const { hlsUrl, process } = this.transcoder.start({
      sessionId,
      rtspUrl: session.rtspUrl,
      outputDir: `/tmp/visionguard/streams/${sessionId}`,
      quality,
    });

    session.hlsUrl = hlsUrl;
    session.quality = quality;
    state.ffmpegProcess = process;

    this.router.notifyLive(session);
    this.log("info", "Qualité changée", { sessionId, quality });
  }

  /** Retourne toutes les sessions actives d'une organisation */
  getActiveSessions(organizationId: string): StreamSession[] {
    return Array.from(this.sessions.values())
      .filter((s) => s.session.organizationId === organizationId)
      .map((s) => s.session);
  }

  getSession(sessionId: string): StreamSession | null {
    return this.sessions.get(sessionId)?.session ?? null;
  }

  /** Mise à jour des métriques (appelée périodiquement par FFmpeg events) */
  updateMetrics(sessionId: string, metrics: Partial<StreamMetrics>) {
    const state = this.sessions.get(sessionId);
    if (!state) return;
    Object.assign(state.session.metrics, metrics);
    state.session.lastFrameAt = new Date().toISOString();
    this.router.broadcast(sessionId, { type: "metrics", sessionId, metrics: state.session.metrics });
  }

  /** Health check toutes les 30s — restart auto si le stream est tombé */
  private startHealthCheck() {
    this.healthCheckInterval = setInterval(() => {
      for (const [sessionId, state] of this.sessions.entries()) {
        const { session } = state;
        if (!session.lastFrameAt) continue;
        const secondsSinceLastFrame =
          (Date.now() - new Date(session.lastFrameAt).getTime()) / 1000;
        if (secondsSinceLastFrame > 30) {
          this.log("warn", "Stream inactif — tentative de restart", { sessionId });
          this.changeQuality(sessionId, session.quality).catch(() => {
            session.status = "error";
            session.errorMessage = "Stream perdu — reconnexion impossible.";
            this.router.notifyError(sessionId, session.errorMessage);
          });
        }
      }
    }, 30_000);
  }

  private findSessionByCameraId(cameraId: string) {
    for (const [, state] of this.sessions.entries()) {
      if (state.session.cameraId === cameraId) return state;
    }
    return null;
  }

  private emptyMetrics(): StreamMetrics {
    return { fps: 0, bitrateBps: 0, latencyMs: 0, droppedFrames: 0, resolution: { width: 0, height: 0 } };
  }

  private log(level: "info" | "warn" | "error", message: string, meta?: object) {
    console[level === "info" ? "log" : level](
      JSON.stringify({ module: "LiveStreamManager", level, message, ...meta, ts: new Date().toISOString() })
    );
  }

  destroy() {
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval as any);
    this.router.close();
  }
}

interface SessionState {
  session: StreamSession;
  ffmpegProcess: any;
}
