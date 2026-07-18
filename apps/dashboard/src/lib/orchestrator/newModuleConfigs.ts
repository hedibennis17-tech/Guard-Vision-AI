/**
 * Vision Guard AI Hub — 5 Nouveaux Modules
 * Spec: AgriGuard · TrafficGuard · Smart City · Defense Shield · EnergyGuard
 */

// ── 🌾 AgriGuard ─────────────────────────────────────────────────────────────
export const AGRIGUARD_CONFIG = {
  module:{ id:"agriculture",name:"AgriGuard AI",icon:"🌾",color:"#84CC16",
    description:"Surveillance IA pour fermes, élevages, cultures et exploitations agricoles",
    goal:"Protéger le bétail, détecter les intrusions et optimiser les opérations agricoles 24h/7j" },

  ai_models:["YOLOv11","SAM 2","Grounding DINO","Florence-2","PaddleOCR","CLIP","ByteTrack","LLM"],

  detections:[
    // Personnes
    {id:"farmer",       label:"Agriculteur",          icon:"👨‍🌾",severity:"info",    category:"human",   alert:false},
    {id:"visitor",      label:"Visiteur",             icon:"🚶", severity:"info",    category:"human",   alert:false},
    {id:"intruder",     label:"INTRUS / Braconnage",  icon:"🚨", severity:"critical",category:"human",   alert:true},
    // Véhicules agricoles
    {id:"tractor",      label:"Tracteur",             icon:"🚜", severity:"info",    category:"vehicle", alert:false},
    {id:"harvester",    label:"Moissonneuse",         icon:"🌾", severity:"info",    category:"vehicle", alert:false},
    {id:"sprayer",      label:"Pulvérisateur",        icon:"💧", severity:"info",    category:"vehicle", alert:false},
    {id:"trailer",      label:"Remorque",             icon:"🚛", severity:"info",    category:"vehicle", alert:false},
    {id:"drone",        label:"Drone",                icon:"🚁", severity:"warning", category:"vehicle", alert:true},
    {id:"unknown_vehicle",label:"Véhicule inconnu",   icon:"🚗", severity:"warning", category:"vehicle", alert:true},
    // Bétail
    {id:"cow",          label:"Vache",                icon:"🐄", severity:"info",    category:"animal",  alert:false},
    {id:"horse",        label:"Cheval",               icon:"🐎", severity:"info",    category:"animal",  alert:false},
    {id:"sheep",        label:"Mouton",               icon:"🐑", severity:"info",    category:"animal",  alert:false},
    {id:"goat",         label:"Chèvre",               icon:"🐐", severity:"info",    category:"animal",  alert:false},
    {id:"pig",          label:"Porc",                 icon:"🐷", severity:"info",    category:"animal",  alert:false},
    {id:"chicken",      label:"Poulet",               icon:"🐔", severity:"info",    category:"animal",  alert:false},
    {id:"turkey",       label:"Dindon",               icon:"🦃", severity:"info",    category:"animal",  alert:false},
    {id:"duck",         label:"Canard",               icon:"🦆", severity:"info",    category:"animal",  alert:false},
    {id:"bees",         label:"Abeilles / Ruche",     icon:"🐝", severity:"info",    category:"animal",  alert:false},
    {id:"dog",          label:"Chien de ferme",       icon:"🐕", severity:"info",    category:"animal",  alert:false},
    {id:"cat",          label:"Chat",                 icon:"🐈", severity:"info",    category:"animal",  alert:false},
    {id:"wild_animal",  label:"Animal sauvage / Prédateur",icon:"🦊",severity:"warning",category:"animal",alert:true},
    {id:"bird_pest",    label:"Oiseau nuisible",      icon:"🐦", severity:"info",    category:"animal",  alert:false},
    // Risques
    {id:"damaged_fence",label:"Clôture endommagée",   icon:"🔧", severity:"warning", category:"hazard",  alert:true},
    {id:"fire",         label:"INCENDIE 🔥",           icon:"🔥", severity:"critical",category:"fire",    alert:true},
    {id:"smoke",        label:"Fumée",                icon:"💨", severity:"critical",category:"fire",    alert:true},
    {id:"flood",        label:"Inondation",           icon:"🌊", severity:"critical",category:"hazard",  alert:true},
    {id:"water_leak",   label:"Fuite d'eau",          icon:"💧", severity:"warning", category:"hazard",  alert:true},
    {id:"empty_reservoir",label:"Réservoir vide",     icon:"🛢️", severity:"warning", category:"hazard",  alert:true},
    {id:"open_door",    label:"Porte ouverte (grange)",icon:"🚪",severity:"warning", category:"hazard",  alert:true},
  ],

  locations:[
    {cat:"Accès ferme",       locs:["Entrée principale","Portail","Clôture Nord","Clôture Sud","Clôture Est","Clôture Ouest"]},
    {cat:"Bâtiments",         locs:["Maison","Cour","Garage","Atelier","Entrepôt","Grange","Étable","Poulailler","Bergerie","Serre"]},
    {cat:"Champs",            locs:["Champ Nord","Champ Sud","Champ Est","Champ Ouest","Pâturage","Verger","Vignoble"]},
    {cat:"Équipements",       locs:["Irrigation","Réservoir","Silos","Zone carburant","Zone machinerie","Aire de chargement","Aire de déchargement"]},
  ],

  analytics:[
    {id:"livestock_count",    label:"Comptage animaux par espèce",icon:"🐄",unit:"têtes"},
    {id:"worker_presence",    label:"Présence travailleurs",      icon:"👨‍🌾",unit:"pers"},
    {id:"activity_time",      label:"Temps d'activité",          icon:"⏱️",unit:"h"},
    {id:"equipment_usage",    label:"Utilisation équipements",   icon:"🚜",unit:"%"},
    {id:"intrusions",         label:"Intrusions / Braconnage",   icon:"🚨",unit:"nb"},
    {id:"site_health",        label:"Santé du site",             icon:"💚",unit:"/100"},
    {id:"incident_history",   label:"Historique incidents",      icon:"📋",unit:""},
    {id:"heatmap",            label:"Carte thermique activité",  icon:"🗺️",unit:""},
  ],
  reports:[
    {id:"daily",   label:"Rapport journalier",   icon:"📅",freq:"daily"},
    {id:"weekly",  label:"Rapport hebdomadaire", icon:"📆",freq:"weekly"},
    {id:"monthly", label:"Rapport mensuel",      icon:"📊",freq:"monthly"},
    {id:"livestock",label:"Rapport bétail",      icon:"🐄",freq:"on_demand"},
    {id:"intrusion",label:"Rapport intrusions",  icon:"🚨",freq:"on_event"},
    {id:"pdf",     label:"Export PDF",           icon:"📄",freq:"on_demand"},
  ],
};

// ── 🚗 TrafficGuard ───────────────────────────────────────────────────────────
export const TRAFFICGUARD_CONFIG = {
  module:{id:"transportation",name:"TrafficGuard AI",icon:"🚗",color:"#8B5CF6",
    description:"IA pour routes, autoroutes, stationnements, tunnels et transport intelligent",
    goal:"Réduire les accidents, détecter les infractions et optimiser la fluidité du trafic"},

  ai_models:["YOLOv11","ByteTrack","DeepSORT","PaddleOCR (ALPR)","Grounding DINO","Florence-2","SAM 2","LLM"],

  detections:[
    // Véhicules
    {id:"car",          label:"Automobile",           icon:"🚗", severity:"info",    category:"vehicle", alert:false},
    {id:"truck",        label:"Camion",               icon:"🚛", severity:"info",    category:"vehicle", alert:false},
    {id:"bus",          label:"Autobus",              icon:"🚌", severity:"info",    category:"vehicle", alert:false},
    {id:"motorcycle",   label:"Moto",                 icon:"🏍️", severity:"info",    category:"vehicle", alert:false},
    {id:"bicycle",      label:"Vélo",                 icon:"🚲", severity:"info",    category:"vehicle", alert:false},
    {id:"pedestrian",   label:"Piéton",               icon:"🚶", severity:"info",    category:"human",   alert:false},
    {id:"ambulance",    label:"Ambulance 🚑",          icon:"🚑", severity:"critical",category:"vehicle", alert:true},
    {id:"police",       label:"Voiture de police",    icon:"🚓", severity:"critical",category:"vehicle", alert:true},
    {id:"fire_truck",   label:"Camion pompier",       icon:"🚒", severity:"critical",category:"vehicle", alert:true},
    {id:"trailer",      label:"Remorque",             icon:"🚛", severity:"info",    category:"vehicle", alert:false},
    {id:"heavy_vehicle",label:"Véhicule lourd",       icon:"🚚", severity:"info",    category:"vehicle", alert:false},
    // Incidents
    {id:"accident",     label:"ACCIDENT 🚨",           icon:"💥", severity:"critical",category:"incident",alert:true},
    {id:"congestion",   label:"Embouteillage",        icon:"🚗", severity:"warning", category:"traffic", alert:true},
    {id:"stopped_vehicle",label:"Véhicule arrêté",    icon:"🔴", severity:"warning", category:"incident",alert:true},
    {id:"wrong_way",    label:"Contresens ⚠️",         icon:"🔄", severity:"critical",category:"violation",alert:true},
    {id:"speeding",     label:"Excès de vitesse",     icon:"💨", severity:"warning", category:"violation",alert:true},
    {id:"dangerous_pedestrian",label:"Piéton dangereux",icon:"🚷",severity:"warning",category:"human",  alert:true},
    {id:"fire",         label:"Incendie route",       icon:"🔥", severity:"critical",category:"fire",    alert:true},
    {id:"smoke",        label:"Fumée",                icon:"💨", severity:"critical",category:"fire",    alert:true},
    {id:"debris",       label:"Débris sur chaussée",  icon:"🪨", severity:"warning", category:"hazard",  alert:true},
    {id:"animal_road",  label:"Animal sur route",     icon:"🦌", severity:"warning", category:"animal",  alert:true},
    // OCR
    {id:"license_plate",label:"Plaque d'immatriculation",icon:"🔤",severity:"info",  category:"ocr",     alert:false},
  ],

  locations:[
    {cat:"Voies urbaines",    locs:["Intersection","Feux circulation","Passage piéton","Rond-point","Rue principale","Boulevard"]},
    {cat:"Voies rapides",     locs:["Autoroute","Sortie autoroute","Entrée autoroute","Pont","Tunnel","Aire de repos"]},
    {cat:"Transport",         locs:["Gare","Station autobus","Station métro","Péage","Dépôt véhicules","Centre contrôle circulation"]},
    {cat:"Stationnement",     locs:["Parking","Parking souterrain","Quai chargement","Zone livraison"]},
  ],

  analytics:[
    {id:"flow",         label:"Débit circulation",    icon:"📊",unit:"véh/h"},
    {id:"wait_time",    label:"Temps d'attente",      icon:"⏱️",unit:"min"},
    {id:"vehicle_count",label:"Comptage véhicules",   icon:"🔢",unit:"nb"},
    {id:"parking_occ",  label:"Occupation stationnement",icon:"🅿️",unit:"%"},
    {id:"accidents",    label:"Accidents",            icon:"💥",unit:"nb"},
    {id:"violations",   label:"Infractions",          icon:"🚦",unit:"nb"},
    {id:"congestion",   label:"Congestion",           icon:"🚗",unit:"%"},
    {id:"traffic_map",  label:"Carte trafic temps réel",icon:"🗺️",unit:""},
  ],
  reports:[
    {id:"daily",   label:"Rapport journalier trafic",icon:"📅",freq:"daily"},
    {id:"accidents",label:"Rapport accidents",       icon:"💥",freq:"on_event"},
    {id:"violations",label:"Rapport infractions",   icon:"🚦",freq:"daily"},
    {id:"plates",  label:"Journal plaques OCR",      icon:"🔤",freq:"daily"},
    {id:"monthly", label:"Rapport mensuel",          icon:"📊",freq:"monthly"},
  ],
};

// ── 🌆 Smart City ─────────────────────────────────────────────────────────────
export const SMARTCITY_CONFIG = {
  module:{id:"smart_city",name:"Smart City AI",icon:"🌆",color:"#06B6D4",
    description:"IA pour municipalités et villes intelligentes",
    goal:"Améliorer la qualité de vie, sécuriser les espaces publics et optimiser les ressources urbaines"},

  ai_models:["YOLOv11","SAM 2","Florence-2","Grounding DINO","CLIP","PaddleOCR","ByteTrack","LLM"],

  detections:[
    // Personnes & mobilité
    {id:"pedestrian",   label:"Piéton",               icon:"🚶", severity:"info",    category:"human",   alert:false},
    {id:"cyclist",      label:"Cycliste",             icon:"🚲", severity:"info",    category:"human",   alert:false},
    {id:"car",          label:"Automobile",           icon:"🚗", severity:"info",    category:"vehicle", alert:false},
    {id:"motorcycle",   label:"Moto",                 icon:"🏍️", severity:"info",    category:"vehicle", alert:false},
    {id:"truck",        label:"Camion",               icon:"🚛", severity:"info",    category:"vehicle", alert:false},
    {id:"bus",          label:"Autobus",              icon:"🚌", severity:"info",    category:"vehicle", alert:false},
    // Comportements
    {id:"crowd",        label:"Attroupement",         icon:"👥", severity:"warning", category:"behavior",alert:true},
    {id:"intrusion",    label:"Intrusion zone",       icon:"🚷", severity:"warning", category:"behavior",alert:true},
    {id:"vandalism",    label:"Vandalisme",           icon:"🔨", severity:"warning", category:"behavior",alert:true},
    {id:"graffiti",     label:"Graffiti",             icon:"🖌️", severity:"info",    category:"behavior",alert:false},
    {id:"littering",    label:"Déchets sauvages",     icon:"🗑️", severity:"warning", category:"environment",alert:true},
    {id:"illegal_dump", label:"Dépôt sauvage",        icon:"♻️", severity:"warning", category:"environment",alert:true},
    // Incidents
    {id:"fire",         label:"INCENDIE 🔥",           icon:"🔥", severity:"critical",category:"fire",    alert:true},
    {id:"smoke",        label:"Fumée",                icon:"💨", severity:"critical",category:"fire",    alert:true},
    {id:"flood",        label:"Inondation",           icon:"🌊", severity:"critical",category:"hazard",  alert:true},
    {id:"fallen_tree",  label:"Chute d'arbre",        icon:"🌲", severity:"warning", category:"hazard",  alert:true},
    {id:"animal",       label:"Animal errant",        icon:"🐕", severity:"info",    category:"animal",  alert:false},
    {id:"abandoned_parcel",label:"Colis abandonné",   icon:"📦", severity:"warning", category:"security",alert:true},
    {id:"suspicious_object",label:"Objet suspect",    icon:"❓", severity:"critical",category:"security",alert:true},
  ],

  locations:[
    {cat:"Bâtiments publics",  locs:["Hôtel de ville","Bibliothèque","École","Hôpital","Stade","Aréna"]},
    {cat:"Espaces publics",    locs:["Parc","Place publique","Fontaine","Piste cyclable","Zone piétonne"]},
    {cat:"Transport",          locs:["Gare","Station métro","Arrêt autobus","Parking","Pont","Tunnel"]},
    {cat:"Zones urbaines",     locs:["Rue principale","Boulevard","Quartier résidentiel","Quartier commercial","Centre-ville"]},
  ],

  analytics:[
    {id:"footfall",    label:"Fréquentation",          icon:"👥",unit:"pers/h"},
    {id:"mobility",    label:"Mobilité urbaine",        icon:"🚶",unit:""},
    {id:"space_usage", label:"Occupation espaces",      icon:"📍",unit:"%"},
    {id:"waste",       label:"Déchets détectés",        icon:"🗑️",unit:"nb"},
    {id:"incidents",   label:"Incidents",               icon:"⚠️",unit:"nb"},
    {id:"heatmap",     label:"Carte thermique",         icon:"🗺️",unit:""},
    {id:"daily_trends",label:"Tendances journalières",  icon:"📈",unit:""},
    {id:"reports",     label:"Rapports municipaux",     icon:"📋",unit:""},
  ],
  reports:[
    {id:"daily",   label:"Rapport journalier ville",  icon:"📅",freq:"daily"},
    {id:"weekly",  label:"Rapport hebdomadaire",      icon:"📆",freq:"weekly"},
    {id:"incidents",label:"Rapport incidents",        icon:"⚠️",freq:"on_event"},
    {id:"mobility", label:"Rapport mobilité",         icon:"🚶",freq:"weekly"},
    {id:"municipal",label:"Rapport municipal mensuel",icon:"🏛️",freq:"monthly"},
  ],
};

// ── 🛡️ Defense Shield ─────────────────────────────────────────────────────────
export const DEFENSESHIELD_CONFIG = {
  module:{id:"defense",name:"Defense Shield AI",icon:"🛡️",color:"#374151",
    description:"IA pour bases militaires, infrastructures critiques et défense périmétrique",
    goal:"Sécuriser les périmètres critiques, détecter les intrusions et neutraliser les menaces"},

  ai_models:["YOLOv11","SAM 2","Florence-2","Grounding DINO","CLIP","ByteTrack","LLM"],

  detections:[
    // Personnel
    {id:"soldier",      label:"Soldat / Personnel autorisé",icon:"💂",severity:"info",    category:"human",   alert:false},
    {id:"officer",      label:"Officier",               icon:"⭐", severity:"info",    category:"human",   alert:false},
    {id:"civilian",     label:"Civil autorisé",         icon:"👤", severity:"info",    category:"human",   alert:false},
    {id:"intruder",     label:"INTRUS ⚠️",               icon:"🚨", severity:"critical",category:"human",   alert:true},
    // Véhicules
    {id:"military_vehicle",label:"Véhicule militaire",  icon:"🚗", severity:"info",    category:"vehicle", alert:false},
    {id:"military_truck",  label:"Camion militaire",    icon:"🚛", severity:"info",    category:"vehicle", alert:false},
    {id:"armored_vehicle", label:"Véhicule blindé",     icon:"🛡️", severity:"info",    category:"vehicle", alert:false},
    {id:"unauthorized_vehicle",label:"Véhicule non autorisé 🚨",icon:"🚗",severity:"critical",category:"vehicle",alert:true},
    // Aéronefs
    {id:"drone",        label:"Drone ennemi 🚨",        icon:"🚁", severity:"critical",category:"aerial",  alert:true},
    {id:"helicopter",   label:"Hélicoptère",           icon:"🚁", severity:"warning", category:"aerial",  alert:true},
    {id:"airplane",     label:"Aéronef",               icon:"✈️", severity:"warning", category:"aerial",  alert:true},
    {id:"boat",         label:"Bateau suspect",        icon:"🚢", severity:"warning", category:"marine",  alert:true},
    // Armes & Menaces
    {id:"long_weapon",  label:"Arme longue détectée",  icon:"⚠️", severity:"critical",category:"weapon",  alert:true},
    {id:"handgun",      label:"Arme de poing",         icon:"⚠️", severity:"critical",category:"weapon",  alert:true},
    {id:"abandoned_bag",label:"Sac abandonné suspect", icon:"🎒", severity:"critical",category:"security",alert:true},
    {id:"suspicious_package",label:"Colis suspect",    icon:"📦", severity:"critical",category:"security",alert:true},
    // Incidents
    {id:"explosion",    label:"EXPLOSION 🚨",           icon:"💥", severity:"critical",category:"incident",alert:true},
    {id:"fire",         label:"Incendie",              icon:"🔥", severity:"critical",category:"fire",    alert:true},
    {id:"smoke",        label:"Fumée",                 icon:"💨", severity:"critical",category:"fire",    alert:true},
    {id:"perimeter_breach",label:"Franchissement périmètre",icon:"🚫",severity:"critical",category:"security",alert:true},
  ],

  locations:[
    {cat:"Accès & Contrôle",  locs:["Porte principale","Checkpoint Alpha","Checkpoint Bravo","Checkpoint Charlie","Guérite"]},
    {cat:"Périmètre",         locs:["Clôture Nord","Clôture Sud","Clôture Est","Clôture Ouest","Tour de garde Nord","Tour de garde Sud","Tour de garde Est","Tour de garde Ouest"]},
    {cat:"Installations",     locs:["Caserne","Armurerie","Dépôt munitions","Hangar 1","Hangar 2","Garage véhicules","Zone maintenance"]},
    {cat:"Opérationnel",      locs:["Centre commandement","Salle communications","Salle serveurs","Radar","Antennes"]},
    {cat:"Aérien & Maritime", locs:["Piste","Héliport","Port militaire","Parking militaire"]},
  ],

  analytics:[
    {id:"intrusions",  label:"Intrusions",              icon:"🚨",unit:"nb"},
    {id:"perimeter",   label:"Activité périmètre",      icon:"📍",unit:"events/h"},
    {id:"alert_hist",  label:"Historique alertes",      icon:"📋",unit:""},
    {id:"personnel",   label:"Comptage personnel",      icon:"💂",unit:"pers"},
    {id:"vehicles",    label:"Comptage véhicules",      icon:"🚗",unit:"nb"},
    {id:"drone_activity",label:"Activité drones",       icon:"🚁",unit:"nb"},
    {id:"zone_occ",    label:"Occupation zones",        icon:"📍",unit:"%"},
    {id:"heatmap",     label:"Heatmap sécurité",        icon:"🗺️",unit:""},
    {id:"tactical",    label:"Rapports tactiques",      icon:"⭐",unit:""},
  ],
  reports:[
    {id:"daily",     label:"Rapport journalier",        icon:"📅",freq:"daily"},
    {id:"incident",  label:"Rapport incident immédiat", icon:"🚨",freq:"on_event"},
    {id:"tactical",  label:"Rapport tactique",          icon:"⭐",freq:"weekly"},
    {id:"intrusion", label:"Rapport intrusions",        icon:"🛡️",freq:"daily"},
    {id:"pdf",       label:"Export PDF classifié",      icon:"🔒",freq:"on_demand"},
  ],
};

// ── ⚡ EnergyGuard ────────────────────────────────────────────────────────────
export const ENERGYGUARD_CONFIG = {
  module:{id:"energy",name:"EnergyGuard AI",icon:"⚡",color:"#F59E0B",
    description:"IA pour centrales électriques, barrages, éoliennes, panneaux solaires, pipelines et réseaux énergétiques",
    goal:"Prévenir les pannes, détecter les fuites et sécuriser les infrastructures énergétiques critiques"},

  ai_models:["YOLOv11","SAM 2","Grounding DINO","Florence-2","PaddleOCR","ByteTrack","CLIP","LLM"],

  detections:[
    // Personnel
    {id:"technician",   label:"Technicien autorisé",   icon:"👔", severity:"info",    category:"human",   alert:false},
    {id:"inspector",    label:"Inspecteur",            icon:"📋", severity:"info",    category:"human",   alert:false},
    {id:"intruder",     label:"INTRUS ⚠️",              icon:"🚨", severity:"critical",category:"human",   alert:true},
    // Infrastructure
    {id:"turbine_anomaly",label:"Anomalie turbine",     icon:"⚙️", severity:"critical",category:"equipment",alert:true},
    {id:"solar_damage", label:"Panneau solaire endommagé",icon:"☀️",severity:"warning",category:"equipment",alert:true},
    {id:"wind_blade",   label:"Pale éolienne (dommage)",icon:"💨",severity:"warning", category:"equipment",alert:true},
    {id:"transformer_fault",label:"Défaut transformateur",icon:"⚡",severity:"critical",category:"electrical",alert:true},
    {id:"cable_damage", label:"Câble endommagé",        icon:"🔌", severity:"critical",category:"electrical",alert:true},
    // Risques environnementaux
    {id:"fire",         label:"INCENDIE ⚠️",            icon:"🔥", severity:"critical",category:"fire",    alert:true},
    {id:"smoke",        label:"Fumée anormale",         icon:"💨", severity:"critical",category:"fire",    alert:true},
    {id:"oil_leak",     label:"Fuite huile",            icon:"🛢️", severity:"critical",category:"hazard",  alert:true},
    {id:"gas_leak",     label:"FUITE GAZ 🚨",           icon:"💨", severity:"critical",category:"hazard",  alert:true},
    {id:"water_overflow",label:"Débordement barrage",   icon:"🌊", severity:"critical",category:"hazard",  alert:true},
    {id:"corrosion",    label:"Corrosion détectée",     icon:"🔧", severity:"warning", category:"maintenance",alert:true},
    {id:"hotspot",      label:"Point chaud thermique",  icon:"🌡️", severity:"warning", category:"maintenance",alert:true},
    // Sécurité
    {id:"vehicle",      label:"Véhicule zone critique", icon:"🚗", severity:"warning", category:"vehicle", alert:true},
    {id:"drone",        label:"Drone non autorisé",     icon:"🚁", severity:"critical",category:"aerial",  alert:true},
    {id:"explosion",    label:"EXPLOSION 🚨",            icon:"💥", severity:"critical",category:"incident",alert:true},
  ],

  locations:[
    {cat:"Centrale électrique",locs:["Salle machines","Turbines","Transformateurs","Tableau de commande","Générateurs","Salle de contrôle"]},
    {cat:"Énergies renouvelables",locs:["Parc éolien Nord","Parc éolien Sud","Champ solaire","Station météo","Inverters"]},
    {cat:"Barrage",            locs:["Barrage principal","Vannes","Évacuateur de crues","Turbines hydrauliques","Bassin amont","Bassin aval"]},
    {cat:"Pipeline & Raffinerie",locs:["Station pompage","Vanne principale","Pipeline Nord","Pipeline Sud","Réservoirs","Raffinerie"]},
    {cat:"Réseau distribution", locs:["Sous-station principale","Lignes HT","Pylônes","Poste de transformation","Centre dispatching"]},
    {cat:"Sécurité",           locs:["Entrée principale","Clôture périmètre","Tour surveillance","Salle sécurité"]},
  ],

  analytics:[
    {id:"uptime",       label:"Disponibilité infrastructure",icon:"✅",unit:"%"},
    {id:"anomalies",    label:"Anomalies détectées",         icon:"⚠️",unit:"nb"},
    {id:"energy_output",label:"Production énergétique",     icon:"⚡",unit:"MWh"},
    {id:"intrusions",   label:"Intrusions",                 icon:"🚨",unit:"nb"},
    {id:"maintenance",  label:"Alertes maintenance",        icon:"🔧",unit:"nb"},
    {id:"hotspots",     label:"Points chauds (thermique)",  icon:"🌡️",unit:"nb"},
    {id:"heatmap",      label:"Carte thermique incidents",  icon:"🗺️",unit:""},
    {id:"predictive",   label:"Maintenance prédictive",     icon:"🔮",unit:""},
  ],
  reports:[
    {id:"daily",     label:"Rapport opérationnel",         icon:"📅",freq:"daily"},
    {id:"incident",  label:"Rapport incident",             icon:"🚨",freq:"on_event"},
    {id:"energy",    label:"Rapport production",           icon:"⚡",freq:"weekly"},
    {id:"maintenance",label:"Rapport maintenance",         icon:"🔧",freq:"weekly"},
    {id:"monthly",   label:"Rapport mensuel HSE Énergie",  icon:"📊",freq:"monthly"},
  ],
};

export const ALL_NEW_MODULE_CONFIGS = {
  agriculture:   AGRIGUARD_CONFIG,
  transportation:TRAFFICGUARD_CONFIG,
  smart_city:    SMARTCITY_CONFIG,
  defense:       DEFENSESHIELD_CONFIG,
  energy:        ENERGYGUARD_CONFIG,
};
