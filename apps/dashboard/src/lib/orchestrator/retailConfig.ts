/**
 * Vision Guard — Retail Intelligence AI
 * Configuration complète v1.0
 */

export const RETAIL_CONFIG = {
  module: {
    id:"retail", name:"Retail Intelligence AI", icon:"🛒", color:"#10B981",
    description:"AI-powered loss prevention, customer analytics & inventory monitoring",
    goal:"Reduce shrinkage, optimize customer flow and increase operational efficiency.",
  },

  // ── Détections personnes ────────────────────────────────────────────────────
  people: [
    { id:"customer",        label:"Client",              icon:"🛍️", severity:"info"     },
    { id:"staff",           label:"Employé",             icon:"👔", severity:"info"     },
    { id:"security",        label:"Agent de sécurité",   icon:"💂", severity:"info"     },
    { id:"suspicious",      label:"Individu suspect",    icon:"👤", severity:"warning"  },
    { id:"shoplifter",      label:"Vol en cours",        icon:"🚨", severity:"critical" },
    { id:"child_alone",     label:"Enfant seul",         icon:"👶", severity:"warning"  },
    { id:"crowd",           label:"Attroupement",        icon:"👥", severity:"info"     },
  ],

  // ── Comportements suspects ──────────────────────────────────────────────────
  suspicious_behaviors: [
    { id:"concealment",       label:"Dissimulation d'article",       icon:"🙈", severity:"critical" },
    { id:"tag_removal",       label:"Retrait d'étiquette",           icon:"🏷️", severity:"critical" },
    { id:"bag_stuffing",      label:"Remplissage sac",               icon:"🎒", severity:"critical" },
    { id:"fitting_room",      label:"Articles en cabine > limite",   icon:"👗", severity:"warning"  },
    { id:"loitering",         label:"Flânerie excessive (>15 min)",  icon:"⏱️", severity:"warning"  },
    { id:"staff_distraction", label:"Distraction du personnel",      icon:"😵", severity:"warning"  },
    { id:"team_theft",        label:"Vol en équipe coordonné",       icon:"👥", severity:"critical" },
    { id:"skip_checkout",     label:"Passage sans payer",            icon:"🚪", severity:"critical" },
    { id:"receipt_check",     label:"Refus contrôle ticket",         icon:"🧾", severity:"warning"  },
    { id:"grab_and_run",      label:"Grab & Run",                    icon:"🏃", severity:"critical" },
    { id:"price_tag_swap",    label:"Échange d'étiquettes prix",     icon:"💰", severity:"critical" },
  ],

  // ── Produits & Rayons ───────────────────────────────────────────────────────
  shelf_analytics: [
    { id:"empty_shelf",       label:"Rayon vide",                icon:"📦", severity:"warning",  auto_alert:true  },
    { id:"low_stock",         label:"Stock bas (< 20%)",         icon:"📉", severity:"info",     auto_alert:true  },
    { id:"misplaced_product", label:"Produit mal placé",         icon:"❓", severity:"info",     auto_alert:false },
    { id:"spill",             label:"Déversement rayon",         icon:"💧", severity:"warning",  auto_alert:true  },
    { id:"fallen_product",    label:"Produit tombé",             icon:"⬇️", severity:"info",     auto_alert:false },
    { id:"price_missing",     label:"Étiquette prix manquante",  icon:"🏷️", severity:"info",     auto_alert:false },
    { id:"expired_product",   label:"Produit périmé visible",    icon:"⏰", severity:"warning",  auto_alert:true  },
    { id:"planogram_violation",label:"Non-conformité planogramme",icon:"📋", severity:"info",    auto_alert:false },
  ],

  // ── Analytics clients ───────────────────────────────────────────────────────
  customer_analytics: [
    { id:"footfall",          label:"Comptage clients (entrée/sortie)",icon:"👥", unit:"pers/h" },
    { id:"dwell_time",        label:"Temps moyen par zone",            icon:"⏱️", unit:"min"    },
    { id:"queue_length",      label:"Longueur file d'attente",         icon:"👥", unit:"pers"   },
    { id:"queue_wait",        label:"Temps d'attente caisse",          icon:"⏳", unit:"min"    },
    { id:"heatmap",           label:"Heatmap de fréquentation",        icon:"🗺️", unit:""       },
    { id:"path_analysis",     label:"Analyse du parcours client",      icon:"🛣️", unit:""       },
    { id:"gender_age",        label:"Démographie (âge/genre)",         icon:"📊", unit:""       },
    { id:"repeat_visitors",   label:"Clients fidèles vs nouveaux",     icon:"🔄", unit:"%"      },
    { id:"conversion_rate",   label:"Taux de conversion",              icon:"💰", unit:"%"      },
    { id:"basket_size",       label:"Taille du panier moyen",          icon:"🧺", unit:"articles"},
    { id:"peak_hours",        label:"Heures de pointe",                icon:"📈", unit:""       },
  ],

  // ── Surveillance caisses ────────────────────────────────────────────────────
  checkout_monitoring: [
    { id:"cashier_present",   label:"Caissier présent",              icon:"💁", severity:"info"     },
    { id:"cashier_absent",    label:"Caissier absent",               icon:"❌", severity:"warning"  },
    { id:"self_checkout",     label:"Libre-service sans scan",       icon:"🔍", severity:"critical" },
    { id:"customer_skip",     label:"Client passe sans payer",       icon:"🚪", severity:"critical" },
    { id:"refund_fraud",      label:"Fraude au remboursement",       icon:"💸", severity:"critical" },
    { id:"open_register",     label:"Caisse ouverte sans caissier",  icon:"💰", severity:"warning"  },
  ],

  // ── Opérations ──────────────────────────────────────────────────────────────
  operations: [
    { id:"cleaning_compliance",label:"Conformité nettoyage",         icon:"🧹", type:"ops" },
    { id:"safety_compliance",  label:"Conformité sécurité",          icon:"⛑️", type:"ops" },
    { id:"uniform_check",      label:"Uniforme employé",             icon:"👔", type:"ops" },
    { id:"stockroom_access",   label:"Accès réserve non autorisé",   icon:"🚪", type:"security" },
    { id:"delivery_received",  label:"Réception livraison",          icon:"📦", type:"ops" },
    { id:"age_verification",   label:"Vérification âge (alcool)",    icon:"🔞", type:"compliance" },
  ],

  // ── Analytics & Rapports ────────────────────────────────────────────────────
  reports: [
    { id:"loss_prevention",    label:"Rapport prévention des pertes", icon:"🚨", freq:"daily"  },
    { id:"customer_flow",      label:"Rapport flux clients",          icon:"👥", freq:"daily"  },
    { id:"shelf_availability", label:"Rapport disponibilité rayons",  icon:"📦", freq:"daily"  },
    { id:"shrinkage_report",   label:"Rapport de démarque",          icon:"📉", freq:"weekly" },
    { id:"cashier_performance",label:"Performance caissiers",         icon:"💼", freq:"weekly" },
    { id:"incident_report",    label:"Rapport d'incidents",           icon:"📋", freq:"on_event"},
    { id:"roi_analysis",       label:"Analyse ROI sécurité",         icon:"💰", freq:"monthly"},
  ],
};
