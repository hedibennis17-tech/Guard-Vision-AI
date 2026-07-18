/**
 * Vision Guard AI — 8 Modules vendables par abonnement ou licence à vie
 * Chaque module = produit autonome avec ses propres modèles IA
 */
export type { ModulePageConfig } from "@/components/UniversalModulePage";

import type { ModulePageConfig } from "@/components/UniversalModulePage";

// ── KPIs communs ──────────────────────────────────────────────────────────────
const BASE_KPIS = [
  {id:"total_events",    label:"Total events",       icon:"📋",unit:"events"},
  {id:"critical_alerts", label:"Alertes critiques",  icon:"🚨",unit:"nb"},
  {id:"clips",           label:"Clips vidéo",        icon:"🎬",unit:"clips"},
  {id:"session_dets",    label:"Session détections", icon:"🎯",unit:"nb"},
];

// ── 🏠 HOME SECURITY ─────────────────────────────────────────────────────────
export const HOME_SECURITY_CONFIG: ModulePageConfig = {
  id:"home_security", name:"Home Security AI", icon:"🏠", color:"#0EA5E9",
  sector:"Résidentiel", plan:"free", status:"available",
  tagline:"Protégez votre maison et votre famille 24h/7j",
  description:"Détection d'intrusion, surveillance de livraisons, protection des animaux. Alertes instantanées sur votre téléphone.",
  browserNote:"Navigateur: personnes, véhicules, animaux (COCO-SSD). Reconnaissance de visages et plaques: serveur YOLOv11 requis.",
  aiModels:["YOLOv11","SAM 2","ByteTrack","Grounding DINO","CLIP"],
  detections:[
    {id:"person",     cocoClass:"person",     label:"Personne / Intrus",     icon:"🚨",color:"#EF4444",severity:"warning", alertOn:true, category:"human",  sendToEvents:true, sendToNotif:true, description:"Personne détectée — intrusion possible"},
    {id:"car",        cocoClass:"car",         label:"Véhicule suspect",      icon:"🚗",color:"#8B5CF6",severity:"info",    alertOn:true, category:"vehicle",sendToEvents:true, sendToNotif:false,description:"Véhicule à l'entrée"},
    {id:"truck",      cocoClass:"truck",       label:"Camion / Livraison",    icon:"🚛",color:"#8B5CF6",severity:"info",    alertOn:false,category:"vehicle",sendToEvents:true, sendToNotif:false,description:"Livraison détectée"},
    {id:"motorcycle", cocoClass:"motorcycle",  label:"Moto suspecte",         icon:"🏍️",color:"#EF4444",severity:"warning", alertOn:true, category:"vehicle",sendToEvents:true, sendToNotif:true, description:"Moto — vérifiez"},
    {id:"bicycle",    cocoClass:"bicycle",     label:"Vélo",                  icon:"🚲",color:"#64748B",severity:"info",    alertOn:false,category:"vehicle",sendToEvents:false,sendToNotif:false,description:"Vélo détecté"},
    {id:"dog",        cocoClass:"dog",         label:"Chien",                 icon:"🐕",color:"#F59E0B",severity:"info",    alertOn:false,category:"animal", sendToEvents:false,sendToNotif:false,description:"Animal domestique"},
    {id:"cat",        cocoClass:"cat",         label:"Chat",                  icon:"🐈",color:"#F59E0B",severity:"info",    alertOn:false,category:"animal", sendToEvents:false,sendToNotif:false,description:"Animal domestique"},
    {id:"backpack",   cocoClass:"backpack",    label:"Sac à dos suspect",     icon:"🎒",color:"#EF4444",severity:"warning", alertOn:true, category:"human",  sendToEvents:true, sendToNotif:true, description:"Individu avec sac"},
  ],
  locations:[
    {cat:"Extérieur",     locs:["Entrée principale","Porte avant","Porte arrière","Garage","Allée","Jardin","Piscine","Clôture"]},
    {cat:"Intérieur",     locs:["Salon","Couloir","Cuisine","Chambre","Cave","Grenier","Bureau"]},
    {cat:"Surveillance",  locs:["Sonnette","Boîte aux lettres","Parking","Portail","Vue rue"]},
  ],
  analyticsKPIs:[
    ...BASE_KPIS,
    {id:"intrusions",label:"Intrusions détectées",icon:"🚪",unit:"nb"},
    {id:"vehicles",  label:"Véhicules détectés", icon:"🚗",unit:"nb"},
  ],
  reports:[
    {id:"daily",   label:"Rapport journalier",    icon:"📅",freq:"daily"},
    {id:"weekly",  label:"Rapport hebdomadaire",  icon:"📆",freq:"weekly"},
    {id:"intrusion",label:"Rapport intrusions",   icon:"🚨",freq:"on_event"},
    {id:"pdf",     label:"Export PDF",            icon:"📄",freq:"on_demand"},
  ],
};

// ── 🛒 RETAIL INTELLIGENCE ───────────────────────────────────────────────────
export const RETAIL_CONFIG: ModulePageConfig = {
  id:"retail", name:"Retail Intelligence AI", icon:"🛒", color:"#10B981",
  sector:"Commerce", plan:"pro", status:"available",
  tagline:"Prévention des pertes et optimisation de l'expérience client",
  description:"Détection de vol à l'étalage (modèle PyResearch), comptage clients, analyse des rayons. ROI immédiat sur la réduction des pertes.",
  browserNote:"Navigateur: personnes, sacs, comportements. Détection vol précise: modèle YOLOv11 shoplifting_wights.pt (PyResearch) sur serveur requis.",
  aiModels:["YOLOv11 Shoplifting (PyResearch)","SAM 2","PaddleOCR","Barcode Engine","ByteTrack","CLIP","Florence-2"],
  detections:[
    {id:"person",     cocoClass:"person",     label:"Client en magasin",     icon:"🛍️",color:"#10B981",severity:"info",    alertOn:false,category:"human", sendToEvents:false,sendToNotif:false,description:"Client"},
    {id:"backpack",   cocoClass:"backpack",   label:"Sac suspect (vol?)",    icon:"🎒",color:"#EF4444",severity:"warning", alertOn:true, category:"human", sendToEvents:true, sendToNotif:true, description:"Sac pouvant dissimuler articles"},
    {id:"suitcase",   cocoClass:"suitcase",   label:"Gros bagage suspect",   icon:"🧳",color:"#F59E0B",severity:"warning", alertOn:true, category:"human", sendToEvents:true, sendToNotif:true, description:"Bagage volumineux"},
    {id:"handbag",    cocoClass:"handbag",    label:"Sac à main",            icon:"👜",color:"#64748B",severity:"info",    alertOn:false,category:"human", sendToEvents:false,sendToNotif:false,description:"Sac standard"},
    {id:"bottle",     cocoClass:"bottle",     label:"Produit rayon",         icon:"🍾",color:"#10B981",severity:"info",    alertOn:false,category:"object",sendToEvents:false,sendToNotif:false,description:"Produit"},
    {id:"cell phone", cocoClass:"cell phone", label:"Téléphone (scan?)",     icon:"📱",color:"#3B82F6",severity:"info",    alertOn:false,category:"object",sendToEvents:false,sendToNotif:false,description:"Client téléphone"},
  ],
  locations:[
    {cat:"Intérieur magasin",locs:["Entrée","Caisse","Rayon premium","Rayon électronique","Rayon vêtements","Sortie","Cabines d'essayage","Réserve"]},
    {cat:"Extérieur",        locs:["Vitrine","Parking","Entrée livraisons","Quai"]},
  ],
  analyticsKPIs:[
    ...BASE_KPIS,
    {id:"clients",   label:"Clients/heure",    icon:"🛍️",unit:"pers/h"},
    {id:"theft",     label:"Vols détectés",    icon:"🚨",unit:"nb"},
  ],
  reports:[
    {id:"daily",      label:"Rapport journalier",  icon:"📅",freq:"daily"},
    {id:"theft",      label:"Rapport vols",        icon:"🚨",freq:"on_event"},
    {id:"weekly",     label:"Rapport hebdomadaire",icon:"📆",freq:"weekly"},
    {id:"monthly",    label:"Rapport mensuel",     icon:"📊",freq:"monthly"},
  ],
};

// ── 🏗️ CONSTRUCTION SAFETY ────────────────────────────────────────────────────
export const CONSTRUCTION_CONFIG: ModulePageConfig = {
  id:"construction", name:"Construction Safety AI", icon:"🏗️", color:"#F59E0B",
  sector:"Construction", plan:"pro", status:"beta",
  tagline:"Zéro accident sur le chantier — EPI, chutes, engins",
  description:"Détection des violations d'EPI (casque, gilet, harnais), zones dangereuses, chutes, engins. Conforme HSE.",
  browserNote:"Navigateur: personnes + engins (COCO). Détection EPI précise (casque/gilet/harnais absent): serveur YOLOv11 PPE custom requis.",
  aiModels:["YOLOv11 PPE Custom","SAM 2","Grounding DINO","Florence-2","ByteTrack","OpenCV"],
  detections:[
    {id:"person",     cocoClass:"person",    label:"Travailleur — Vérif. EPI",icon:"👷",color:"#F59E0B",severity:"warning",alertOn:true, category:"human",  sendToEvents:true, sendToNotif:true, description:"Vérifier: casque+gilet+bottes visibles?"},
    {id:"truck",      cocoClass:"truck",     label:"Engin lourd",             icon:"🚛",color:"#EF4444",severity:"warning",alertOn:true, category:"vehicle",sendToEvents:true, sendToNotif:true, description:"Zone d'exclusion 5m"},
    {id:"car",        cocoClass:"car",       label:"Véhicule non autorisé",   icon:"🚗",color:"#EF4444",severity:"warning",alertOn:true, category:"vehicle",sendToEvents:true, sendToNotif:true, description:"Accès autorisé?"},
    {id:"motorcycle", cocoClass:"motorcycle",label:"Moto sur chantier",       icon:"🏍️",color:"#EF4444",severity:"critical",alertOn:true,category:"vehicle",sendToEvents:true, sendToNotif:true, description:"Risque critique"},
    {id:"scissors",   cocoClass:"scissors",  label:"Outil tranchant",         icon:"✂️",color:"#EF4444",severity:"warning",alertOn:true, category:"object", sendToEvents:true, sendToNotif:false,description:"Gants requis"},
    {id:"cell phone", cocoClass:"cell phone",label:"Téléphone — distraction", icon:"📵",color:"#F59E0B",severity:"warning",alertOn:true, category:"human",  sendToEvents:true, sendToNotif:false,description:"Risque distraction"},
    {id:"stop sign",  cocoClass:"stop sign", label:"Signalisation",           icon:"🛑",color:"#EF4444",severity:"info",   alertOn:false,category:"object", sendToEvents:false,sendToNotif:false,description:"Signalisation détectée"},
  ],
  locations:[
    {cat:"Accès chantier",   locs:["Entrée principale","Guérite","Clôture Nord","Clôture Sud","Clôture Est","Clôture Ouest"]},
    {cat:"Zones de travail", locs:["Excavation","Fondation","Coffrage","Bétonnage","Ferraillage","Charpente","Toiture","Façade","Démolition"]},
    {cat:"Structures",       locs:["Échafaudage Nord","Échafaudage Sud","Escaliers temporaires","Plateforme élévatrice","Ascenseur chantier"]},
    {cat:"Engins",           locs:["Zone grue","Zone pelle mécanique","Zone bulldozer","Zone bétonnière","Parking engins"]},
    {cat:"Stockage",         locs:["Zone ciment","Zone acier","Zone bois","Zone outils","Zone carburant"]},
    {cat:"Sécurité",         locs:["Point rassemblement","Infirmerie","Extincteurs","Issues secours"]},
  ],
  analyticsKPIs:[
    ...BASE_KPIS,
    {id:"workers",   label:"Travailleurs",      icon:"👷",unit:"pers"},
    {id:"epi_alerts",label:"Alertes EPI",       icon:"⛑️",unit:"nb"},
  ],
  reports:[
    {id:"daily",    label:"Rapport sécurité quotidien",icon:"📅",freq:"daily"},
    {id:"incident", label:"Rapport incident",           icon:"🚨",freq:"on_event"},
    {id:"weekly",   label:"Rapport HSE hebdomadaire",   icon:"📆",freq:"weekly"},
    {id:"pdf",      label:"Export PDF conformité",      icon:"📄",freq:"on_demand"},
  ],
};

// ── 🏭 INDUSTRIAL SAFETY ─────────────────────────────────────────────────────
export const INDUSTRIAL_CONFIG: ModulePageConfig = {
  id:"industrial", name:"Industrial Safety AI", icon:"🏭", color:"#EF4444",
  sector:"Industrie", plan:"pro", status:"available",
  tagline:"Sécurité usine — EPI, machines, zones ATEX, HSE",
  description:"Détection uniforme/EPI, surveillance machines, zones dangereuses, chariots, conformité HSE. Zéro incident.",
  browserNote:"Navigateur: personnes + véhicules (COCO). Détection uniforme/casque/ATEX précise: serveur YOLOv11 industrial custom requis.",
  aiModels:["YOLOv11 Industrial Custom","SAM 2","Grounding DINO","Florence-2","PaddleOCR","ByteTrack","CLIP","OpenCV"],
  detections:[
    {id:"person",     cocoClass:"person",    label:"Travailleur — Vérif. EPI & Uniforme",icon:"👷",color:"#EF4444",severity:"warning",alertOn:true, category:"human",  sendToEvents:true,sendToNotif:true, description:"Casque+gilet+bottes+uniforme?"},
    {id:"truck",      cocoClass:"truck",     label:"Chariot élévateur",                 icon:"🚛",color:"#F97316",severity:"warning",alertOn:true, category:"vehicle",sendToEvents:true,sendToNotif:true, description:"Zone d'exclusion 5m"},
    {id:"car",        cocoClass:"car",       label:"Véhicule zone production",          icon:"🚗",color:"#EF4444",severity:"warning",alertOn:true, category:"vehicle",sendToEvents:true,sendToNotif:true, description:"Accès autorisé?"},
    {id:"motorcycle", cocoClass:"motorcycle",label:"Moto zone industrielle",            icon:"🏍️",color:"#EF4444",severity:"critical",alertOn:true,category:"vehicle",sendToEvents:true,sendToNotif:true, description:"Risque critique"},
    {id:"bottle",     cocoClass:"bottle",    label:"Conteneur chimique",                icon:"⚗️",color:"#8B5CF6",severity:"warning",alertOn:true, category:"object", sendToEvents:true,sendToNotif:false,description:"Produit chimique?"},
    {id:"cell phone", cocoClass:"cell phone",label:"Téléphone zone interdite",          icon:"📵",color:"#F59E0B",severity:"warning",alertOn:true, category:"human",  sendToEvents:true,sendToNotif:true, description:"Zone interdite"},
    {id:"scissors",   cocoClass:"scissors",  label:"Outil tranchant",                   icon:"✂️",color:"#EF4444",severity:"warning",alertOn:true, category:"object", sendToEvents:true,sendToNotif:false,description:"Gants requis"},
    {id:"backpack",   cocoClass:"backpack",  label:"Sac zone production",               icon:"🎒",color:"#F59E0B",severity:"info",   alertOn:true, category:"human",  sendToEvents:false,sendToNotif:false,description:"Risque accrochage"},
  ],
  locations:[
    {cat:"Accès",            locs:["Entrée principale","Entrée employés","Portail Nord","Portail Sud","Guérite","Contrôle d'accès"]},
    {cat:"Production",       locs:["Ligne 1","Ligne 2","Ligne 3","Ligne d'assemblage","Ligne robotisée","Zone inspection","Zone tests"]},
    {cat:"Machines",         locs:["Presse hydraulique","Tour CNC","Découpe laser","Robot industriel","Compresseur","Salle des machines"]},
    {cat:"Entrepôt",         locs:["Réception","Expédition","Quai 1","Quai 2","Zone palettes","Zone produits finis"]},
    {cat:"Zones à risque",   locs:["Salle produits chimiques","Zone ATEX","Zone inflammable","Cuves","Réservoirs"]},
    {cat:"Sécurité",         locs:["Salle électrique","Extincteurs","Point rassemblement","Sortie urgence"]},
  ],
  analyticsKPIs:[
    ...BASE_KPIS,
    {id:"workers",   label:"Travailleurs",      icon:"👷",unit:"pers"},
    {id:"hse_score", label:"Score HSE",         icon:"🛡️",unit:"/100"},
  ],
  reports:[
    {id:"daily",     label:"Rapport HSE quotidien",   icon:"📅",freq:"daily"},
    {id:"incident",  label:"Rapport incident",        icon:"🚨",freq:"on_event"},
    {id:"monthly",   label:"Rapport mensuel HSE",     icon:"📊",freq:"monthly"},
    {id:"pdf",       label:"Export PDF conformité",   icon:"📄",freq:"on_demand"},
  ],
};

// ── 🌾 AGRIGUARD ─────────────────────────────────────────────────────────────
export const AGRIGUARD_CONFIG: ModulePageConfig = {
  id:"agriculture", name:"AgriGuard AI", icon:"🌾", color:"#84CC16",
  sector:"Agriculture", plan:"pro", status:"available",
  tagline:"Protégez vos cultures, bétail et exploitations 24h/7j",
  description:"Surveillance animaux et bétail, détection intrus/braconnage, prédateurs, feu/fumée, inondations. Alertes immédiates.",
  browserNote:"Navigateur: personnes, animaux communs, véhicules (COCO). Espèces précises et comptage: serveur YOLOv11 agri custom requis.",
  aiModels:["YOLOv11 Agri Custom","SAM 2","Grounding DINO","Florence-2","PaddleOCR","CLIP","ByteTrack","LLM"],
  detections:[
    {id:"person",    cocoClass:"person",    label:"Intrus / Braconnage",   icon:"🚨",color:"#EF4444",severity:"critical",alertOn:true, category:"human",  sendToEvents:true, sendToNotif:true, description:"Personne non autorisée"},
    {id:"dog",       cocoClass:"dog",       label:"Chien de ferme",        icon:"🐕",color:"#84CC16",severity:"info",    alertOn:false,category:"animal", sendToEvents:false,sendToNotif:false,description:"Animal domestique"},
    {id:"horse",     cocoClass:"horse",     label:"Cheval",                icon:"🐎",color:"#D97706",severity:"info",    alertOn:false,category:"animal", sendToEvents:false,sendToNotif:false,description:"Équidé"},
    {id:"cow",       cocoClass:"cow",       label:"Vache / Bovin",         icon:"🐄",color:"#92400E",severity:"info",    alertOn:false,category:"animal", sendToEvents:false,sendToNotif:false,description:"Bovin"},
    {id:"sheep",     cocoClass:"sheep",     label:"Mouton / Ovin",         icon:"🐑",color:"#E5E7EB",severity:"info",    alertOn:false,category:"animal", sendToEvents:false,sendToNotif:false,description:"Ovin"},
    {id:"bird",      cocoClass:"bird",      label:"Oiseau nuisible",       icon:"🐦",color:"#FCD34D",severity:"info",    alertOn:false,category:"animal", sendToEvents:false,sendToNotif:false,description:"Volatile"},
    {id:"car",       cocoClass:"car",       label:"Véhicule suspect",      icon:"🚗",color:"#EF4444",severity:"warning", alertOn:true, category:"vehicle",sendToEvents:true, sendToNotif:true, description:"Véhicule non autorisé"},
    {id:"truck",     cocoClass:"truck",     label:"Camion / Tracteur",     icon:"🚛",color:"#84CC16",severity:"info",    alertOn:false,category:"vehicle",sendToEvents:false,sendToNotif:false,description:"Engin agricole"},
  ],
  locations:[
    {cat:"Accès ferme",    locs:["Entrée principale","Portail","Clôture Nord","Clôture Sud","Clôture Est","Clôture Ouest"]},
    {cat:"Bâtiments",      locs:["Maison","Grange","Étable","Poulailler","Bergerie","Serre","Atelier","Entrepôt"]},
    {cat:"Champs",         locs:["Champ Nord","Champ Sud","Pâturage","Verger","Vignoble","Irrigation"]},
    {cat:"Équipements",    locs:["Silos","Réservoir","Zone machinerie","Zone carburant","Aire de chargement"]},
  ],
  analyticsKPIs:[
    ...BASE_KPIS,
    {id:"livestock",  label:"Animaux comptés",    icon:"🐄",unit:"têtes"},
    {id:"intrusions", label:"Intrusions",         icon:"🚨",unit:"nb"},
  ],
  reports:[
    {id:"daily",     label:"Rapport ferme quotidien",  icon:"📅",freq:"daily"},
    {id:"livestock", label:"Rapport bétail",           icon:"🐄",freq:"weekly"},
    {id:"intrusion", label:"Rapport intrusions",       icon:"🚨",freq:"on_event"},
    {id:"monthly",   label:"Rapport mensuel",          icon:"📊",freq:"monthly"},
  ],
};

// ── 🚗 TRAFFICGUARD ───────────────────────────────────────────────────────────
export const TRAFFIC_CONFIG: ModulePageConfig = {
  id:"transportation", name:"TrafficGuard AI", icon:"🚗", color:"#8B5CF6",
  sector:"Transport", plan:"pro", status:"available",
  tagline:"Surveillance trafic, plaques OCR, incidents en temps réel",
  description:"Comptage véhicules, lecture plaques (ALPR/OCR), détection accidents et infractions, gestion du stationnement.",
  browserNote:"Navigateur: véhicules, piétons (COCO). Lecture plaques (OCR) et estimation vitesse: serveur PaddleOCR + YOLOv11 traffic requis.",
  aiModels:["YOLOv11 Traffic Custom","ByteTrack","DeepSORT","PaddleOCR (ALPR)","Grounding DINO","Florence-2","SAM 2","LLM"],
  detections:[
    {id:"car",          cocoClass:"car",         label:"Voiture",                icon:"🚗",color:"#8B5CF6",severity:"info",    alertOn:false,category:"vehicle",sendToEvents:false,sendToNotif:false,description:"Véhicule léger"},
    {id:"truck",        cocoClass:"truck",        label:"Camion",                 icon:"🚛",color:"#6D28D9",severity:"info",    alertOn:false,category:"vehicle",sendToEvents:false,sendToNotif:false,description:"Poids lourd"},
    {id:"bus",          cocoClass:"bus",          label:"Bus",                    icon:"🚌",color:"#4C1D95",severity:"info",    alertOn:false,category:"vehicle",sendToEvents:false,sendToNotif:false,description:"Transport commun"},
    {id:"motorcycle",   cocoClass:"motorcycle",   label:"Moto",                   icon:"🏍️",color:"#7C3AED",severity:"info",   alertOn:false,category:"vehicle",sendToEvents:false,sendToNotif:false,description:"Deux-roues"},
    {id:"bicycle",      cocoClass:"bicycle",      label:"Vélo",                   icon:"🚲",color:"#A78BFA",severity:"info",    alertOn:false,category:"vehicle",sendToEvents:false,sendToNotif:false,description:"Cycliste"},
    {id:"person",       cocoClass:"person",       label:"Piéton",                 icon:"🚶",color:"#0EA5E9",severity:"info",    alertOn:false,category:"human",  sendToEvents:false,sendToNotif:false,description:"Piéton"},
    {id:"stop sign",    cocoClass:"stop sign",    label:"Stop / Panneau",         icon:"🛑",color:"#EF4444",severity:"info",    alertOn:false,category:"object", sendToEvents:false,sendToNotif:false,description:"Signalisation"},
    {id:"traffic light",cocoClass:"traffic light",label:"Feu de circulation",     icon:"🚦",color:"#10B981",severity:"info",    alertOn:false,category:"object", sendToEvents:false,sendToNotif:false,description:"Feu tricolore"},
  ],
  locations:[
    {cat:"Voies urbaines",  locs:["Intersection","Passage piéton","Rond-point","Rue principale","Boulevard","Zone scolaire"]},
    {cat:"Voies rapides",   locs:["Autoroute","Entrée autoroute","Sortie autoroute","Pont","Tunnel","Péage","Aire de repos"]},
    {cat:"Stationnement",   locs:["Parking couvert","Parking extérieur","Zone livraison","Quai chargement"]},
    {cat:"Transport",       locs:["Gare","Station métro","Arrêt bus","Dépôt véhicules","Centre contrôle"]},
  ],
  analyticsKPIs:[
    ...BASE_KPIS,
    {id:"vehicles",    label:"Véhicules/heure",   icon:"🚗",unit:"véh/h"},
    {id:"pedestrians", label:"Piétons",           icon:"🚶",unit:"nb"},
  ],
  reports:[
    {id:"daily",      label:"Rapport trafic quotidien",icon:"📅",freq:"daily"},
    {id:"incidents",  label:"Rapport incidents",        icon:"💥",freq:"on_event"},
    {id:"violations", label:"Rapport infractions",      icon:"🚦",freq:"daily"},
    {id:"monthly",    label:"Rapport mensuel trafic",   icon:"📊",freq:"monthly"},
  ],
};

// ── 🌆 SMART CITY ─────────────────────────────────────────────────────────────
export const SMARTCITY_CONFIG: ModulePageConfig = {
  id:"smart_city", name:"Smart City AI", icon:"🌆", color:"#06B6D4",
  sector:"Ville intelligente", plan:"enterprise", status:"available",
  tagline:"Optimisez votre ville — sécurité, mobilité, environnement",
  description:"Surveillance espaces publics, détection incidents, comptage piétons, gestion déchets, alertes municipales en temps réel.",
  browserNote:"Navigateur: personnes, véhicules (COCO). Analyses comportementales et détection vandalisme: serveur YOLOv11 + Florence-2 requis.",
  aiModels:["YOLOv11","SAM 2","Florence-2","Grounding DINO","CLIP","PaddleOCR","ByteTrack","LLM"],
  detections:[
    {id:"person",    cocoClass:"person",    label:"Piéton",                icon:"🚶",color:"#06B6D4",severity:"info",    alertOn:false,category:"human",  sendToEvents:false,sendToNotif:false,description:"Citoyen"},
    {id:"car",       cocoClass:"car",       label:"Véhicule",              icon:"🚗",color:"#8B5CF6",severity:"info",    alertOn:false,category:"vehicle",sendToEvents:false,sendToNotif:false,description:"Véhicule en circulation"},
    {id:"bicycle",   cocoClass:"bicycle",   label:"Vélo / Mobilité douce", icon:"🚲",color:"#06B6D4",severity:"info",    alertOn:false,category:"vehicle",sendToEvents:false,sendToNotif:false,description:"Mobilité douce"},
    {id:"bus",       cocoClass:"bus",       label:"Bus / Transport public",icon:"🚌",color:"#4C1D95",severity:"info",    alertOn:false,category:"vehicle",sendToEvents:false,sendToNotif:false,description:"Transport commun"},
    {id:"truck",     cocoClass:"truck",     label:"Camion",                icon:"🚛",color:"#64748B",severity:"info",    alertOn:false,category:"vehicle",sendToEvents:false,sendToNotif:false,description:"Poids lourd"},
    {id:"backpack",  cocoClass:"backpack",  label:"Colis / Bagage suspect",icon:"📦",color:"#EF4444",severity:"warning", alertOn:true, category:"security",sendToEvents:true,sendToNotif:true, description:"Objet abandonné?"},
    {id:"dog",       cocoClass:"dog",       label:"Animal errant",         icon:"🐕",color:"#F59E0B",severity:"info",    alertOn:false,category:"animal", sendToEvents:false,sendToNotif:false,description:"Animal"},
  ],
  locations:[
    {cat:"Bâtiments",     locs:["Hôtel de ville","Bibliothèque","École","Hôpital","Stade","Aréna","Marché"]},
    {cat:"Espaces",       locs:["Parc","Place publique","Fontaine","Piste cyclable","Zone piétonne"]},
    {cat:"Transport",     locs:["Gare","Station métro","Arrêt bus","Parking","Pont","Tunnel"]},
    {cat:"Zones urbaines",locs:["Rue principale","Boulevard","Centre-ville","Quartier résidentiel","Quartier commercial"]},
  ],
  analyticsKPIs:[
    ...BASE_KPIS,
    {id:"footfall",  label:"Fréquentation",     icon:"👥",unit:"pers/h"},
    {id:"incidents", label:"Incidents",         icon:"⚠️",unit:"nb"},
  ],
  reports:[
    {id:"daily",    label:"Rapport ville quotidien", icon:"📅",freq:"daily"},
    {id:"weekly",   label:"Rapport mobilité",        icon:"🚶",freq:"weekly"},
    {id:"incidents",label:"Rapport incidents",       icon:"⚠️",freq:"on_event"},
    {id:"monthly",  label:"Rapport municipal",       icon:"🏛️",freq:"monthly"},
  ],
};

// ── 🛡️ DEFENSE SHIELD ────────────────────────────────────────────────────────
export const DEFENSE_CONFIG: ModulePageConfig = {
  id:"defense", name:"Defense Shield AI", icon:"🛡️", color:"#374151",
  sector:"Défense", plan:"enterprise", status:"available",
  tagline:"Sécurité maximale — périmètre, drones, menaces critiques",
  description:"Surveillance périmétrique 24/7, détection drones, intrusions, menaces. Pour bases militaires et infrastructures critiques.",
  browserNote:"Navigateur: personnes, véhicules (COCO haute confiance). Drones, armes, identification: serveur YOLOv11 defense custom requis.",
  aiModels:["YOLOv11 Defense Custom","SAM 2","Florence-2","Grounding DINO","CLIP","ByteTrack","Thermal (option)","LLM"],
  detections:[
    {id:"person",     cocoClass:"person",    label:"Intrus / Menace",      icon:"🚨",color:"#EF4444",severity:"critical",alertOn:true, category:"human",  sendToEvents:true, sendToNotif:true, description:"Intrusion périmètre"},
    {id:"car",        cocoClass:"car",       label:"Véhicule suspect",     icon:"🚗",color:"#EF4444",severity:"critical",alertOn:true, category:"vehicle",sendToEvents:true, sendToNotif:true, description:"Véhicule non identifié"},
    {id:"truck",      cocoClass:"truck",     label:"Véhicule lourd suspect",icon:"🚛",color:"#EF4444",severity:"critical",alertOn:true,category:"vehicle",sendToEvents:true, sendToNotif:true, description:"Poids lourd alerte"},
    {id:"motorcycle", cocoClass:"motorcycle",label:"Deux-roues rapide",    icon:"🏍️",color:"#EF4444",severity:"warning", alertOn:true, category:"vehicle",sendToEvents:true, sendToNotif:true, description:"Moto à surveiller"},
    {id:"backpack",   cocoClass:"backpack",  label:"Colis / Bagage suspect",icon:"🎒",color:"#EF4444",severity:"critical",alertOn:true,category:"human",  sendToEvents:true, sendToNotif:true, description:"Objet abandonné"},
    {id:"airplane",   cocoClass:"airplane",  label:"Aéronef / Drone",      icon:"✈️",color:"#EF4444",severity:"critical",alertOn:true, category:"aerial", sendToEvents:true, sendToNotif:true, description:"Aéronef — alerte critique"},
    {id:"bicycle",    cocoClass:"bicycle",   label:"Deux-roues périmètre", icon:"🚲",color:"#F59E0B",severity:"warning", alertOn:true, category:"vehicle",sendToEvents:true, sendToNotif:false,description:"À surveiller"},
  ],
  locations:[
    {cat:"Contrôle accès", locs:["Porte principale","Checkpoint Alpha","Checkpoint Bravo","Checkpoint Charlie","Guérite"]},
    {cat:"Périmètre",      locs:["Clôture Nord","Clôture Sud","Clôture Est","Clôture Ouest","Tour Nord","Tour Sud","Tour Est","Tour Ouest"]},
    {cat:"Installations",  locs:["Caserne","Armurerie","Dépôt munitions","Hangar 1","Hangar 2","Garage","Zone maintenance"]},
    {cat:"Opérationnel",   locs:["Centre commandement","Salle serveurs","Radar","Antennes","Piste","Héliport","Port militaire"]},
  ],
  analyticsKPIs:[
    ...BASE_KPIS,
    {id:"intrusions",  label:"Intrusions",          icon:"🚨",unit:"nb"},
    {id:"threat_level",label:"Niveau de menace",    icon:"🛡️",unit:""},
  ],
  reports:[
    {id:"daily",    label:"Rapport sécurité",        icon:"📅",freq:"daily"},
    {id:"incident", label:"Rapport incident immédiat",icon:"🚨",freq:"on_event"},
    {id:"tactical", label:"Rapport tactique",        icon:"⭐",freq:"weekly"},
    {id:"monthly",  label:"Synthèse mensuelle",      icon:"📊",freq:"monthly"},
  ],
};

// ── Export index ───────────────────────────────────────────────────────────────
export const ALL_MODULE_CONFIGS: Record<string, ModulePageConfig> = {
  home_security:  HOME_SECURITY_CONFIG,
  retail:         RETAIL_CONFIG,
  construction:   CONSTRUCTION_CONFIG,
  industrial:     INDUSTRIAL_CONFIG,
  agriculture:    AGRIGUARD_CONFIG,
  transportation: TRAFFIC_CONFIG,
  smart_city:     SMARTCITY_CONFIG,
  defense:        DEFENSE_CONFIG,
};
