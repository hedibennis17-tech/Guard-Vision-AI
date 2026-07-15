import { BaseConnector } from "../base/BaseConnector";
import type { ConnectorCredentials, ConnectionTestResult, DeviceInfo } from "../types";

/**
 * RingConnector — intégration via Ring API officielle (OAuth2).
 * Contrairement aux caméras IP classiques, Ring fonctionne via le cloud Ring,
 * pas en accès direct. Flux = WebRTC peer-to-peer via Ring backend.
 *
 * Flow OAuth2 (Phase 3 — stub, à implémenter avec ring-client-api en Phase 4) :
 * 1. getOAuthUrl() → redirige l'utilisateur vers Ring
 * 2. Ring redirige vers notre callback avec un code
 * 3. On échange le code contre un access_token + refresh_token
 * 4. Le token est stocké dans camera_credentials (chiffré)
 *
 * NOTE : Ring ne fournit pas de flux RTSP natif public.
 * ring-client-api crée un livestream local temporaire via WebRTC → RTSP proxy.
 */
export class RingConnector extends BaseConnector {
  readonly type = "ring" as const;
  readonly requiresOAuth = true;

  private readonly callbackBaseUrl: string;

  constructor(options: { callbackBaseUrl?: string } = {}) {
    super();
    this.callbackBaseUrl = options.callbackBaseUrl ?? process.env.VISIONGUARD_CALLBACK_URL ?? "https://app.visionguard.ai";
  }

  getOAuthUrl(organizationId: string, cameraId: string): string {
    // URL d'autorisation Ring — en production, passer par ring-client-api
    const state = Buffer.from(JSON.stringify({ organizationId, cameraId })).toString("base64url");
    const callbackUrl = encodeURIComponent(`${this.callbackBaseUrl}/api/oauth/ring/callback`);
    return `https://oauth.ring.com/oauth2/authorize?client_id=${process.env.RING_CLIENT_ID}&redirect_uri=${callbackUrl}&response_type=code&state=${state}`;
  }

  async testConnection(credentials: ConnectorCredentials): Promise<ConnectionTestResult> {
    try {
      if (!credentials.accessToken && !credentials.refreshToken) {
        return this.failResult(
          "RING_NO_TOKEN",
          "Authentification Ring requise. Utilisez le bouton 'Connecter Ring' pour autoriser l'accès."
        );
      }
      // En production :
      // const ring = new RingApi({ refreshToken: credentials.refreshToken! });
      // const cameras = await ring.getCameras();
      this.log("info", "Ring connecté (stub OAuth)", {});
      return {
        success: true,
        latencyMs: 0,
        streamUrl: "webrtc://ring-stream-placeholder",
        deviceInfo: { manufacturer: "Ring (Amazon)" },
      };
    } catch (err: any) {
      return this.failResult("RING_ERROR", err.message);
    }
  }

  async getStreamUrl(_credentials: ConnectorCredentials): Promise<string> {
    // En production : ring-client-api démarre un serveur RTSP local et retourne l'URL
    return "rtsp://localhost:8554/ring_camera_1";
  }

  async getSnapshotUrl(_credentials: ConnectorCredentials): Promise<string | null> {
    // En production : camera.getSnapshot() via ring-client-api
    return null;
  }

  async getDeviceInfo(_credentials: ConnectorCredentials): Promise<DeviceInfo | null> {
    return { manufacturer: "Ring (Amazon)" };
  }
}
