import { BaseConnector } from "../base/BaseConnector";
import type {
  ConnectorCredentials,
  ConnectionTestResult,
  DeviceInfo,
} from "../types";

/**
 * OnvifConnector — protocole standard pour caméras IP professionnelles.
 * Supporte Hikvision, Dahua, Axis, Bosch, Hanwha, etc. via ONVIF Profile S.
 *
 * En production : utilise `node-onvif` pour négocier WS-Discovery, 
 * récupérer les profils de stream et les métadonnées de la caméra.
 *
 * Note Phase 3 : la découverte réseau automatique (WS-Discovery UDP multicast)
 * est dans OnvifDiscovery.ts ; ce connecteur gère une caméra déjà connue (host:port).
 */
export class OnvifConnector extends BaseConnector {
  readonly type = "onvif" as const;

  async testConnection(credentials: ConnectorCredentials): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      if (!credentials.host) {
        return this.failResult("MISSING_HOST", "L'adresse IP est requise pour ONVIF.");
      }

      const { host, port = 80, username = "", password = "" } = credentials;

      // En production : initialiser node-onvif et appeler GetDeviceInformation
      // import OnvifDevice from "node-onvif";
      // const device = new OnvifDevice({ xaddr: `http://${host}:${port}/onvif/device_service`, user: username, pass: password });
      // await device.init();
      // const info = device.getCurrentProfile();

      // Phase 3 : retourne un résultat simulé avec l'URL RTSP déduite ONVIF standard
      const streamUrl = `rtsp://${username}:${password}@${host}:554/Streaming/Channels/101`;
      const latencyMs = Date.now() - start;

      this.log("info", "ONVIF connecté (mode stub Phase 3)", { host, port });

      return {
        success: true,
        latencyMs,
        streamUrl,
        deviceInfo: {
          manufacturer: "ONVIF Device",
          model: "Unknown",
        },
      };
    } catch (err: any) {
      this.log("error", "Erreur ONVIF", { error: err.message });
      return this.failResult("ONVIF_ERROR", err.message);
    }
  }

  async getStreamUrl(credentials: ConnectorCredentials): Promise<string> {
    const { host, username = "", password = "" } = credentials;
    // URL RTSP standard ONVIF Profile S
    return `rtsp://${username}:${password}@${host}:554/Streaming/Channels/101`;
  }

  async getSnapshotUrl(credentials: ConnectorCredentials): Promise<string | null> {
    const { host, username = "", password = "" } = credentials;
    // Snapshot ONVIF standard
    return `http://${username}:${password}@${host}/onvif/snapshot`;
  }

  async getDeviceInfo(credentials: ConnectorCredentials): Promise<DeviceInfo | null> {
    // En production : GetDeviceInformation via node-onvif
    this.log("info", "getDeviceInfo ONVIF (stub)", { host: credentials.host });
    return null;
  }
}
