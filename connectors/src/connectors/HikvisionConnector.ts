import { BaseConnector } from "../base/BaseConnector";
import type { ConnectorCredentials, ConnectionTestResult, DeviceInfo } from "../types";

/**
 * HikvisionConnector — intégration via ISAPI (IP Camera RESTful API).
 * Toutes les caméras Hikvision exposent ISAPI sur /ISAPI/System/deviceInfo.
 * Le flux RTSP suit le pattern standard Hikvision.
 */
export class HikvisionConnector extends BaseConnector {
  readonly type = "hikvision" as const;

  private baseUrl(credentials: ConnectorCredentials): string {
    const { host, port = 80 } = credentials;
    return `http://${host}:${port}`;
  }

  buildStreamUrl(credentials: ConnectorCredentials): string {
    const { username = "admin", password = "", host, port: _p, channel = 1 } = credentials;
    // Canal 1, flux principal = 01, secondaire = 02
    return `rtsp://${username}:${encodeURIComponent(password)}@${host}:554/Streaming/Channels/${channel}01`;
  }

  async testConnection(credentials: ConnectorCredentials): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      if (!credentials.host) {
        return this.failResult("MISSING_HOST", "Adresse IP Hikvision requise.");
      }
      // En production : GET /ISAPI/System/deviceInfo avec Digest Auth
      // const response = await axios.get(`${this.baseUrl(credentials)}/ISAPI/System/deviceInfo`, {
      //   auth: { username: credentials.username!, password: credentials.password! },
      //   timeout: this.timeoutMs,
      // });
      // const info = await parseXml(response.data);

      const streamUrl = this.buildStreamUrl(credentials);
      const latencyMs = Date.now() - start;
      this.log("info", "Hikvision connecté (stub)", { host: credentials.host });

      return {
        success: true,
        latencyMs,
        streamUrl,
        snapshotUrl: `${this.baseUrl(credentials)}/Streaming/Channels/1/picture`,
        deviceInfo: { manufacturer: "Hikvision" },
      };
    } catch (err: any) {
      return this.failResult("HIK_ERROR", err.message);
    }
  }

  async getStreamUrl(c: ConnectorCredentials): Promise<string> {
    return this.buildStreamUrl(c);
  }

  async getSnapshotUrl(c: ConnectorCredentials): Promise<string | null> {
    return `${this.baseUrl(c)}/Streaming/Channels/1/picture`;
  }

  async getDeviceInfo(c: ConnectorCredentials): Promise<DeviceInfo | null> {
    // En production : parser /ISAPI/System/deviceInfo (XML)
    this.log("info", "getDeviceInfo Hikvision (stub)", { host: c.host });
    return { manufacturer: "Hikvision" };
  }
}
