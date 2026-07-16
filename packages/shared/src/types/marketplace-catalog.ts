/**
 * Vision Guard Marketplace — Catalogue des modules (Phase 10)
 * Source unique de vérité pour le dashboard, user-app et Cloud Functions.
 */

export interface MarketplaceModule {
  slug:        string;
  name:        string;
  tagline:     string;
  description: string;
  icon:        string;
  status:      "available" | "beta" | "coming_soon";
  minimumPlan: "free" | "home" | "pro" | "business" | "enterprise";
  detectionTypes: string[];
  features:    string[];
  useCases:    string[];
  price?:      string; // null = inclus dans le plan
}

export const MARKETPLACE_MODULES: MarketplaceModule[] = [
  {
    slug: "home",
    name: "Vision Guard Home",
    tagline: "Surveillance résidentielle intelligente",
    description: "Protégez votre maison 24h/7j avec détection de mouvement, reconnaissance de personnes et alertes instantanées.",
    icon: "🏠",
    status: "available",
    minimumPlan: "free",
    detectionTypes: ["person","vehicle","animal","motion"],
    features: ["Détection de mouvement", "Reconnaissance de personnes", "Alertes push/email", "Historique 14 jours", "Rapports PDF"],
    useCases: ["Maison individuelle","Appartement","Chalet de vacances"],
  },
  {
    slug: "retail",
    name: "Vision Guard Retail",
    tagline: "Prévention des pertes et analyse des rayons",
    description: "Protégez votre commerce contre le vol, analysez le comportement client et optimisez l'agencement de vos rayons.",
    icon: "🛒",
    status: "beta",
    minimumPlan: "pro",
    detectionTypes: ["person","shoplifting","empty_shelf","queue","product"],
    features: [
      "Détection de vol en temps réel", "Analyse des rayons vides",
      "Comptage des clients", "Analyse des files d'attente",
      "Carte thermique des zones fréquentées", "Intégration caisse libre-service",
    ],
    useCases: ["Supermarché","Boutique","Grande surface","Pharmacie"],
    price: "+29$/mois",
  },
  {
    slug: "industry",
    name: "Vision Guard Industry",
    tagline: "Sécurité industrielle et EPI",
    description: "Garantissez la sécurité de vos employés avec la détection des EPI, zones dangereuses et comptage des travailleurs.",
    icon: "🏭",
    status: "coming_soon",
    minimumPlan: "business",
    detectionTypes: ["ppe_violation","danger_zone","worker_count","fire","smoke"],
    features: [
      "Détection EPI (casque, gilet, lunettes)", "Surveillance zones dangereuses",
      "Comptage des travailleurs", "Détection feu/fumée", "Alertes conformité sécurité",
    ],
    useCases: ["Usine","Entrepôt industriel","Mine","Raffinerie"],
    price: "+49$/mois",
  },
  {
    slug: "construction",
    name: "Vision Guard Construction",
    tagline: "Chantiers sécurisés et conformes",
    description: "Suivez les engins, détectez les chutes et contrôlez l'accès aux zones interdites sur vos chantiers.",
    icon: "🏗️",
    status: "coming_soon",
    minimumPlan: "business",
    detectionTypes: ["ppe_violation","fall_detection","machinery","restricted_zone","person"],
    features: [
      "Suivi des engins de chantier", "Détection de chutes",
      "Contrôle des zones interdites", "EPI obligatoire",
      "Rapports de conformité", "Historique 90 jours",
    ],
    useCases: ["Chantier BTP","Démolition","Travaux publics"],
    price: "+49$/mois",
  },
  {
    slug: "smart_city",
    name: "Vision Guard Smart City",
    tagline: "Intelligence urbaine en temps réel",
    description: "Optimisez la fluidité du trafic, gérez le stationnement et analysez les flux piétons à l'échelle de la ville.",
    icon: "🌆",
    status: "coming_soon",
    minimumPlan: "enterprise",
    detectionTypes: ["vehicle","person","traffic_violation","parking","pedestrian_count"],
    features: [
      "Comptage et classification des véhicules", "Détection d'infractions routières",
      "Gestion du stationnement", "Analyse des flux piétons",
      "Gestion des feux de circulation", "Tableaux de bord municipaux",
    ],
    useCases: ["Municipalité","Autoroute","Aéroport","Stade"],
    price: "Sur devis",
  },
  {
    slug: "agriculture",
    name: "Vision Guard Agriculture",
    tagline: "Surveillance des exploitations agricoles",
    description: "Surveillez vos troupeaux, détectez les intrusions et protégez vos cultures 24h/7j.",
    icon: "🌾",
    status: "coming_soon",
    minimumPlan: "pro",
    detectionTypes: ["animal","person","vehicle","fire"],
    features: [
      "Surveillance des troupeaux", "Détection des prédateurs",
      "Contrôle périmétrique", "Détection d'incendie",
      "Alertes intrusion nocturne",
    ],
    useCases: ["Ferme","Ranch","Vignoble","Serre"],
    price: "+19$/mois",
  },
  {
    slug: "defense",
    name: "Vision Guard Defense",
    tagline: "Sécurité périmétrique critique",
    description: "Solution de surveillance haute sécurité pour les infrastructures critiques et installations militaires.",
    icon: "🛡️",
    status: "coming_soon",
    minimumPlan: "enterprise",
    detectionTypes: ["person","vehicle","drone","weapon","intrusion"],
    features: [
      "Détection périmétrique avancée", "Analyse comportementale",
      "Intégration multi-capteurs", "Cryptage de bout en bout",
      "Déploiement on-premise", "Support 24/7 dédié",
    ],
    useCases: ["Base militaire","Ambassade","Infrastructure critique","Prison"],
    price: "Sur devis",
  },
];

export const STATUS_LABELS: Record<string, string> = {
  available:    "Disponible",
  beta:         "Bêta",
  coming_soon:  "Bientôt",
};
