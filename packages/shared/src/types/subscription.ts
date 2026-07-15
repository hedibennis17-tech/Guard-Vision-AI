export type PlanId = "free" | "home" | "pro" | "business" | "enterprise";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  /** -1 = illimité */
  maxCameras: number;
  maxSites: number;
  maxUsers: number;
  /** Rétention des événements/vidéos en jours */
  retentionDays: number;
  priceMonthlyCad: number | null; // null = "sur devis" (Enterprise)
  features: string[];
}

/**
 * Catalogue des plans — source unique de vérité, utilisée à la fois par
 * le Dashboard (page Billing), l'app utilisateur, et les Cloud Functions
 * qui appliquent les limites (ex: refuser l'ajout d'une caméra au-delà du quota).
 */
export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    maxCameras: 1,
    maxSites: 1,
    maxUsers: 1,
    retentionDays: 3,
    priceMonthlyCad: 0,
    features: ["1 caméra", "Alertes de base", "3 jours de rétention"],
  },
  home: {
    id: "home",
    name: "Home",
    maxCameras: 5,
    maxSites: 1,
    maxUsers: 3,
    retentionDays: 14,
    priceMonthlyCad: 14.99,
    features: ["5 caméras", "Détection IA", "14 jours de rétention", "Rapports PDF"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    maxCameras: 10,
    maxSites: 3,
    maxUsers: 10,
    retentionDays: 30,
    priceMonthlyCad: 39.99,
    features: ["10 caméras", "Multi-sites", "30 jours de rétention", "Analytics avancés"],
  },
  business: {
    id: "business",
    name: "Business",
    maxCameras: 20,
    maxSites: 10,
    maxUsers: 25,
    retentionDays: 60,
    priceMonthlyCad: 89.99,
    features: ["20+ caméras", "Rôles & permissions", "60 jours de rétention", "API access"],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    maxCameras: -1,
    maxSites: -1,
    maxUsers: -1,
    retentionDays: 365,
    priceMonthlyCad: null,
    features: ["Caméras illimitées", "Modules Marketplace dédiés", "SLA", "Support prioritaire"],
  },
};

/**
 * Subscription — état d'abonnement d'une organisation.
 * Collection Firestore: `subscriptions/{subscriptionId}` (1:1 avec organizationId)
 */
export interface SubscriptionDoc {
  id: string;
  organizationId: string;
  planId: PlanId;
  status: "trialing" | "active" | "past_due" | "canceled";

  /** Compteurs mis à jour par Cloud Function à chaque ajout/suppression (évite un count() coûteux) */
  currentCameraCount: number;
  currentSiteCount: number;
  currentUserCount: number;

  trialEndsAt?: string;
  currentPeriodEnd?: string;

  stripeCustomerId?: string;
  stripeSubscriptionId?: string;

  createdAt: string;
  updatedAt: string;
}

/** Utilitaire partagé Dashboard/User-app/Functions pour vérifier un quota avant action. */
export function canAddCamera(sub: Pick<SubscriptionDoc, "planId" | "currentCameraCount">): boolean {
  const plan = PLANS[sub.planId];
  if (plan.maxCameras === -1) return true;
  return sub.currentCameraCount < plan.maxCameras;
}

export function canAddSite(sub: Pick<SubscriptionDoc, "planId" | "currentSiteCount">): boolean {
  const plan = PLANS[sub.planId];
  if (plan.maxSites === -1) return true;
  return sub.currentSiteCount < plan.maxSites;
}

export function canAddUser(sub: Pick<SubscriptionDoc, "planId" | "currentUserCount">): boolean {
  const plan = PLANS[sub.planId];
  if (plan.maxUsers === -1) return true;
  return sub.currentUserCount < plan.maxUsers;
}
