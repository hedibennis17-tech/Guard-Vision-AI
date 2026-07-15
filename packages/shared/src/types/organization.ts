/**
 * Organization — racine de toute la hiérarchie multi-tenant.
 * Organisation → Users, Sites, Cameras, Events, Subscription, Reports
 *
 * Collection Firestore: `organizations/{organizationId}`
 */
export interface OrganizationDoc {
  id: string;
  name: string;
  slug: string; // utilisé dans les URLs, ex: /org/acme-corp
  ownerId: string; // uid de l'utilisateur propriétaire

  /** Secteur d'activité — conditionne les modules Marketplace visibles */
  vertical: "home" | "retail" | "industry" | "construction" | "smart_city" | "agriculture" | "defense";

  subscriptionId: string; // référence vers subscriptions/{id}

  timezone: string; // ex: "America/Toronto"
  country?: string;

  billingEmail?: string;

  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

/**
 * Site — un emplacement physique appartenant à une organisation
 * (ex: "Magasin Montréal Centre-Ville", "Entrepôt A").
 * Une organisation peut avoir plusieurs sites, chaque site plusieurs caméras.
 *
 * Collection Firestore: `organizations/{organizationId}/sites/{siteId}`
 */
export interface SiteDoc {
  id: string;
  organizationId: string;
  name: string;
  address?: string;
  timezone: string;
  geo?: { lat: number; lng: number };
  createdAt: string;
}
