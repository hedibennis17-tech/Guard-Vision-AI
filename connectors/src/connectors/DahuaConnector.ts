import { BaseConnector } from "../base/BaseConnector";
import type { ConnectorCredentials, ConnectionTestResult, DeviceInfo } from "../types";

/**
 * DahuaConnector — intégration via HTTP API SDK Dahua.
 * Endpoint de base : /cgi-bin/magicBox.cgi?action=getSystemInfo
 * Stream RTSP standard Dahua.
 */
export class DahuaConnector extends BaseConnector {
  readonly type = "dahua" as const;

  buildStreamUrl(credentials: ConnectorCredentials): string {
    const { username = "admin", password = "", host, channel = 1 } = credentials;
    // Channel 1, main stream = 0, sub stream = 1
    return `rtsp://${username}:${encodeURIComponent(password)}@${host}:554/cam/realmonitor?channel=${channel}&subtype=0`;
  }

  async testConnection(credentials: ConnectorCredentials): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      if (!credentials.host) {
        return this.failResult("MISSING_HOST", "Adresse IP Dahua requise.");
      }
      // En production : GET /cgi-bin/magicBox.cgi?action=getSystemInfo avec Digest Auth
      const streamUrl = this.buildStreamUrl(credentials);
      const latencyMs = Date.now() - start;
      this.log("info", "Dahua connecté (stub)", { host: credentials.host });

      return { success: true, latencyMs, streamUrl, deviceInfo: { manufacturer: "Dahua" } };
    } catch (err: any) {
      return this.failResult("DAHUA_ERROR", err.message);
    }
  }

  async getStreamUrl(c: ConnectorCredentials): Promise<string> {
    return this.buildStreamUrl(c);
  }

  async getSnapshotUrl(c: ConnectorCredentials): Promise<string | null> {
    const { host, username = "admin", password = "", channel = 1 } = c;
    return `http://${host}/cgi-bin/snapshot.cgi?channel=${channel}&LoginName=${username}&LoginPassword=${password}`;
  }

  async getDeviceInfo(c: ConnectorCredentials): Promise<DeviceInfo | null> {
    this.log("info", "getDeviceInfo Dahua (stub)", { host: c.host });
    return { manufacturer: "Dahua" };
  }
}
