import { WebSocketServer, WebSocket } from "ws";
import type { StreamSession } from "../types";

/**
 * StreamRouter — distribue les flux actifs aux clients connectés via WebSocket.
 *
 * Abonnés possibles par session :
 *   → Dashboard (clients web)
 *   → App mobile (clients web/native)
 *   → AI Engine YOLO (Phase 5) — consomme le rtspUrl directement, pas HLS
 *
 * Le router gère aussi :
 *   - Le comptage de viewers (pour libérer les ressources FFmpeg si 0 viewer)
 *   - Les heartbeats pour détecter les clients déconnectés
 *   - Les messages de changement de qualité
 */
export class StreamRouter {
  private wss: WebSocketServer;
  /** Map<sessionId, Set<WebSocket>> */
  private subscribers = new Map<string, Set<WebSocket>>();

  constructor(port: number = 8765) {
    this.wss = new WebSocketServer({ port });
    this.wss.on("connection", (ws, req) => this.handleConnection(ws, req));
    console.log(JSON.stringify({ module: "StreamRouter", event: "started", port }));
  }

  private handleConnection(ws: WebSocket, req: any) {
    // URL pattern : ws://host:8765/stream?sessionId=xxx&token=yyy
    const url = new URL(req.url ?? "", `http://localhost`);
    const sessionId = url.searchParams.get("sessionId");
    const token = url.searchParams.get("token"); // JWT validé en production

    if (!sessionId) {
      ws.close(1008, "sessionId requis");
      return;
    }

    // TODO Phase 3+: valider le token Firebase côté serveur
    this.subscribe(sessionId, ws);

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "ping") ws.send(JSON.stringify({ type: "pong" }));
        if (msg.type === "quality_change") {
          // Relayer au LiveStreamManager pour redémarrer le transcoder avec la nouvelle qualité
          ws.emit("quality_change", { sessionId, quality: msg.quality });
        }
      } catch {}
    });

    ws.on("close", () => this.unsubscribe(sessionId, ws));
    ws.on("error", () => this.unsubscribe(sessionId, ws));

    ws.send(JSON.stringify({ type: "connected", sessionId }));
  }

  subscribe(sessionId: string, ws: WebSocket) {
    if (!this.subscribers.has(sessionId)) {
      this.subscribers.set(sessionId, new Set());
    }
    this.subscribers.get(sessionId)!.add(ws);
  }

  unsubscribe(sessionId: string, ws: WebSocket) {
    this.subscribers.get(sessionId)?.delete(ws);
    if (this.subscribers.get(sessionId)?.size === 0) {
      this.subscribers.delete(sessionId);
    }
  }

  /** Notifie tous les clients d'une session d'un changement de statut */
  broadcast(sessionId: string, payload: object) {
    const clients = this.subscribers.get(sessionId);
    if (!clients) return;
    const msg = JSON.stringify(payload);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }

  /** Notifie tous les viewers qu'un stream est maintenant live */
  notifyLive(session: StreamSession) {
    this.broadcast(session.id, {
      type: "stream_live",
      sessionId: session.id,
      hlsUrl: session.hlsUrl,
      metrics: session.metrics,
    });
  }

  /** Notifie d'une erreur sur le stream */
  notifyError(sessionId: string, errorMessage: string) {
    this.broadcast(sessionId, { type: "stream_error", sessionId, errorMessage });
  }

  getViewerCount(sessionId: string): number {
    return this.subscribers.get(sessionId)?.size ?? 0;
  }

  close() {
    this.wss.close();
  }
}
