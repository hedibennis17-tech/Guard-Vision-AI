import type { DiscoveredDevice } from "../types";

/**
 * OnvifDiscovery — détecte automatiquement les caméras ONVIF sur le réseau local
 * via WS-Discovery (UDP multicast sur 239.255.255.250:3702).
 *
 * En production : utilise `node-onvif` ou une implémentation UDP multicast directe.
 * Cette version est un stub documenté qui sera connecté en Phase 3.2.
 *
 * Usage :
 *   const discovery = new OnvifDiscovery();
 *   const devices = await discovery.scan({ timeoutMs: 5000 });
 */
export class OnvifDiscovery {
  async scan(options: { timeoutMs?: number } = {}): Promise<DiscoveredDevice[]> {
    const { timeoutMs = 5000 } = options;

    console.log(JSON.stringify({
      module: "OnvifDiscovery",
      action: "scan_start",
      timeoutMs,
      protocol: "WS-Discovery UDP multicast 239.255.255.250:3702",
      ts: new Date().toISOString(),
    }));

    // Production implementation:
    // const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
    // socket.bind(0, () => {
    //   socket.addMembership("239.255.255.250");
    //   socket.setBroadcast(true);
    //   socket.send(WS_DISCOVERY_PROBE, 3702, "239.255.255.250");
    // });
    // const devices = await collectResponses(socket, timeoutMs);
    // return devices.map(parseOnvifResponse);

    // Phase 3 stub — retourne des devices simulés pour le développement
    await new Promise((resolve) => setTimeout(resolve, Math.min(timeoutMs, 1000)));

    const stubDevices: DiscoveredDevice[] = [
      {
        name: "IPCamera_Demo_01",
        host: "192.168.1.101",
        port: 80,
        manufacturer: "Hikvision",
        model: "DS-2CD2143G2-I",
        serviceUrls: ["http://192.168.1.101/onvif/device_service"],
      },
      {
        name: "IPCamera_Demo_02",
        host: "192.168.1.102",
        port: 80,
        manufacturer: "Dahua",
        model: "IPC-HDW2831T-AS",
        serviceUrls: ["http://192.168.1.102/onvif/device_service"],
      },
    ];

    console.log(JSON.stringify({
      module: "OnvifDiscovery",
      action: "scan_complete",
      found: stubDevices.length,
      note: "stub Phase 3 — production uses WS-Discovery UDP",
      ts: new Date().toISOString(),
    }));

    return stubDevices;
  }
}
