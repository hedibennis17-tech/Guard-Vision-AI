/**
 * Vision Guard — Analytics Types (Phase 9)
 * Stockés dans Firestore : organizations/{orgId}/analytics/{date}
 */

export interface DailyAnalyticsDoc {
  id:             string;   // format: "YYYY-MM-DD"
  organizationId: string;
  date:           string;   // ISO date

  // Totaux du jour
  totalDetections:  number;
  totalEvents:      number;
  criticalEvents:   number;
  warningEvents:    number;
  onlineCameras:    number;

  // Détections par type (ex: { person: 87, car: 31, fire: 3 })
  byType:       Record<string, number>;

  // Détections par heure (index 0-23)
  byHour:       number[];

  // Détections par caméra
  byCamera:     Record<string, number>;

  // Heatmap : matrice [jour 0-6][heure 0-23] → count (pour la vue hebdo)
  heatmapWeek?: number[][];

  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsTrend {
  date:       string;
  detections: number;
  events:     number;
  critical:   number;
}

export interface HeatmapCell {
  day:   number;   // 0=Lundi … 6=Dimanche
  hour:  number;   // 0-23
  value: number;   // nombre de détections
}
