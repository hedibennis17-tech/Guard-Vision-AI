import { BaseConnector } from "../base/BaseConnector";
import type { ConnectorCredentials, ConnectionTestResult, DeviceInfo } from "../types";

/**
 * NestConnector — intégration via Google Smart Device Management (SDM) API.
 * Comme Ring, Nest fonctionne via le cloud Google.
 * L'accès direct RTSP n'est pas disponible — le stream est WebRTC via l'API SDM.
 *
 * Flow OAuth2 :
 * 1. getOAuthUrl() → redirige vers Google OAuth2 avec scope SDM
 * 2. Google redirige vers notre callback avec le code
 * 3. On échange contre access_token + refresh_token (Google Cloud project requis)
 * 4. On appelle SDM API : projects/{project}/devices pour lister les caméras
 *
 * SDM API URL : https://smartdevicemanagement.googleapis.com/v1/
 */
export class NestConnector extends BaseConnector {
  readonly type = "nest" as const;
  readonly requiresOAuth = true;

  private readonly callbackBaseUrl: string;
  private readonly projectId: string;

  constructor(options: { callbackBaseUrl?: string; projectId?: string } = {}) {
    super();
    this.callbackBaseUrl = options.callbackBaseUrl ?? process.env.VISIONGUARD_CALLBACK_URL ?? "https://app.visionguard.ai";
    this.projectId = options.projectId ?? process.env.GOOGLE_SDM_PROJECT_ID ?? "";
  }

  getOAuthUrl(organizationId: string, cameraId: string): string {
    const state = Buffer.from(JSON.stringify({ organizationId, cameraId })).toString("base64url");
    const callbackUrl = encodeURIComponent(`${this.callbackBaseUrl}/api/oauth/nest/callback`);
    const scope = encodeURIComponent("https://www.googleapis.com/auth/sdm.service");
    return `https://nestservices.google.com/partnerconnections/${this.projectId}/auth?redirect_uri=${callbackUrl}&access_type=offline&response_type=code&scope=${scope}&state=${state}`;
  }

  async testConnection(credentials: ConnectorCredentials): Promise<ConnectionTestResult> {
    try {
      if (!credentials.accessToken && !credentials.refreshToken) {
        return this.failResult(
          "NEST_NO_TOKEN",
          "Authentification Google Nest requise. Utilisez le bouton 'Connecter Nest' pour autoriser l'accès."
        );
      }
      // En production :
      // const res = await axios.get(`https://smartdevicemanagement.googleapis.com/v1/enterprises/${projectId}/devices`, {
      //   headers: { Authorization: `Bearer ${credentials.accessToken}` }
      // });
      this.log("info", "Nest connecté (stub OAuth)", {});
      return {
        success: true,
        latencyMs: 0,
        streamUrl: "webrtc://nest-stream-placeholder",
        deviceInfo: { manufacturer: "Google Nest" },
      };
    } catch (err: any) {
      return this.failResult("NEST_ERROR", err.message);
    }
  }

  async getStreamUrl(_credentials: ConnectorCredentials): Promise<string> {
    // En production : appeler SDM GenerateRtspStream endpoint
    return "rtsp://stream.nest.example/placeholder";
  }

  async getSnapshotUrl(_credentials: ConnectorCredentials): Promise<string | null> {
    // En production : SDM GenerateImage
    return null;
  }

  async getDeviceInfo(_credentials: ConnectorCredentials): Promise<DeviceInfo | null> {
    return { manufacturer: "Google Nest" };
  }
}
