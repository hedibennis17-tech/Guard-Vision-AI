/**
 * Vision Guard — Notification Preferences (Phase 7)
 *
 * Stockées dans Firestore :
 *   organizations/{orgId}/notification_preferences/{userId}
 *
 * Chaque utilisateur configure :
 *   - Quels canaux activer (push, email, SMS)
 *   - Quel niveau de sévérité minimum déclenche une notification
 *   - Quels types de détections l'intéressent
 *   - Plages horaires silencieuses (Do Not Disturb)
 */

import type { EventSeverity } from "./event-rules";
import type { DetectionType }  from "./event-rules";

export interface NotificationPreferencesDoc {
  userId:         string;
  organizationId: string;

  channels: {
    push:  boolean;
    email: boolean;
    sms:   boolean;   // Phase 7.2
  };

  /** Sévérité minimale pour déclencher une notification */
  minSeverity: EventSeverity;

  /** Types de détection qui déclenchent une notification (vide = tous) */
  watchedTypes: DetectionType[];

  /** Plages horaires silencieuses (heure locale, format 24h) */
  doNotDisturb?: {
    enabled: boolean;
    startHour: number;  // 0-23
    endHour:   number;
  };

  /** Email de destination (peut différer de l'email de compte) */
  emailAddress?: string;

  /** Token FCM enregistré pour cet appareil */
  fcmTokens: string[];

  updatedAt: string;
}

/** Préférences par défaut pour un nouvel utilisateur */
export const DEFAULT_NOTIFICATION_PREFERENCES: Omit<
  NotificationPreferencesDoc,
  "userId" | "organizationId" | "updatedAt"
> = {
  channels:     { push: true, email: true, sms: false },
  minSeverity:  "warning",
  watchedTypes: [],
  doNotDisturb: { enabled: false, startHour: 22, endHour: 7 },
  fcmTokens:    [],
};
