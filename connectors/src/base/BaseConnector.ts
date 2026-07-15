import type {
  ConnectorCredentials,
  ConnectionTestResult,
  DeviceInfo,
  ICameraConnector,
  ConnectorType,
} from "../types";

/**
 * BaseConnector — classe abstraite dont héritent tous les connecteurs.
 * Fournit la logique commune : retry, timeout, logging.
 */
export abstract class BaseConnector implements ICameraConnector {
  abstract readonly type: ConnectorType;

  protected readonly timeoutMs: number;
  protected readonly maxRetries: number;

  constructor(options: { timeoutMs?: number; maxRetries?: number } = {}) {
    this.timeoutMs = options.timeoutMs ?? 8000;
    this.maxRetries = options.maxRetries ?? 2;
  }

  abstract testConnection(credentials: ConnectorCredentials): Promise<ConnectionTestResult>;
  abstract getStreamUrl(credentials: ConnectorCredentials): Promise<string>;
  abstract getSnapshotUrl(credentials: ConnectorCredentials): Promise<string | null>;
  abstract getDeviceInfo(credentials: ConnectorCredentials): Promise<DeviceInfo | null>;

  /** Utilitaire : wrapper avec timeout */
  protected withTimeout<T>(promise: Promise<T>, ms: number = this.timeoutMs): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout après ${ms}ms`)), ms)
      ),
    ]);
  }

  /** Utilitaire : log préfixé par le type de connecteur */
  protected log(level: "info" | "warn" | "error", message: string, meta?: object) {
    const entry = { connector: this.type, level, message, ...meta, ts: new Date().toISOString() };
    if (level === "error") console.error(JSON.stringify(entry));
    else console.log(JSON.stringify(entry));
  }

  /** Erreur formatée en ConnectionTestResult */
  protected failResult(errorCode: string, errorMessage: string): ConnectionTestResult {
    return { success: false, errorCode, errorMessage };
  }
}
