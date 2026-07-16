/**
 * Vision Guard — Event Engine Rules (Phase 6)
 * Source unique de vérité pour la sévérité et l'agrégation.
 * Utilisée par : Cloud Functions (JS) + Python EventAggregator.
 */

export type DetectionType =
  | "person" | "car" | "motorcycle" | "bus" | "truck"
  | "dog" | "cat" | "bird"
  | "fire" | "smoke" | "license_plate" | "ppe_violation";

export type EventSeverity = "info" | "warning" | "critical";

/** Sévérité par type de détection (peut être surchargée par module Marketplace) */
export const DETECTION_SEVERITY: Record<DetectionType, EventSeverity> = {
  fire:          "critical",
  smoke:         "critical",
  ppe_violation: "critical",
  person:        "warning",
  motorcycle:    "warning",
  license_plate: "info",
  car:           "info",
  bus:           "info",
  truck:         "info",
  dog:           "info",
  cat:           "info",
  bird:          "info",
};

/**
 * Fenêtre d'agrégation : si N détections du même type
 * arrivent sur la même caméra dans AGGREGATION_WINDOW_SEC secondes,
 * elles forment un seul Event (pas N Events).
 */
export const AGGREGATION_WINDOW_SEC = 30;

/**
 * Seuil de détections avant escalade de sévérité.
 * Ex : 1 "person" → warning. 5 "person" en 30s → critical (intrusion probable).
 */
export const ESCALATION_THRESHOLDS: Partial<Record<DetectionType, number>> = {
  person: 5,
  car:    3,
};

/** Calcule la sévérité finale d'un événement en tenant compte du nombre de détections. */
export function computeEventSeverity(
  type: DetectionType,
  detectionCount: number
): EventSeverity {
  const base = DETECTION_SEVERITY[type] ?? "info";
  const escalateAt = ESCALATION_THRESHOLDS[type];

  if (base === "critical") return "critical";
  if (escalateAt && detectionCount >= escalateAt) return "critical";
  return base;
}
