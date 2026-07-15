import { BaseConnector } from "../base/BaseConnector";
import type { ConnectorCredentials, ConnectionTestResult, DeviceInfo } from "../types";

/**
 * ReolinkConnector — API JSON Reolink (port 80/443 HTTP).
 * Endpoint : POST /api.cgi?cmd=Login puis GET streams.
 * Pas de ONVIF natif sur les modèles d'entrée de gamme, d'où ce connecteur dédié.
 */
export class ReolinkConnector extends BaseConnector {
  readonly type = "reolink" as const;

  buildStreamUrl(credentials: ConnectorCredentials): string {
    const { username = "admin", password = "", host, channel = 0 } = credentials;
    return `rtsp://${username}:${encodeURIComponent(password)}@${host}:554/h264Preview_0${channel + 1}_main`;
  }

  async testConnection(credentials: ConnectorCredentials): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      if (!credentials.host) {
        return this.failResult("MISSING_HOST", "Adresse IP Reolink requise.");
      }
      // En production :
      // const loginRes = await axios.post(`http://${host}/api.cgi?cmd=Login`, [{ cmd: "Login", param: { User: { userName, password } } }])
      // const token = loginRes.data[0].value.Token.name;
      // const infoRes = await axios.get(`http://${host}/api.cgi?cmd=GetDevInfo&token=${token}`);

      const streamUrl = this.buildStreamUrl(credentials);
      const latencyMs = Date.now() - start;
      this.log("info", "Reolink connecté (stub)", { host: credentials.host });

      return { success: true, latencyMs, streamUrl, deviceInfo: { manufacturer: "Reolink" } };
    } catch (err: any) {
      return this.failResult("REOLINK_ERROR", err.message);
    }
  }

  async getStreamUrl(c: ConnectorCredentials): Promise<string> {
    return this.buildStreamUrl(c);
  }

  async getSnapshotUrl(c: ConnectorCredentials): Promise<string | null> {
    // En production : utiliser le token de session pour récupérer un snapshot
    const { host } = c;
    return `http://${host}/api.cgi?cmd=Snap&channel=0&rs=xxx`;
  }

  async getDeviceInfo(c: ConnectorCredentials): Promise<DeviceInfo | null> {
    this.log("info", "getDeviceInfo Reolink (stub)", { host: c.host });
    return { manufacturer: "Reolink" };
  }
}
