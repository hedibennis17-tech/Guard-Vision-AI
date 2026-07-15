import { BaseConnector } from "../base/BaseConnector";
import type {
  ConnectorCredentials,
  ConnectionTestResult,
  DeviceInfo,
} from "../types";

/**
 * RtspConnector — connecteur universel pour tout flux RTSP.
 * Utilisé directement pour les caméras IP génériques, mais aussi comme
 * couche finale de normalisation pour Hikvision, Dahua, Axis, etc.
 *
 * Format URL RTSP produit :
 *   rtsp://user:pass@host:port/path
 */
export class RtspConnector extends BaseConnector {
  readonly type = "rtsp" as const;

  buildStreamUrl(credentials: ConnectorCredentials): string {
    const { username, password, host, port = 554, path = "/stream1" } = credentials;
    const auth = username && password ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@` : "";
    return `rtsp://${auth}${host}:${port}${path}`;
  }

  async testConnection(credentials: ConnectorCredentials): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      if (!credentials.host) {
        return this.failResult("MISSING_HOST", "L'adresse IP ou hostname est requis.");
      }
      const streamUrl = this.buildStreamUrl(credentials);
      // En production : tenter une connexion RTSP OPTIONS via net.Socket (non bloquant)
      // pour vérifier que le port répond. Ici on valide la structure de l'URL.
      const latencyMs = Date.now() - start;
      this.log("info", "RTSP URL construite", { streamUrl: streamUrl.replace(/:[^@]+@/, ":***@") });
      return { success: true, latencyMs, streamUrl };
    } catch (err: any) {
      this.log("error", "Erreur test RTSP", { error: err.message });
      return this.failResult("RTSP_ERROR", err.message);
    }
  }

  async getStreamUrl(credentials: ConnectorCredentials): Promise<string> {
    return this.buildStreamUrl(credentials);
  }

  async getSnapshotUrl(_credentials: ConnectorCredentials): Promise<string | null> {
    // Certaines caméras IP exposent /snapshot ou /jpg/image.jpg — non standard.
    return null;
  }

  async getDeviceInfo(_credentials: ConnectorCredentials): Promise<DeviceInfo | null> {
    return null;
  }
}
