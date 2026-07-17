/**
 * Vision Guard — Construction Safety AI
 * Configuration complète v1.0
 * "Prevent workplace accidents using real-time AI vision."
 */

export const CONSTRUCTION_SAFETY_CONFIG = {
  module: {
    id:          "construction_safety",
    name:        "Construction Safety AI",
    version:     "1.0",
    status:      "Beta",
    description: "AI Safety Monitoring for Construction Sites",
    goal:        "Prevent workplace accidents using real-time AI vision.",
    icon:        "🏗️",
    color:       "#F59E0B",
  },

  // ── Personnes ───────────────────────────────────────────────────────────────
  workers: [
    { id:"construction_worker", label:"Travailleur", icon:"👷", severity:"info" },
    { id:"supervisor",          label:"Superviseur", icon:"👔", severity:"info" },
    { id:"visitor",             label:"Visiteur",    icon:"🚶", severity:"warning" },
    { id:"subcontractor",       label:"Sous-traitant",icon:"🔧",severity:"info" },
    { id:"security_guard",      label:"Agent de sécurité",icon:"💂",severity:"info" },
    { id:"surveyor",            label:"Géomètre",    icon:"📐", severity:"info" },
  ],

  // ── EPI / PPE Detection ─────────────────────────────────────────────────────
  ppe: [
    { id:"helmet",               label:"Casque de protection",       icon:"⛑️",  required:true,  critical:true  },
    { id:"hard_hat_color",       label:"Couleur casque (rôle)",      icon:"🎨",  required:false, critical:false },
    { id:"safety_vest",          label:"Gilet de sécurité",          icon:"🦺",  required:true,  critical:true  },
    { id:"reflective_jacket",    label:"Veste réfléchissante",       icon:"🔆",  required:true,  critical:false },
    { id:"safety_glasses",       label:"Lunettes de sécurité",       icon:"🥽",  required:true,  critical:false },
    { id:"face_shield",          label:"Écran facial",               icon:"🛡️",  required:false, critical:false },
    { id:"dust_mask",            label:"Masque anti-poussière",      icon:"😷",  required:false, critical:false },
    { id:"respirator",           label:"Respirateur",                icon:"🫁",  required:false, critical:false },
    { id:"hearing_protection",   label:"Protection auditive",        icon:"🎧",  required:false, critical:false },
    { id:"ear_muffs",            label:"Cache-oreilles",             icon:"🎧",  required:false, critical:false },
    { id:"ear_plugs",            label:"Bouchons d'oreilles",        icon:"🔇",  required:false, critical:false },
    { id:"work_gloves",          label:"Gants de travail",           icon:"🧤",  required:true,  critical:false },
    { id:"cut_resistant_gloves", label:"Gants anti-coupure",         icon:"🧤",  required:false, critical:false },
    { id:"safety_boots",         label:"Bottes de sécurité",         icon:"👢",  required:true,  critical:false },
    { id:"steel_toe_boots",      label:"Bottes à embout acier",      icon:"👢",  required:true,  critical:false },
    { id:"long_sleeve",          label:"Uniforme manches longues",   icon:"👕",  required:false, critical:false },
    { id:"high_visibility",      label:"Vêtement haute visibilité",  icon:"🦺",  required:true,  critical:true  },
    { id:"fall_harness",         label:"Harnais antichute",          icon:"🪝",  required:false, critical:true  },
    { id:"lifeline",             label:"Ligne de vie connectée",     icon:"🔗",  required:false, critical:true  },
    { id:"knee_pads",            label:"Genouillères",               icon:"🦵",  required:false, critical:false },
  ],

  // ── Outils ─────────────────────────────────────────────────────────────────
  tools: [
    { id:"hammer",         label:"Marteau",          icon:"🔨", risk:"low"    },
    { id:"drill",          label:"Perceuse",         icon:"🔧", risk:"medium" },
    { id:"circular_saw",   label:"Scie circulaire",  icon:"⚙️", risk:"high"   },
    { id:"chainsaw",       label:"Tronçonneuse",     icon:"⛓️", risk:"high"   },
    { id:"grinder",        label:"Meuleuse",         icon:"⚙️", risk:"high"   },
    { id:"jackhammer",     label:"Marteau-piqueur",  icon:"⚒️", risk:"medium" },
    { id:"impact_driver",  label:"Visseuse à choc",  icon:"🔩", risk:"low"    },
    { id:"screwdriver",    label:"Tournevis",        icon:"🪛", risk:"low"    },
    { id:"wrench",         label:"Clé",              icon:"🔧", risk:"low"    },
    { id:"pipe_wrench",    label:"Clé à tuyau",      icon:"🔧", risk:"low"    },
    { id:"pliers",         label:"Pinces",           icon:"🔧", risk:"low"    },
    { id:"utility_knife",  label:"Couteau utilitaire",icon:"🔪",risk:"medium" },
    { id:"measuring_tape", label:"Ruban à mesurer",  icon:"📏", risk:"low"    },
    { id:"laser_level",    label:"Niveau laser",     icon:"🔦", risk:"low"    },
    { id:"shovel",         label:"Pelle",            icon:"⛏️", risk:"low"    },
    { id:"pickaxe",        label:"Pic",              icon:"⛏️", risk:"medium" },
    { id:"wheelbarrow",    label:"Brouette",         icon:"🛒", risk:"low"    },
    { id:"ladder",         label:"Échelle",          icon:"🪜", risk:"high"   },
    { id:"scaffold",       label:"Échafaudage",      icon:"🏗️", risk:"high"   },
  ],

  // ── Engins lourds ───────────────────────────────────────────────────────────
  heavy_equipment: [
    { id:"excavator",       label:"Excavatrice",       icon:"🏗️", alert_radius_m:5  },
    { id:"bulldozer",       label:"Bulldozer",         icon:"🚜", alert_radius_m:4  },
    { id:"crane",           label:"Grue",              icon:"🏗️", alert_radius_m:10 },
    { id:"tower_crane",     label:"Grue à tour",       icon:"🏗️", alert_radius_m:15 },
    { id:"forklift",        label:"Chariot élévateur", icon:"🏭", alert_radius_m:3  },
    { id:"loader",          label:"Chargeuse",         icon:"🚜", alert_radius_m:4  },
    { id:"dump_truck",      label:"Camion benne",      icon:"🚛", alert_radius_m:5  },
    { id:"concrete_mixer",  label:"Bétonnière",        icon:"🔄", alert_radius_m:3  },
    { id:"compactor",       label:"Compacteur",        icon:"🚜", alert_radius_m:3  },
    { id:"road_roller",     label:"Rouleau compresseur",icon:"🛞",alert_radius_m:4  },
    { id:"skid_steer",      label:"Mini-chargeuse",    icon:"🚜", alert_radius_m:2  },
    { id:"telehandler",     label:"Télescopique",      icon:"🏗️", alert_radius_m:5  },
  ],

  // ── Véhicules ───────────────────────────────────────────────────────────────
  vehicles: [
    { id:"pickup",     label:"Pickup",    icon:"🚗" },
    { id:"truck",      label:"Camion",    icon:"🚛" },
    { id:"van",        label:"Fourgon",   icon:"🚐" },
    { id:"car",        label:"Voiture",   icon:"🚗" },
    { id:"motorcycle", label:"Moto",      icon:"🏍️" },
    { id:"bicycle",    label:"Vélo",      icon:"🚲" },
  ],

  // ── Matériaux ───────────────────────────────────────────────────────────────
  materials: [
    { id:"concrete_blocks",      label:"Blocs de béton",        icon:"🧱", hazard:false },
    { id:"wood",                 label:"Bois",                  icon:"🪵", hazard:false },
    { id:"steel_beams",          label:"Poutres acier",         icon:"⬛", hazard:false },
    { id:"pipes",                label:"Tuyaux",                icon:"🔴", hazard:false },
    { id:"rebar",                label:"Ferraillage / Rebar",   icon:"⚙️", hazard:true  },
    { id:"bricks",               label:"Briques",               icon:"🧱", hazard:false },
    { id:"drywall",              label:"Placoplatre",           icon:"📋", hazard:false },
    { id:"pallets",              label:"Palettes",              icon:"📦", hazard:false },
    { id:"cement_bags",          label:"Sacs de ciment",        icon:"👜", hazard:false },
    { id:"gas_cylinders",        label:"Bouteilles de gaz",     icon:"🔴", hazard:true  },
    { id:"chemical_containers",  label:"Conteneurs chimiques",  icon:"⚗️", hazard:true  },
  ],

  // ── Risques du site ──────────────────────────────────────────────────────────
  site_hazards: [
    { id:"open_hole",         label:"Trou ouvert",              icon:"⚠️", severity:"critical" },
    { id:"excavation",        label:"Excavation",               icon:"⚠️", severity:"warning"  },
    { id:"unprotected_edge",  label:"Bord non protégé",         icon:"🚫", severity:"critical" },
    { id:"unsafe_scaffold",   label:"Échafaudage non sécurisé", icon:"🏗️", severity:"critical" },
    { id:"falling_object",    label:"Objet en chute",           icon:"⬇️", severity:"critical" },
    { id:"loose_material",    label:"Matériau instable",        icon:"⚠️", severity:"warning"  },
    { id:"oil_spill",         label:"Déversement d'huile",      icon:"🛢️", severity:"warning"  },
    { id:"water_spill",       label:"Déversement d'eau",        icon:"💧", severity:"warning"  },
    { id:"electrical_cable",  label:"Câble électrique",         icon:"⚡", severity:"critical" },
    { id:"exposed_wire",      label:"Fil exposé",               icon:"⚡", severity:"critical" },
    { id:"fire",              label:"Feu",                      icon:"🔥", severity:"critical" },
    { id:"smoke",             label:"Fumée",                    icon:"💨", severity:"critical" },
    { id:"gas_leak",          label:"Fuite de gaz",             icon:"💨", severity:"critical" },
  ],

  // ── Comportements dangereux ──────────────────────────────────────────────────
  behavior_detection: [
    { id:"no_helmet",          label:"Travailleur sans casque",       icon:"🚫⛑️", severity:"critical" },
    { id:"no_vest",            label:"Sans gilet de sécurité",        icon:"🚫🦺", severity:"critical" },
    { id:"no_glasses",         label:"Sans lunettes de sécurité",     icon:"🚫🥽", severity:"warning"  },
    { id:"no_gloves",          label:"Sans gants",                    icon:"🚫🧤", severity:"warning"  },
    { id:"no_boots",           label:"Sans bottes de sécurité",       icon:"🚫👢", severity:"warning"  },
    { id:"no_harness",         label:"Sans harnais (travail en hauteur)",icon:"🚫🪝",severity:"critical"},
    { id:"restricted_area",    label:"Personne en zone interdite",    icon:"🚷",  severity:"critical" },
    { id:"worker_running",     label:"Travailleur qui court",         icon:"🏃",  severity:"warning"  },
    { id:"worker_on_phone",    label:"Travailleur au téléphone",      icon:"📵",  severity:"warning"  },
    { id:"unsafe_lifting",     label:"Levage non sécuritaire",        icon:"⚠️",  severity:"warning"  },
    { id:"worker_sleeping",    label:"Travailleur endormi",           icon:"😴",  severity:"warning"  },
    { id:"worker_smoking",     label:"Fumeur sur le chantier",        icon:"🚬",  severity:"warning"  },
    { id:"unauthorized_visitor",label:"Visiteur non autorisé",        icon:"🚷",  severity:"warning"  },
  ],

  // ── Détection de chute ───────────────────────────────────────────────────────
  fall_detection: [
    { id:"worker_fall",    label:"Chute de travailleur",      icon:"⬇️", severity:"critical" },
    { id:"fall_ladder",    label:"Chute d'une échelle",       icon:"🪜", severity:"critical" },
    { id:"fall_scaffold",  label:"Chute d'un échafaudage",    icon:"🏗️", severity:"critical" },
    { id:"fall_roof",      label:"Chute du toit",             icon:"🏠", severity:"critical" },
    { id:"slip",           label:"Glissade",                  icon:"⬇️", severity:"warning"  },
    { id:"trip",           label:"Trébuchement",              icon:"⬇️", severity:"warning"  },
  ],

  // ── Sécurité véhicules ───────────────────────────────────────────────────────
  vehicle_safety: [
    { id:"worker_near_excavator",  label:"Travailleur trop près d'une excavatrice", icon:"⚠️", severity:"critical" },
    { id:"worker_behind_truck",    label:"Travailleur derrière un camion",           icon:"🚛", severity:"critical" },
    { id:"collision_risk",         label:"Risque de collision véhicule",             icon:"💥", severity:"critical" },
    { id:"forklift_near_worker",   label:"Chariot élévateur près d'un travailleur", icon:"🏭", severity:"critical" },
    { id:"speed_violation",        label:"Excès de vitesse sur le chantier",         icon:"🚨", severity:"warning"  },
  ],

  // ── Surveillance des zones ───────────────────────────────────────────────────
  zone_monitoring: [
    { id:"danger_zone",        label:"Zone dangereuse",          icon:"⛔", color:"#EF4444" },
    { id:"no_entry",           label:"Zone interdite",           icon:"🚫", color:"#EF4444" },
    { id:"ppe_mandatory",      label:"Zone EPI obligatoire",     icon:"⛑️", color:"#F59E0B" },
    { id:"crane_zone",         label:"Zone opération grue",      icon:"🏗️", color:"#EF4444" },
    { id:"heavy_equip_zone",   label:"Zone engins lourds",       icon:"🚜", color:"#EF4444" },
    { id:"loading_area",       label:"Zone de chargement",       icon:"📦", color:"#F59E0B" },
    { id:"chemical_storage",   label:"Stockage produits chimiques",icon:"⚗️",color:"#EF4444" },
    { id:"emergency_exit",     label:"Sortie de secours",        icon:"🚪", color:"#10B981" },
  ],

  // ── Modules avancés ──────────────────────────────────────────────────────────
  advanced_modules: [
    {
      id:"scaffold_safety", name:"Scaffold Safety", icon:"🏗️", status:"coming_soon",
      detections:[
        "Échafaudage incomplet", "Garde-corps manquant", "Planches déplacées",
        "Personne sans harnais sur échafaudage",
      ],
    },
    {
      id:"crane_safety", name:"Crane Safety", icon:"🏗️", status:"coming_soon",
      detections:[
        "Crochet sans charge", "Crochet en surcharge", "Charge oscillante",
        "Personne sous charge suspendue", "Collision potentielle entre grues",
      ],
    },
    {
      id:"electrical_safety", name:"Electrical Safety", icon:"⚡", status:"coming_soon",
      detections:[
        "Armoire électrique ouverte", "Câbles exposés", "Arc électrique",
        "Personne trop proche zone sous tension", "Travaux sans EPI électrique",
      ],
    },
    {
      id:"hazmat", name:"Hazardous Materials", icon:"🧪", status:"coming_soon",
      detections:[
        "Fuite produits chimiques", "Bidons mal entreposés", "Bouteilles de gaz renversées",
        "Produits incompatibles ensemble", "Fumées ou vapeurs anormales",
      ],
    },
    {
      id:"traffic_mgmt", name:"Traffic Management", icon:"🚧", status:"coming_soon",
      detections:[
        "Marche arrière sans observateur", "Excès de vitesse chantier",
        "Piéton dans trajectoire engin", "Zone de circulation bloquée",
      ],
    },
    {
      id:"emergency_response", name:"Emergency Response", icon:"🆘", status:"coming_soon",
      detections:[
        "Travailleur immobile durée anormale", "Travailleur inconscient",
        "Attroupement suspect", "Détection automatique accident",
      ],
    },
  ],

  // ── Analytics ────────────────────────────────────────────────────────────────
  analytics: [
    { id:"ppe_compliance",        label:"Taux conformité EPI",       icon:"📊", unit:"%"    },
    { id:"helmet_compliance",     label:"Conformité casque",         icon:"⛑️", unit:"%"    },
    { id:"vest_compliance",       label:"Conformité gilet",          icon:"🦺", unit:"%"    },
    { id:"glasses_compliance",    label:"Conformité lunettes",       icon:"🥽", unit:"%"    },
    { id:"boot_compliance",       label:"Conformité bottes",         icon:"👢", unit:"%"    },
    { id:"worker_attendance",     label:"Présence travailleurs",     icon:"👷", unit:"pers" },
    { id:"worker_productivity",   label:"Productivité",              icon:"📈", unit:"%"    },
    { id:"near_miss",             label:"Quasi-accidents",           icon:"⚠️", unit:"nb"   },
    { id:"incident_heatmap",      label:"Heatmap incidents",         icon:"🗺️", unit:""     },
    { id:"equipment_utilization", label:"Utilisation équipements",   icon:"🏗️", unit:"%"    },
    { id:"safety_score",          label:"Score sécurité global",     icon:"🛡️", unit:"/100" },
    { id:"risk_index",            label:"Indice de risque",          icon:"📉", unit:"/10"  },
  ],

  // ── Types d'alertes ──────────────────────────────────────────────────────────
  alert_levels: [
    { id:"emergency", label:"URGENCE",   color:"#DC2626", notify:["sms","push","email","call"] },
    { id:"critical",  label:"Critique",  color:"#EF4444", notify:["sms","push","email"]        },
    { id:"high",      label:"Élevé",     color:"#F97316", notify:["push","email"]              },
    { id:"medium",    label:"Moyen",     color:"#F59E0B", notify:["push"]                      },
    { id:"low",       label:"Faible",    color:"#6B7280", notify:[]                            },
  ],

  // ── Rapports ─────────────────────────────────────────────────────────────────
  reports: [
    { id:"daily",           label:"Rapport journalier",        icon:"📅", frequency:"daily"   },
    { id:"weekly",          label:"Rapport hebdomadaire",      icon:"📆", frequency:"weekly"  },
    { id:"monthly",         label:"Rapport mensuel",           icon:"📊", frequency:"monthly" },
    { id:"ppe_violations",  label:"Rapport violations EPI",    icon:"⛑️", frequency:"on_event"},
    { id:"incident",        label:"Timeline des incidents",    icon:"⚠️", frequency:"on_event"},
    { id:"worker_history",  label:"Historique travailleurs",   icon:"👷", frequency:"on_demand"},
    { id:"equipment",       label:"Historique équipements",    icon:"🏗️", frequency:"on_demand"},
    { id:"inspection",      label:"Rapport d'inspection",      icon:"📋", frequency:"on_demand"},
    { id:"pdf_export",      label:"Export PDF",                icon:"📄", frequency:"on_demand"},
  ],
};

export type ConstructionCategory =
  | "workers" | "ppe" | "tools" | "heavy_equipment"
  | "vehicles" | "materials" | "site_hazards"
  | "behavior_detection" | "fall_detection"
  | "vehicle_safety" | "zone_monitoring";
