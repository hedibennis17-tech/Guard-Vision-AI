/**
 * seed.ts — Initialisation des données Firestore pour Vision Guard AI
 * Projet : ai-guard-vision-8ef41
 *
 * Exécuter UNE SEULE FOIS après la création du projet Firebase :
 *   cd scripts && npm install && npx ts-node seed.ts
 *
 * Ce script crée :
 *   1. Les plans d'abonnement (catalogue global)
 *   2. Le catalogue des modules Marketplace
 *   3. Les règles Firestore (à déployer via Firebase CLI)
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore }        from "firebase-admin/firestore";

// ⚠️ Remplacer par le chemin vers votre Service Account JSON
// (Firebase Console → Project Settings → Service accounts → Generate new private key)
// NE JAMAIS commiter ce fichier — il doit rester local.
const serviceAccount = require("./service-account.json");

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ─── 1. Plans d'abonnement ───────────────────────────────────────────────────

const PLANS = [
  {
    id:              "free",
    name:            "Free",
    maxCameras:      1,
    maxSites:        1,
    maxUsers:        1,
    retentionDays:   3,
    priceMonthlyCad: 0,
    features:        ["1 caméra", "Alertes de base", "3 jours de rétention"],
    active:          true,
  },
  {
    id:              "home",
    name:            "Home",
    maxCameras:      5,
    maxSites:        1,
    maxUsers:        3,
    retentionDays:   14,
    priceMonthlyCad: 14.99,
    features:        ["5 caméras", "Détection IA", "14 jours de rétention", "Rapports PDF"],
    active:          true,
  },
  {
    id:              "pro",
    name:            "Pro",
    maxCameras:      10,
    maxSites:        3,
    maxUsers:        10,
    retentionDays:   30,
    priceMonthlyCad: 39.99,
    features:        ["10 caméras", "Multi-sites", "30 jours de rétention", "Analytics avancés"],
    active:          true,
  },
  {
    id:              "business",
    name:            "Business",
    maxCameras:      20,
    maxSites:        10,
    maxUsers:        25,
    retentionDays:   60,
    priceMonthlyCad: 89.99,
    features:        ["20 caméras", "Rôles & permissions", "60 jours de rétention", "API access"],
    active:          true,
  },
  {
    id:              "enterprise",
    name:            "Enterprise",
    maxCameras:      -1,
    maxSites:        -1,
    maxUsers:        -1,
    retentionDays:   365,
    priceMonthlyCad: null,
    features:        ["Caméras illimitées", "Modules Marketplace dédiés", "SLA", "Support prioritaire"],
    active:          true,
  },
];

// ─── 2. Modules Marketplace ──────────────────────────────────────────────────

const MARKETPLACE_MODULES = [
  {
    slug:           "home",
    name:           "Vision Guard Home",
    tagline:        "Surveillance résidentielle intelligente",
    description:    "Protégez votre maison 24h/7j.",
    icon:           "🏠",
    status:         "available",
    minimumPlan:    "free",
    detectionTypes: ["person","vehicle","animal","motion"],
    features:       ["Détection de mouvement","Alertes push/email","Rapports PDF"],
  },
  {
    slug:           "retail",
    name:           "Vision Guard Retail",
    tagline:        "Prévention des pertes",
    description:    "Protégez votre commerce contre le vol.",
    icon:           "🛒",
    status:         "beta",
    minimumPlan:    "pro",
    detectionTypes: ["person","shoplifting","empty_shelf"],
    features:       ["Détection de vol","Rayons vides","Comptage clients"],
  },
  {
    slug:           "industry",
    name:           "Vision Guard Industry",
    tagline:        "Sécurité industrielle et EPI",
    description:    "Sécurité des employés.",
    icon:           "🏭",
    status:         "coming_soon",
    minimumPlan:    "business",
    detectionTypes: ["ppe_violation","danger_zone","fire","smoke"],
    features:       ["Détection EPI","Zones dangereuses","Feu/fumée"],
  },
  {
    slug:           "construction",
    name:           "Vision Guard Construction",
    tagline:        "Chantiers sécurisés",
    description:    "Sécurité sur les chantiers.",
    icon:           "🏗️",
    status:         "coming_soon",
    minimumPlan:    "business",
    detectionTypes: ["ppe_violation","fall_detection","restricted_zone"],
    features:       ["Suivi engins","Détection chutes","Zones interdites"],
  },
  {
    slug:           "smart_city",
    name:           "Vision Guard Smart City",
    tagline:        "Intelligence urbaine",
    description:    "Gestion intelligente de la ville.",
    icon:           "🌆",
    status:         "coming_soon",
    minimumPlan:    "enterprise",
    detectionTypes: ["vehicle","person","traffic_violation"],
    features:       ["Comptage véhicules","Infractions","Flux piétons"],
  },
  {
    slug:           "agriculture",
    name:           "Vision Guard Agriculture",
    tagline:        "Exploitation agricole protégée",
    description:    "Surveillez vos troupeaux.",
    icon:           "🌾",
    status:         "coming_soon",
    minimumPlan:    "pro",
    detectionTypes: ["animal","person","fire"],
    features:       ["Troupeaux","Prédateurs","Périmètre"],
  },
  {
    slug:           "defense",
    name:           "Vision Guard Defense",
    tagline:        "Sécurité périmétrique critique",
    description:    "Infrastructures critiques.",
    icon:           "🛡️",
    status:         "coming_soon",
    minimumPlan:    "enterprise",
    detectionTypes: ["person","drone","weapon","intrusion"],
    features:       ["Périmètre avancé","Drones","On-premise"],
  },
];

// ─── Script principal ─────────────────────────────────────────────────────────

async function seed() {
  console.log("🌱 Démarrage du seed Firestore — ai-guard-vision-8ef41\n");

  const batch = db.batch();

  // Plans
  console.log("📋 Plans d'abonnement...");
  for (const plan of PLANS) {
    batch.set(db.collection("plans").doc(plan.id), {
      ...plan,
      createdAt: new Date().toISOString(),
    });
  }
  console.log(`   ✅ ${PLANS.length} plans créés`);

  // Modules Marketplace
  console.log("🧩 Modules Marketplace...");
  for (const mod of MARKETPLACE_MODULES) {
    batch.set(db.collection("marketplace_modules").doc(mod.slug), {
      ...mod,
      createdAt: new Date().toISOString(),
    });
  }
  console.log(`   ✅ ${MARKETPLACE_MODULES.length} modules créés`);

  await batch.commit();

  console.log("\n✅ Seed terminé avec succès !");
  console.log("\nProchaines étapes :");
  console.log("  1. Déployer les règles Firestore : firebase deploy --only firestore:rules");
  console.log("  2. Déployer les indexes Firestore : firebase deploy --only firestore:indexes");
  console.log("  3. Activer Firebase Authentication (Email/Password) dans la Console");
  console.log("  4. Activer Firebase Storage dans la Console");
  console.log("  5. Déployer les Cloud Functions : firebase deploy --only functions\n");
}

seed().catch((err) => {
  console.error("❌ Erreur seed :", err);
  process.exit(1);
});
