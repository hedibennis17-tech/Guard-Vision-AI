import type { ICameraConnector, ConnectorType, ConnectorCredentials, ConnectionTestResult, DiscoveredDevice } from "../types";
import { RtspConnector } from "../connectors/RtspConnector";
import { OnvifConnector } from "../connectors/OnvifConnector";
import { HikvisionConnector } from "../connectors/HikvisionConnector";
import { DahuaConnector } from "../connectors/DahuaConnector";
import { AxisConnector } from "../connectors/AxisConnector";
import { ReolinkConnector } from "../connectors/ReolinkConnector";
import { RingConnector } from "../connectors/RingConnector";
import { NestConnector } from "../connectors/NestConnector";
import { OnvifDiscovery } from "../discovery/OnvifDiscovery";

/**
 * ConnectorEngine — point d'entrée UNIQUE pour tout ce qui concerne les caméras.
 *
 * Les Cloud Functions (addCamera, connectCamera) et le Live Stream Manager (Phase 4)
 * passent UNIQUEMENT par cet engine. Ils ne connaissent jamais les connecteurs
 * individuels directement.
 *
 * Le moteur YOLO (Phase 5) ne connaît pas cet engine non plus —
 * il reçoit uniquement un streamUrl normalisé (RTSP/HLS).
 */
export class ConnectorEngine {
  private readonly registry: Map<ConnectorType, ICameraConnector>;
  private readonly discovery: OnvifDiscovery;

  constructor(options: { ringCallbackUrl?: string; nestProjectId?: string } = {}) {
    this.discovery = new OnvifDiscovery();
    this.registry = new Map<ConnectorType, ICameraConnector>([
      ["rtsp",       new RtspConnector()],
      ["generic_ip", new RtspConnector()],
      ["onvif",      new OnvifConnector()],
      ["hikvision",  new HikvisionConnector()],
      ["dahua",      new DahuaConnector()],
      ["axis",       new AxisConnector()],
      ["reolink",    new ReolinkConnector()],
      ["ring",       new RingConnector({ callbackBaseUrl: options.ringCallbackUrl })],
      ["nest",       new NestConnector({ callbackBaseUrl: options.ringCallbackUrl, projectId: options.nestProjectId })],
    ]);
  }

  private getConnector(type: ConnectorType): ICameraConnector {
    const connector = this.registry.get(type);
    if (!connector) throw new Error(`Connecteur non supporté : ${type}`);
    return connector;
  }

  /**
   * Teste la connexion à une caméra et retourne le résultat + l'URL de stream.
   * Appelé depuis la page "Ajouter une caméra" avant de sauvegarder dans Firestore.
   */
  async testConnection(type: ConnectorType, credentials: ConnectorCredentials): Promise<ConnectionTestResult> {
    const connector = this.getConnector(type);
    return connector.testConnection(credentials);
  }

  /**
   * Retourne l'URL de stream normalisée (RTSP ou WebRTC selon le connecteur).
   * C'est cette URL que le Live Stream Manager et YOLO consomment.
   */
  async getStreamUrl(type: ConnectorType, credentials: ConnectorCredentials): Promise<string> {
    return this.getConnector(type).getStreamUrl(credentials);
  }

  /** Retourne l'URL de snapshot statique si disponible. */
  async getSnapshotUrl(type: ConnectorType, credentials: ConnectorCredentials): Promise<string | null> {
    return this.getConnector(type).getSnapshotUrl(credentials);
  }

  /**
   * Retourne l'URL OAuth2 pour les connecteurs qui en ont besoin (Ring, Nest).
   * Le Dashboard redirige l'utilisateur vers cette URL.
   */
  getOAuthUrl(type: ConnectorType, organizationId: string, cameraId: string): string {
    const connector = this.getConnector(type);
    if (!connector.requiresOAuth || !connector.getOAuthUrl) {
      throw new Error(`Le connecteur ${type} ne supporte pas OAuth.`);
    }
    return connector.getOAuthUrl(organizationId, cameraId);
  }

  /** Retourne true si le connecteur nécessite un flow OAuth (Ring, Nest). */
  requiresOAuth(type: ConnectorType): boolean {
    return this.getConnector(type).requiresOAuth ?? false;
  }

  /**
   * Scan réseau ONVIF — découverte automatique des caméras sur le LAN.
   * Utilisé par la page "Ajouter une caméra" (bouton "Recherche automatique").
   */
  async discoverOnvif(options: { timeoutMs?: number } = {}): Promise<DiscoveredDevice[]> {
    return this.discovery.scan(options);
  }

  /** Liste tous les types de connecteurs supportés. */
  getSupportedConnectors(): ConnectorType[] {
    return Array.from(this.registry.keys());
  }
}

// Singleton exporté pour utilisation dans les Cloud Functions
export const connectorEngine = new ConnectorEngine({
  ringCallbackUrl: process.env.VISIONGUARD_CALLBACK_URL,
  nestProjectId: process.env.GOOGLE_SDM_PROJECT_ID,
});
