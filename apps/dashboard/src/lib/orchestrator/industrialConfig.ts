/**
 * Vision Guard — Industrial Safety AI
 * Configuration complète v1.0
 * "Complete HSE platform for factories, logistics centers & production sites"
 */

export const INDUSTRIAL_CONFIG = {
  module: {
    id:"industrial", name:"Industrial Safety AI", icon:"🏭", color:"#EF4444",
    version:"1.0", status:"Beta",
    description:"Complete HSE platform for factories, logistics centers & production sites",
    goal:"Prevent industrial accidents, ensure HSE compliance and optimize production safety.",
  },

  // ── Zones d'accès ───────────────────────────────────────────────────────────
  access_zones: [
    { id:"main_entrance",   label:"Entrée principale",      icon:"🚪" },
    { id:"staff_entrance",  label:"Entrée employés",        icon:"👷" },
    { id:"visitor_entrance",label:"Entrée visiteurs",       icon:"🚶" },
    { id:"gate_north",      label:"Portail Nord",           icon:"🔒" },
    { id:"gate_south",      label:"Portail Sud",            icon:"🔒" },
    { id:"gate_east",       label:"Portail Est",            icon:"🔒" },
    { id:"gate_west",       label:"Portail Ouest",          icon:"🔒" },
    { id:"security_booth",  label:"Guérite de sécurité",   icon:"💂" },
    { id:"reception",       label:"Réception",              icon:"🏢" },
    { id:"access_control",  label:"Contrôle d'accès",      icon:"🔑" },
  ],

  // ── Lignes de production ────────────────────────────────────────────────────
  production_lines: [
    { id:"prod_line_1",   label:"Ligne de production 1",   icon:"⚙️" },
    { id:"prod_line_2",   label:"Ligne de production 2",   icon:"⚙️" },
    { id:"prod_line_3",   label:"Ligne de production 3",   icon:"⚙️" },
    { id:"prod_line_4",   label:"Ligne de production 4",   icon:"⚙️" },
    { id:"assembly_line", label:"Ligne d'assemblage",      icon:"🔩" },
    { id:"packing_line",  label:"Ligne d'emballage",       icon:"📦" },
    { id:"sorting_line",  label:"Ligne de tri",            icon:"🔄" },
    { id:"robot_line",    label:"Ligne robotisée",         icon:"🤖" },
    { id:"robot_cell",    label:"Cellule robotique",       icon:"🤖" },
    { id:"conveyor_a",    label:"Convoyeur A",             icon:"➡️" },
    { id:"conveyor_b",    label:"Convoyeur B",             icon:"➡️" },
    { id:"conveyor_c",    label:"Convoyeur C",             icon:"➡️" },
  ],

  // ── Machines surveillées ────────────────────────────────────────────────────
  machines: [
    { id:"hydraulic_press",  label:"Presse hydraulique",      icon:"🔧", risk:"critical" },
    { id:"mechanical_press", label:"Presse mécanique",        icon:"🔧", risk:"critical" },
    { id:"cnc_lathe",        label:"Tour CNC",                icon:"⚙️", risk:"high"     },
    { id:"cnc_milling",      label:"Fraiseuse CNC",           icon:"⚙️", risk:"high"     },
    { id:"laser_cutter",     label:"Découpe laser",           icon:"🔴", risk:"critical" },
    { id:"plasma_cutter",    label:"Découpe plasma",          icon:"🔥", risk:"critical" },
    { id:"industrial_saw",   label:"Scie industrielle",       icon:"🪚", risk:"critical" },
    { id:"industrial_robot", label:"Robot industriel",        icon:"🤖", risk:"high"     },
    { id:"robot_arm",        label:"Bras robotisé",           icon:"🦾", risk:"high"     },
    { id:"moulding_machine", label:"Machine de moulage",      icon:"🏭", risk:"high"     },
    { id:"plastic_injector", label:"Injecteur plastique",     icon:"🏭", risk:"high"     },
    { id:"3d_printer",       label:"Imprimante 3D industrielle",icon:"🖨️",risk:"medium"  },
    { id:"compressor",       label:"Compresseur",             icon:"💨", risk:"medium"   },
    { id:"generator",        label:"Générateur",              icon:"⚡", risk:"high"     },
    { id:"transformer",      label:"Transformateur",          icon:"⚡", risk:"critical" },
  ],

  // ── Zones de stockage ───────────────────────────────────────────────────────
  storage_zones: [
    { id:"warehouse_a",    label:"Entrepôt A",            icon:"🏪" },
    { id:"warehouse_b",    label:"Entrepôt B",            icon:"🏪" },
    { id:"pallet_zone",    label:"Zone palettes",         icon:"📦" },
    { id:"raw_materials",  label:"Zone matières premières",icon:"🧱" },
    { id:"finished_goods", label:"Zone produits finis",   icon:"✅" },
    { id:"packaging_zone", label:"Zone emballage",        icon:"📦" },
    { id:"shipping_zone",  label:"Zone expédition",       icon:"🚛" },
    { id:"receiving_zone", label:"Zone réception",        icon:"📥" },
    { id:"dock_1",         label:"Quai 1",                icon:"🚛" },
    { id:"dock_2",         label:"Quai 2",                icon:"🚛" },
    { id:"dock_3",         label:"Quai 3",                icon:"🚛" },
    { id:"dock_4",         label:"Quai 4",                icon:"🚛" },
  ],

  // ── Matières dangereuses ────────────────────────────────────────────────────
  hazardous_materials: [
    { id:"chemicals",       label:"Produits chimiques",    icon:"⚗️", class:"GHS07", severity:"critical" },
    { id:"acids",           label:"Acides",                icon:"🧪", class:"GHS05", severity:"critical" },
    { id:"solvents",        label:"Solvants",              icon:"🫧", class:"GHS02", severity:"critical" },
    { id:"compressed_gas",  label:"Gaz comprimés",         icon:"🔴", class:"GHS04", severity:"critical" },
    { id:"flammable_gas",   label:"Gaz inflammables",      icon:"🔥", class:"GHS02", severity:"critical" },
    { id:"toxic_products",  label:"Produits toxiques",     icon:"☠️", class:"GHS06", severity:"critical" },
    { id:"hazardous_waste", label:"Déchets dangereux",     icon:"🗑️", class:"GHS08", severity:"critical" },
    { id:"chemical_waste",  label:"Déchets chimiques",     icon:"🧪", class:"GHS09", severity:"critical" },
    { id:"tanks",           label:"Cuves",                 icon:"🛢️", class:"—",     severity:"warning"  },
    { id:"reservoirs",      label:"Réservoirs",            icon:"🛢️", class:"—",     severity:"warning"  },
    { id:"ventilated_room", label:"Salle ventilée",        icon:"💨", class:"—",     severity:"info"     },
  ],

  // ── Sécurité incendie ───────────────────────────────────────────────────────
  fire_safety: [
    { id:"fire_room",       label:"Salle incendie",        icon:"🔥", type:"zone"     },
    { id:"extinguishers",   label:"Extincteurs",           icon:"🧯", type:"equipment"},
    { id:"sprinklers",      label:"Gicleurs automatiques", icon:"💧", type:"equipment"},
    { id:"smoke_detectors", label:"Détecteurs fumée",      icon:"💨", type:"sensor"   },
    { id:"heat_detectors",  label:"Détecteurs chaleur",    icon:"🌡️", type:"sensor"   },
    { id:"emergency_exits", label:"Issues de secours",     icon:"🚪", type:"zone"     },
    { id:"emergency_exit",  label:"Sortie urgence",        icon:"🟢", type:"zone"     },
    { id:"muster_point",    label:"Point de rassemblement",icon:"📍", type:"zone"     },
  ],

  // ── Zones électriques ───────────────────────────────────────────────────────
  electrical_zones: [
    { id:"elec_room",       label:"Salle électrique",      icon:"⚡", voltage:"MV",  severity:"critical" },
    { id:"transformer_e",   label:"Transformateur",        icon:"🔌", voltage:"HV",  severity:"critical" },
    { id:"electrical_panel",label:"Tableau électrique",    icon:"📋", voltage:"LV",  severity:"warning"  },
    { id:"high_voltage",    label:"Haute tension",         icon:"⚡", voltage:"HV",  severity:"critical" },
    { id:"generator_e",     label:"Génératrice",           icon:"🔋", voltage:"MV",  severity:"warning"  },
    { id:"ups",             label:"UPS",                   icon:"🔌", voltage:"LV",  severity:"info"     },
    { id:"server_room",     label:"Salle serveurs",        icon:"🖥️", voltage:"LV",  severity:"warning"  },
  ],

  // ── Transport interne ───────────────────────────────────────────────────────
  internal_transport: [
    { id:"forklift_zone",   label:"Zone chariots élévateurs",icon:"🏭",alert_radius:3 },
    { id:"truck_zone",      label:"Zone camions",           icon:"🚛", alert_radius:5 },
    { id:"trailer_zone",    label:"Zone remorques",         icon:"🚛", alert_radius:4 },
    { id:"loading_station", label:"Station de chargement",  icon:"📥", alert_radius:3 },
    { id:"unloading_station",label:"Station de déchargement",icon:"📤",alert_radius:3 },
    { id:"employee_parking",label:"Parking employés",       icon:"🅿️", alert_radius:0 },
    { id:"visitor_parking", label:"Parking visiteurs",      icon:"🅿️", alert_radius:0 },
  ],

  // ── Types de travailleurs ───────────────────────────────────────────────────
  workers: [
    { id:"employee",         label:"Employé",               icon:"👔", color:"#0EA5E9" },
    { id:"technician",       label:"Technicien",            icon:"🔧", color:"#8B5CF6" },
    { id:"operator",         label:"Opérateur machine",     icon:"⚙️", color:"#10B981" },
    { id:"supervisor",       label:"Superviseur",           icon:"📋", color:"#F59E0B" },
    { id:"contractor",       label:"Sous-traitant",         icon:"🔨", color:"#6B7280" },
    { id:"visitor",          label:"Visiteur",              icon:"🚶", color:"#EF4444", alert:true },
    { id:"security_agent",   label:"Agent sécurité",        icon:"💂", color:"#0EA5E9" },
    { id:"electrician",      label:"Électricien",           icon:"⚡", color:"#F59E0B" },
    { id:"welder",           label:"Soudeur",               icon:"🔥", color:"#EF4444" },
    { id:"mechanic",         label:"Mécanicien",            icon:"🔧", color:"#8B5CF6" },
    { id:"forklift_driver",  label:"Cariste",               icon:"🏭", color:"#F59E0B" },
    { id:"truck_driver",     label:"Conducteur camion",     icon:"🚛", color:"#6B7280" },
  ],

  // ── PPE / EPI ───────────────────────────────────────────────────────────────
  ppe: [
    { id:"helmet",           label:"Casque",                icon:"⛑️", required:true,  critical:true  },
    { id:"helmet_color",     label:"Couleur casque (rôle)", icon:"🎨", required:false, critical:false },
    { id:"no_helmet",        label:"Casque ABSENT",         icon:"🚫", required:true,  critical:true, violation:true },
    { id:"safety_glasses",   label:"Lunettes sécurité",     icon:"🥽", required:true,  critical:true  },
    { id:"face_shield",      label:"Visière",               icon:"🛡️", required:false, critical:false },
    { id:"hearing_protect",  label:"Protection auditive",   icon:"🎧", required:false, critical:false },
    { id:"dust_mask",        label:"Masque poussière",      icon:"😷", required:false, critical:false },
    { id:"respirator",       label:"Respirateur",           icon:"🫁", required:false, critical:true  },
    { id:"gloves",           label:"Gants",                 icon:"🧤", required:true,  critical:false },
    { id:"cut_gloves",       label:"Gants anti-coupure",    icon:"🧤", required:false, critical:false },
    { id:"chemical_gloves",  label:"Gants chimiques",       icon:"🧤", required:false, critical:true  },
    { id:"safety_boots",     label:"Bottes sécurité",       icon:"👢", required:true,  critical:false },
    { id:"steel_boots",      label:"Bottes acier",          icon:"👢", required:true,  critical:true  },
    { id:"fire_suit",        label:"Vêtement ignifuge",     icon:"🔥", required:false, critical:true  },
    { id:"hi_vis_vest",      label:"Gilet haute visibilité",icon:"🦺", required:true,  critical:true  },
    { id:"harness",          label:"Harnais",               icon:"🪝", required:false, critical:true  },
    { id:"safety_line",      label:"Longe de sécurité",     icon:"🔗", required:false, critical:true  },
  ],

  // ── Zones dangereuses ───────────────────────────────────────────────────────
  danger_zones: [
    { id:"forbidden_zone",   label:"Zone interdite",        icon:"🚫", color:"#DC2626", severity:"critical" },
    { id:"maintenance_zone", label:"Zone maintenance",      icon:"🔧", color:"#F97316", severity:"warning"  },
    { id:"robot_zone",       label:"Zone robot",            icon:"🤖", color:"#DC2626", severity:"critical" },
    { id:"high_voltage_zone",label:"Zone haute tension",    icon:"⚡", color:"#DC2626", severity:"critical" },
    { id:"high_temp_zone",   label:"Zone haute température",icon:"🌡️", color:"#EF4444", severity:"critical" },
    { id:"cryogenic_zone",   label:"Zone cryogénique",      icon:"🧊", color:"#3B82F6", severity:"critical" },
    { id:"atex_zone",        label:"Zone ATEX",             icon:"💥", color:"#DC2626", severity:"critical" },
    { id:"chemical_zone",    label:"Zone produits chimiques",icon:"⚗️",color:"#8B5CF6", severity:"critical" },
    { id:"radiation_zone",   label:"Zone rayonnement",      icon:"☢️", color:"#F59E0B", severity:"critical" },
    { id:"laser_zone",       label:"Zone laser",            icon:"🔴", color:"#DC2626", severity:"critical" },
    { id:"pressure_zone",    label:"Zone pression",         icon:"💨", color:"#EF4444", severity:"critical" },
  ],

  // ── États machines ──────────────────────────────────────────────────────────
  machine_states: [
    { id:"robot_active",     label:"Robot actif",           icon:"🟢", severity:"info",     action:"monitor"  },
    { id:"robot_stopped",    label:"Robot arrêté",          icon:"🔴", severity:"info",     action:"monitor"  },
    { id:"emergency_stop",   label:"Arrêt d'urgence",       icon:"🛑", severity:"critical", action:"alert"    },
    { id:"unattended_machine",label:"Machine sans opérateur",icon:"⚠️",severity:"warning",  action:"alert"    },
    { id:"machine_overload", label:"Machine en surcharge",  icon:"🔥", severity:"critical", action:"shutdown" },
    { id:"door_open",        label:"Porte machine ouverte", icon:"🚪", severity:"critical", action:"alert"    },
    { id:"guard_removed",    label:"Protection retirée",    icon:"🚫", severity:"critical", action:"shutdown" },
    { id:"conveyor_blocked", label:"Convoyeur bloqué",      icon:"⛔", severity:"warning",  action:"alert"    },
  ],

  // ── Risques comportementaux ─────────────────────────────────────────────────
  behavioral_risks: [
    { id:"person_fall",      label:"Chute de personne",          icon:"⬇️", severity:"critical" },
    { id:"person_stationary",label:"Personne immobile (>30s)",   icon:"⚠️", severity:"critical" },
    { id:"worker_machine_collision",label:"Collision travailleur/machine",icon:"💥",severity:"critical" },
    { id:"worker_forbidden", label:"Travailleur zone interdite",  icon:"🚷", severity:"critical" },
    { id:"no_helmet_w",      label:"Travailleur sans casque",     icon:"🚫⛑️",severity:"critical" },
    { id:"no_glasses_w",     label:"Travailleur sans lunettes",   icon:"🚫🥽",severity:"warning"  },
    { id:"no_gloves_w",      label:"Travailleur sans gants",      icon:"🚫🧤",severity:"warning"  },
    { id:"no_boots_w",       label:"Travailleur sans bottes",     icon:"🚫👢",severity:"warning"  },
    { id:"no_harness_w",     label:"Travailleur sans harnais",    icon:"🚫🪝",severity:"critical" },
    { id:"phone_use",        label:"Utilisation téléphone",       icon:"📵", severity:"warning"  },
    { id:"worker_running",   label:"Travailleur qui court",       icon:"🏃", severity:"warning"  },
    { id:"worker_smoking",   label:"Travailleur qui fume",        icon:"🚬", severity:"warning"  },
  ],

  // ── Risques environnementaux ─────────────────────────────────────────────────
  environmental_risks: [
    { id:"fire",             label:"Incendie",              icon:"🔥", severity:"critical", response:"immediate" },
    { id:"smoke",            label:"Fumée",                 icon:"💨", severity:"critical", response:"immediate" },
    { id:"explosion",        label:"Explosion",             icon:"💥", severity:"critical", response:"immediate" },
    { id:"sparks",           label:"Étincelles",            icon:"✨", severity:"warning",  response:"1min"      },
    { id:"electric_arc",     label:"Arc électrique",        icon:"⚡", severity:"critical", response:"immediate" },
    { id:"water_leak",       label:"Fuite eau",             icon:"💧", severity:"warning",  response:"5min"      },
    { id:"oil_leak",         label:"Fuite huile",           icon:"🛢️", severity:"warning",  response:"5min"      },
    { id:"gas_leak",         label:"Fuite gaz",             icon:"💨", severity:"critical", response:"immediate" },
    { id:"abnormal_steam",   label:"Vapeur anormale",       icon:"💨", severity:"warning",  response:"2min"      },
  ],

  // ── Véhicules industriels ───────────────────────────────────────────────────
  industrial_vehicles: [
    { id:"forklift",         label:"Chariot élévateur",     icon:"🏭", alert_radius_m:3 },
    { id:"agv",              label:"AGV (robot autonome)",  icon:"🤖", alert_radius_m:2 },
    { id:"pallet_truck",     label:"Transpalette",          icon:"🛒", alert_radius_m:1 },
    { id:"truck",            label:"Camion",                icon:"🚛", alert_radius_m:5 },
    { id:"van",              label:"Camionnette",           icon:"🚐", alert_radius_m:3 },
    { id:"trailer",          label:"Remorque",              icon:"🚛", alert_radius_m:4 },
    { id:"crane_i",          label:"Grue",                  icon:"🏗️", alert_radius_m:10},
    { id:"aerial_platform",  label:"Nacelle",               icon:"🪜", alert_radius_m:3 },
    { id:"loader",           label:"Chargeuse",             icon:"🚜", alert_radius_m:4 },
    { id:"excavator",        label:"Pelleteuse",            icon:"🏗️", alert_radius_m:5 },
  ],

  // ── Analytics ────────────────────────────────────────────────────────────────
  analytics: [
    { id:"machine_uptime",      label:"Temps de fonctionnement machines", icon:"⏱️", unit:"h"    },
    { id:"machine_utilization", label:"Taux d'utilisation machines",      icon:"📊", unit:"%"    },
    { id:"downtime",            label:"Temps d'arrêt",                    icon:"⏸️", unit:"h"    },
    { id:"line_productivity",   label:"Productivité par ligne",           icon:"📈", unit:"%"    },
    { id:"zone_occupancy",      label:"Occupation des zones",             icon:"📍", unit:"%"    },
    { id:"ppe_compliance",      label:"Respect EPI (%)",                  icon:"⛑️", unit:"%"    },
    { id:"daily_incidents",     label:"Incidents par jour",               icon:"⚠️", unit:"nb"   },
    { id:"near_miss",           label:"Presqu'accidents (Near Miss)",     icon:"😱", unit:"nb"   },
    { id:"incident_heatmap",    label:"Carte thermique incidents",        icon:"🗺️", unit:""     },
    { id:"alert_response_time", label:"Temps réponse aux alertes",        icon:"⏰", unit:"sec"  },
    { id:"worker_history",      label:"Historique par employé",           icon:"👷", unit:""     },
    { id:"machine_history",     label:"Historique par machine",           icon:"🏭", unit:""     },
    { id:"camera_history",      label:"Historique par caméra",           icon:"📷", unit:""     },
    { id:"safety_index",        label:"Indice global de sécurité",        icon:"🛡️", unit:"/100" },
    { id:"hse_score",           label:"Score conformité HSE",             icon:"📋", unit:"/100" },
  ],

  // ── Niveaux d'alerte ────────────────────────────────────────────────────────
  alert_levels: [
    { id:"emergency",    label:"URGENCE",                icon:"🆘", color:"#DC2626", notify:["sms","push","email","call"], action:"evacuate" },
    { id:"critical",     label:"Critique",               icon:"🔴", color:"#EF4444", notify:["sms","push","email"],        action:"stop"     },
    { id:"high",         label:"Haute",                  icon:"🟠", color:"#F97316", notify:["push","email"],              action:"warn"     },
    { id:"medium",       label:"Moyenne",                icon:"🟡", color:"#F59E0B", notify:["push"],                      action:"monitor"  },
    { id:"low",          label:"Faible",                 icon:"🟢", color:"#10B981", notify:[],                            action:"log"      },
    { id:"stop_now",     label:"Arrêt immédiat",         icon:"🛑", color:"#DC2626", notify:["sms","push","call"],         action:"shutdown" },
    { id:"evacuate",     label:"Évacuation recommandée", icon:"🚨", color:"#DC2626", notify:["sms","push","call","sirene"],action:"evacuate" },
    { id:"maintenance",  label:"Maintenance urgente",    icon:"🔧", color:"#F97316", notify:["push","email"],              action:"schedule" },
    { id:"inspection",   label:"Inspection requise",     icon:"🔍", color:"#F59E0B", notify:["email"],                     action:"inspect"  },
  ],

  // ── Rapports ─────────────────────────────────────────────────────────────────
  reports: [
    { id:"daily",          label:"Rapport journalier",       icon:"📅", freq:"daily",   format:["pdf"]         },
    { id:"weekly",         label:"Rapport hebdomadaire",     icon:"📆", freq:"weekly",  format:["pdf","excel"] },
    { id:"monthly",        label:"Rapport mensuel",          icon:"📊", freq:"monthly", format:["pdf","excel"] },
    { id:"hse",            label:"Rapport HSE",              icon:"🛡️", freq:"monthly", format:["pdf"]         },
    { id:"ppe_compliance", label:"Rapport conformité PPE",   icon:"⛑️", freq:"weekly",  format:["pdf","excel"] },
    { id:"incidents",      label:"Rapport incidents",        icon:"⚠️", freq:"on_event",format:["pdf"]         },
    { id:"maintenance",    label:"Rapport maintenance",      icon:"🔧", freq:"weekly",  format:["pdf","excel"] },
    { id:"environment",    label:"Rapport environnement",    icon:"🌿", freq:"monthly", format:["pdf"]         },
    { id:"pdf_export",     label:"Export PDF",               icon:"📄", freq:"on_demand",format:["pdf"]        },
    { id:"excel_export",   label:"Export Excel",             icon:"📊", freq:"on_demand",format:["excel"]      },
    { id:"realtime_dash",  label:"Tableau de bord temps réel",icon:"📺",freq:"live",    format:["dashboard"]  },
  ],

  // ── Modules IA avancés ───────────────────────────────────────────────────────
  advanced_modules: [
    {
      id:"predictive_maintenance", name:"Predictive Maintenance AI", icon:"🔮", status:"coming_soon",
      description:"Anticipe les pannes machines avant qu'elles surviennent",
      features:["Détection vibrations anormales","Détection fuites précoces","Surchauffe machines","Usure des composants","Prévision de maintenance"],
    },
    {
      id:"digital_twin", name:"Digital Twin Monitoring", icon:"🏭", status:"coming_soon",
      description:"Visualisation 3D de l'usine avec état temps réel",
      features:["Carte interactive de l'usine","État en temps réel de chaque caméra","État de chaque machine","Zones d'alerte dynamiques","Flux de production live"],
    },
    {
      id:"energy_monitoring", name:"Energy Monitoring AI", icon:"⚡", status:"coming_soon",
      description:"Suivi de la consommation énergétique et détection d'anomalies",
      features:["Consommation électrique","Consommation eau","Consommation gaz","Détection d'anomalies","Rapport d'efficacité énergétique"],
    },
    {
      id:"quality_control", name:"Quality Control AI", icon:"🔍", status:"coming_soon",
      description:"Inspection automatique des pièces produites",
      features:["Détection défauts surface","Contrôle dimensions","Contrôle couleur","Contrôle assemblage","Taux de rejet automatique"],
    },
    {
      id:"environmental_monitoring", name:"Environmental Monitoring", icon:"🌿", status:"coming_soon",
      description:"Capteurs environnementaux corrélés avec les caméras",
      features:["Température & Humidité","Qualité de l'air (COV, CO2)","Niveau de bruit","Poussières en suspension","Détection gaz (H2S, CO, LEL)"],
    },
    {
      id:"emergency_response", name:"Emergency Response Center", icon:"🆘", status:"coming_soon",
      description:"Gestion automatique des accidents et incidents",
      features:["Chronologie automatique","Clips vidéo associés","Personnes présentes","Machines impliquées","Rapport complet généré automatiquement"],
    },
  ],
};
