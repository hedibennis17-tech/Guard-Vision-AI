export type MarketplaceModuleSlug =
  | "home"
  | "retail"
  | "construction"
  | "industry"
  | "smart_city"
  | "agriculture"
  | "defense";

/**
 * MarketplaceModule — catalogue global des modules IA disponibles.
 * Le moteur (YOLO) reste identique ; seul le jeu de classes de détection
 * et les dashboards spécifiques changent selon le module.
 *
 * Collection Firestore: `marketplace_modules/{slug}` (catalogue global, pas par organisation)
 */
export interface MarketplaceModuleDoc {
  slug: MarketplaceModuleSlug;
  name: string;
  description: string;
  detectionTypes: string[];
  status: "available" | "beta" | "coming_soon";
  minimumPlan: import("./subscription").PlanId;
}

/**
 * OrganizationModule — active un module pour une organisation donnée.
 * Collection Firestore: `organizations/{organizationId}/modules/{slug}`
 */
export interface OrganizationModuleDoc {
  slug: MarketplaceModuleSlug;
  organizationId: string;
  enabled: boolean;
  enabledAt?: string;
  enabledBy?: string;
}
