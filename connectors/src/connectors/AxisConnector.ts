import { BaseConnector } from "../base/BaseConnector";
import type { ConnectorCredentials, ConnectionTestResult, DeviceInfo } from "../types";

/**
 * AxisConnector — intégration via VAPIX (API officielle Axis Communications).
 * Supporte RTSP et MJPEG; snapshot via /axis-cgi/jpg/image.cgi
 */
export class AxisConnector extends BaseConnector {
  readonly type = "axis" as const;

  buildStreamUrl(credentials: ConnectorCredentials): string {
    const { username = "root", password = "", host } = credentials;
    return `rtsp://${username}:${encodeURIComponent(password)}@${host}/axis-media/media.amp`;
  }

  async testConnection(credentials: ConnectorCredentials): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      if (!credentials.host) {
        return this.failResult("MISSING_HOST", "Adresse IP Axis requise.");
      }
      // En production : GET /axis-cgi/param.cgi?action=list&group=root.Properties.API.HTTP.Version
      const streamUrl = this.buildStreamUrl(credentials);
      const latencyMs = Date.now() - start;
      this.log("info", "Axis connecté (stub)", { host: credentials.host });

      return { success: true, latencyMs, streamUrl, deviceInfo: { manufacturer: "Axis" } };
    } catch (err: any) {
      return this.failResult("AXIS_ERROR", err.message);
    }
  }

  async getStreamUrl(c: ConnectorCredentials): Promise<string> {
    return this.buildStreamUrl(c);
  }

  async getSnapshotUrl(c: ConnectorCredentials): Promise<string | null> {
    const { host, username = "root", password = "" } = c;
    return `http://${username}:${password}@${host}/axis-cgi/jpg/image.cgi`;
  }

  async getDeviceInfo(c: ConnectorCredentials): Promise<DeviceInfo | null> {
    this.log("info", "getDeviceInfo Axis (stub)", { host: c.host });
    return { manufacturer: "Axis" };
  }
}
