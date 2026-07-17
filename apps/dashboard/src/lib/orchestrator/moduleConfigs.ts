/**
 * Module Configurations — synchronisées avec constructionSafety.ts et industrialConfig.ts
 * Mapping COCO classes → contexte module + pipeline events/notifications
 *
 * COCO classes disponibles navigateur:
 * person, car, truck, bus, motorcycle, bicycle, cat, dog, horse, cow, sheep,
 * bottle, chair, couch, tv, laptop, cell phone, scissors, knife, fork,
 * stop sign, traffic light, fire hydrant, backpack, handbag, suitcase...
 */

export interface ModuleDetectionClass {
  cocoClass:   string;
  label:       string;
  icon:        string;
  color:       string;
  confidence:  number;
  alertOn:     boolean;
  severity:    "critical" | "warning" | "info";
  description: string;
  category:    string;
  sendToEvents:     boolean;
  sendToNotif:      boolean;
  sendToAiDetection:boolean;
}

export interface ModuleStat {
  id:      string;
  label:   string;
  icon:    string;
  color:   string;
  compute: (detections: any[]) => string | number;
}

export interface ModuleConfig {
  id:          string;
  name:        string;
  icon:        string;
  description: string;
  color:       string;
  sector:      string;
  browserNote: string;
  classes:     ModuleDetectionClass[];
  stats:       ModuleStat[];
  tips:        string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const count = (dets: any[], cls: string | string[]) =>
  dets.filter(d => Array.isArray(cls) ? cls.includes(d.class) : d.class === cls).length;

const pct = (dets: any[], cls: string | string[], total?: number) => {
  const n = count(dets, cls);
  const t = total ?? dets.length;
  return t > 0 ? `${Math.round(n / t * 100)}%` : "—";
};

// ── CONFIGS MODULES ───────────────────────────────────────────────────────────

export const MODULE_CONFIGS: Record<string, ModuleConfig> = {

  // ── 🏠 Home Security ────────────────────────────────────────────────────────
  home_security: {
    id:"home_security", name:"Home Security", icon:"🏠", color:"#0EA5E9", sector:"Résidentiel",
    description:"Surveillance résidentielle — intrusions, livraisons, animaux",
    browserNote:"YOLOv11 navigateur détecte personnes, véhicules, animaux. Reconnaissance visages sur serveur.",
    tips:["Orientez vers l'entrée principale","Bon éclairage requis (≥30 lux)","Zone de détection: 3-8 mètres"],
    classes:[
      {cocoClass:"person",     label:"Intrus / Personne",    icon:"🚨",color:"#EF4444",confidence:0.60,alertOn:true, severity:"warning", description:"Personne détectée — possible intrusion",    category:"human",   sendToEvents:true, sendToNotif:true, sendToAiDetection:true},
      {cocoClass:"car",        label:"Véhicule suspect",     icon:"🚗",color:"#8B5CF6",confidence:0.55,alertOn:true, severity:"info",    description:"Véhicule détecté à l'entrée",              category:"vehicle", sendToEvents:true, sendToNotif:false,sendToAiDetection:true},
      {cocoClass:"truck",      label:"Camion / Livraison",   icon:"🚛",color:"#8B5CF6",confidence:0.55,alertOn:false,severity:"info",    description:"Livraison ou camion détecté",               category:"vehicle", sendToEvents:true, sendToNotif:false,sendToAiDetection:true},
      {cocoClass:"motorcycle", label:"Moto suspecte",        icon:"🏍️",color:"#EF4444",confidence:0.55,alertOn:true, severity:"warning", description:"Moto — vérifiez la situation",              category:"vehicle", sendToEvents:true, sendToNotif:true, sendToAiDetection:true},
      {cocoClass:"bicycle",    label:"Vélo",                 icon:"🚲",color:"#8B5CF6",confidence:0.50,alertOn:false,severity:"info",    description:"Vélo détecté",                             category:"vehicle", sendToEvents:false,sendToNotif:false,sendToAiDetection:true},
      {cocoClass:"dog",        label:"Chien",                icon:"🐕",color:"#F59E0B",confidence:0.50,alertOn:false,severity:"info",    description:"Animal domestique détecté",                 category:"animal",  sendToEvents:false,sendToNotif:false,sendToAiDetection:true},
      {cocoClass:"cat",        label:"Chat",                 icon:"🐈",color:"#F59E0B",confidence:0.50,alertOn:false,severity:"info",    description:"Animal domestique détecté",                 category:"animal",  sendToEvents:false,sendToNotif:false,sendToAiDetection:true},
      {cocoClass:"backpack",   label:"Sac à dos",            icon:"🎒",color:"#6B7280",confidence:0.45,alertOn:false,severity:"info",    description:"Individu avec sac à dos",                   category:"human",   sendToEvents:false,sendToNotif:false,sendToAiDetection:true},
    ],
    stats:[
      {id:"intrusions",  label:"Intrusions",     icon:"🚨",color:"#EF4444", compute:d=>count(d,"person")},
      {id:"vehicles",    label:"Véhicules",       icon:"🚗",color:"#8B5CF6", compute:d=>count(d,["car","truck","motorcycle"])},
      {id:"animals",     label:"Animaux",         icon:"🐾",color:"#F59E0B", compute:d=>count(d,["cat","dog"])},
      {id:"confidence",  label:"Confiance moy.",  icon:"📊",color:"#0EA5E9", compute:d=>d.length>0?`${Math.round(d.reduce((s:number,x:any)=>s+x.score,0)/d.length*100)}%`:"—"},
    ],
  },

  // ── 🛒 Retail ──────────────────────────────────────────────────────────────
  retail: {
    id:"retail", name:"Retail Intelligence", icon:"🛒", color:"#10B981", sector:"Commerce",
    description:"Prévention des pertes, comptage clients, surveillance caisses",
    browserNote:"Navigateur: personnes, sacs, produits. Vol & rayons vides: YOLOv11 serveur requis.",
    tips:["Caméra en hauteur (2.5-3m)","Couvrez les zones à risque (sorties, rayons premium)","Évitez les contre-jours"],
    classes:[
      {cocoClass:"person",    label:"Client en magasin",      icon:"🛍️",color:"#10B981",confidence:0.55,alertOn:false,severity:"info",    description:"Client détecté",                  category:"human",  sendToEvents:false,sendToNotif:false,sendToAiDetection:true},
      {cocoClass:"backpack",  label:"Sac suspect (vol potentiel)",icon:"🎒",color:"#EF4444",confidence:0.50,alertOn:true,severity:"warning", description:"Sac pouvant dissimuler articles", category:"human",  sendToEvents:true, sendToNotif:true, sendToAiDetection:true},
      {cocoClass:"suitcase",  label:"Bagage volumineux",       icon:"🧳",color:"#F59E0B",confidence:0.50,alertOn:true, severity:"warning", description:"Gros bagage — surveillance accrue", category:"human",  sendToEvents:true, sendToNotif:true, sendToAiDetection:true},
      {cocoClass:"handbag",   label:"Sac à main",              icon:"👜",color:"#6B7280",confidence:0.45,alertOn:false,severity:"info",    description:"Sac client standard",              category:"human",  sendToEvents:false,sendToNotif:false,sendToAiDetection:true},
      {cocoClass:"bottle",    label:"Produit rayon",           icon:"🍾",color:"#10B981",confidence:0.45,alertOn:false,severity:"info",    description:"Produit détecté",                  category:"object", sendToEvents:false,sendToNotif:false,sendToAiDetection:true},
      {cocoClass:"cell phone",label:"Téléphone (scan barcode?)",icon:"📱",color:"#3B82F6",confidence:0.45,alertOn:false,severity:"info",   description:"Client utilise téléphone",          category:"object", sendToEvents:false,sendToNotif:false,sendToAiDetection:true},
    ],
    stats:[
      {id:"clients",     label:"Clients détectés", icon:"🛍️",color:"#10B981", compute:d=>count(d,"person")},
      {id:"suspects",    label:"Comportements",    icon:"⚠️",color:"#F59E0B",  compute:d=>count(d,["backpack","suitcase"])},
      {id:"products",    label:"Produits scan",    icon:"📦",color:"#10B981",  compute:d=>count(d,"bottle")},
      {id:"total",       label:"Total détections", icon:"📊",color:"#0EA5E9",  compute:d=>d.length},
    ],
  },

  // ── 🏗️ Construction Safety ─────────────────────────────────────────────────
  construction: {
    id:"construction", name:"Construction Safety AI", icon:"🏗️", color:"#F59E0B", sector:"Construction",
    description:"EPI, chutes, zones dangereuses, engins — zéro accident sur le chantier",
    browserNote:"Navigateur: personnes, engins, outils détectés. EPI (casque/gilet/harnais) et comportements dangereux précis nécessitent YOLOv11 serveur custom fine-tuned.",
    tips:[
      "Caméra fixe en hauteur (4-6m) — vue plongeante sur la zone",
      "Activer l'alerte sur TOUTES les personnes détectées pour vérification EPI manuelle",
      "Configurer les zones dangereuses dans les paramètres du module",
      "Résolution minimale 1080p pour la détection des EPI à distance",
    ],
    classes:[
      // Personnes — TOUTES doivent être vérifiées pour les EPI
      {cocoClass:"person",      label:"Travailleur — Vérif. EPI requise",  icon:"👷",color:"#F59E0B",confidence:0.60,alertOn:true, severity:"warning", description:"⛑️ Vérifiez: casque + gilet + bottes visibles ? Si non → violation EPI",                           category:"human",    sendToEvents:true, sendToNotif:true, sendToAiDetection:true},
      // Engins et véhicules
      {cocoClass:"truck",       label:"Engin / Camion benne",             icon:"🚛",color:"#EF4444",confidence:0.55,alertOn:true, severity:"warning", description:"Engin lourd — vérifier zone d'exclusion travailleurs (5m)",                                     category:"vehicle",  sendToEvents:true, sendToNotif:true, sendToAiDetection:true},
      {cocoClass:"car",         label:"Véhicule non autorisé zone",       icon:"🚗",color:"#EF4444",confidence:0.55,alertOn:true, severity:"warning", description:"Véhicule en zone chantier — accès autorisé ?",                                                   category:"vehicle",  sendToEvents:true, sendToNotif:true, sendToAiDetection:true},
      {cocoClass:"motorcycle",  label:"Moto — danger chantier",           icon:"🏍️",color:"#EF4444",confidence:0.50,alertOn:true, severity:"critical",description:"🚨 Moto sur chantier — risque critique",                                                        category:"vehicle",  sendToEvents:true, sendToNotif:true, sendToAiDetection:true},
      // Outils dangereux
      {cocoClass:"scissors",    label:"Outil tranchant détecté",          icon:"✂️",color:"#EF4444",confidence:0.45,alertOn:true, severity:"warning", description:"Outil potentiellement dangereux — EPI mains requis",                                             category:"object",   sendToEvents:true, sendToNotif:false,sendToAiDetection:true},
      {cocoClass:"knife",       label:"Outil coupant / couteau",          icon:"🔪",color:"#EF4444",confidence:0.45,alertOn:true, severity:"warning", description:"Outil tranchant — port de gants anti-coupure obligatoire",                                        category:"object",   sendToEvents:true, sendToNotif:false,sendToAiDetection:true},
      // Matériaux et risques
      {cocoClass:"bottle",      label:"Conteneur / Produit chimique",     icon:"⚗️",color:"#8B5CF6",confidence:0.40,alertOn:false,severity:"info",    description:"Conteneur détecté — vérifier stockage matières dangereuses",                                     category:"object",   sendToEvents:false,sendToNotif:false,sendToAiDetection:true},
      {cocoClass:"cell phone",  label:"Téléphone — distraction opérateur",icon:"📵",color:"#F59E0B",confidence:0.45,alertOn:true, severity:"warning", description:"Utilisation téléphone sur chantier — risque distraction",                                        category:"human",    sendToEvents:true, sendToNotif:false,sendToAiDetection:true},
      // Zones et infrastructure
      {cocoClass:"chair",       label:"Objet instable / Risque chute",    icon:"⚠️",color:"#EF4444",confidence:0.40,alertOn:false,severity:"info",    description:"Objet pouvant créer risque de chute — vérifier stabilité",                                      category:"object",   sendToEvents:false,sendToNotif:false,sendToAiDetection:true},
      {cocoClass:"stop sign",   label:"Signalisation sécurité",           icon:"🛑",color:"#EF4444",confidence:0.50,alertOn:false,severity:"info",    description:"Panneau de signalisation détecté",                                                               category:"object",   sendToEvents:false,sendToNotif:false,sendToAiDetection:true},
      {cocoClass:"fire hydrant",label:"Bouche incendie / EPI urgence",    icon:"🧯",color:"#EF4444",confidence:0.50,alertOn:false,severity:"info",    description:"Équipement incendie — vérifier accessibilité",                                                    category:"object",   sendToEvents:false,sendToNotif:false,sendToAiDetection:true},
      {cocoClass:"bicycle",     label:"Vélo — zone chantier",             icon:"🚲",color:"#F59E0B",confidence:0.50,alertOn:true, severity:"warning", description:"Vélo sur le chantier — attention aux engins",                                                    category:"vehicle",  sendToEvents:true, sendToNotif:false,sendToAiDetection:true},
    ],
    stats:[
      {id:"workers",     label:"Travailleurs",         icon:"👷",color:"#F59E0B", compute:d=>count(d,"person")},
      {id:"vehicles",    label:"Engins actifs",         icon:"🚛",color:"#EF4444", compute:d=>count(d,["truck","car"])},
      {id:"violations",  label:"Alertes EPI",           icon:"🚨",color:"#EF4444", compute:d=>d.filter((x:any)=>x.alertOn||x.severity==="critical"||x.severity==="warning").length},
      {id:"risk_level",  label:"Niveau risque",         icon:"🛡️",color:"#EF4444", compute:d=>{
        const c=d.filter((x:any)=>x.severity==="critical").length;
        return c>0?"🔴 Critique":d.filter((x:any)=>x.severity==="warning").length>0?"🟡 Alerte":"🟢 Normal";
      }},
    ],
  },

  // ── 🏭 Industrial Safety ────────────────────────────────────────────────────
  industrial: {
    id:"industrial", name:"Industrial Safety AI", icon:"🏭", color:"#EF4444", sector:"Industrie",
    description:"Sécurité usine — machines, EPI, zones ATEX, véhicules industriels, HSE",
    browserNote:"⚠️ Détection navigateur (COCO): personnes, véhicules, objets. Détections avancées (casque absent, uniforme, arc électrique, gaz) → YOLOv11 serveur custom requis.",
    tips:[
      "🔴 Toute personne détectée = vérification EPI obligatoire (casque, gilet, bottes)",
      "Chaque travailleur sans signe EPI visible → événement 'Vérif. EPI requise' créé",
      "Zone ATEX et zone robot → surveillance 24/7 recommandée",
      "Configurer les zones dangereuses pour alertes automatiques",
      "Pour détection précise des uniformes: déployer YOLOv11 serveur fine-tuned",
    ],
    classes:[
      // ── PERSONNES — toutes surveillées pour EPI
      {cocoClass:"person",      label:"Travailleur — Vérif. EPI & Uniforme", icon:"👷",color:"#EF4444",confidence:0.58,alertOn:true, severity:"warning", description:"⛑️ VÉRIFIER: casque + gilet haute-vis + bottes acier visibles ? Uniforme de travail présent ? Si non → alerte violation EPI",    category:"human",    sendToEvents:true, sendToNotif:true, sendToAiDetection:true},
      // ── VÉHICULES INDUSTRIELS
      {cocoClass:"truck",       label:"Camion / Chariot élévateur",          icon:"🚛",color:"#F97316",confidence:0.55,alertOn:true, severity:"warning", description:"🚛 Engin lourd en mouvement — zone d'exclusion 5m autour des travailleurs",                                                              category:"vehicle",  sendToEvents:true, sendToNotif:true, sendToAiDetection:true},
      {cocoClass:"car",         label:"Véhicule zone production",            icon:"🚗",color:"#EF4444",confidence:0.55,alertOn:true, severity:"warning", description:"Véhicule en zone production — accès autorisé ? Respecte-t-il les voies ?",                                                               category:"vehicle",  sendToEvents:true, sendToNotif:true, sendToAiDetection:true},
      {cocoClass:"motorcycle",  label:"Moto — zone industrielle",            icon:"🏍️",color:"#EF4444",confidence:0.50,alertOn:true, severity:"critical",description:"🚨 Moto en zone industrielle — risque critique de collision",                                                                            category:"vehicle",  sendToEvents:true, sendToNotif:true, sendToAiDetection:true},
      {cocoClass:"bicycle",     label:"Vélo / Transpalette manuel",          icon:"🚲",color:"#F59E0B",confidence:0.50,alertOn:true, severity:"warning", description:"Deux-roues en zone industrielle — EPI cycliste requis",                                                                                  category:"vehicle",  sendToEvents:true, sendToNotif:false,sendToAiDetection:true},
      // ── OBJETS DANGEREUX
      {cocoClass:"scissors",    label:"Outil tranchant / Risque coupure",   icon:"✂️",color:"#EF4444",confidence:0.45,alertOn:true, severity:"warning", description:"⚠️ Outil tranchant détecté — gants anti-coupure obligatoires",                                                                           category:"object",   sendToEvents:true, sendToNotif:false,sendToAiDetection:true},
      {cocoClass:"knife",       label:"Outil coupant / Danger",             icon:"🔪",color:"#EF4444",confidence:0.45,alertOn:true, severity:"warning", description:"Outil coupant — EPI mains requis, zone sécurisée ?",                                                                                      category:"object",   sendToEvents:true, sendToNotif:false,sendToAiDetection:true},
      {cocoClass:"bottle",      label:"Conteneur chimique / Produit",       icon:"⚗️",color:"#8B5CF6",confidence:0.42,alertOn:true, severity:"warning", description:"🧪 Conteneur détecté — produit chimique ? Vérifier stockage et EPI chimiques",                                                            category:"object",   sendToEvents:true, sendToNotif:false,sendToAiDetection:true},
      // ── COMPORTEMENTS DANGEREUX
      {cocoClass:"cell phone",  label:"Téléphone — zone interdite",         icon:"📵",color:"#F59E0B",confidence:0.45,alertOn:true, severity:"warning", description:"📱 Téléphone utilisé en zone industrielle — distraction + risque accident",                                                                category:"human",    sendToEvents:true, sendToNotif:true, sendToAiDetection:true},
      // ── SIGNALISATION & SÉCURITÉ
      {cocoClass:"fire hydrant",label:"Extincteur / Équipement incendie",   icon:"🧯",color:"#EF4444",confidence:0.50,alertOn:false,severity:"info",    description:"Équipement incendie — accessibilité dégagée ?",                                                                                            category:"object",   sendToEvents:false,sendToNotif:false,sendToAiDetection:true},
      {cocoClass:"stop sign",   label:"Signalisation danger",               icon:"🛑",color:"#EF4444",confidence:0.50,alertOn:false,severity:"info",    description:"Panneau signalisation — zone délimitée",                                                                                                   category:"object",   sendToEvents:false,sendToNotif:false,sendToAiDetection:true},
      {cocoClass:"backpack",    label:"Sac personnel — zone production",    icon:"🎒",color:"#F59E0B",confidence:0.45,alertOn:true, severity:"info",    description:"Sac en zone production — risque d'accrochage machine",                                                                                     category:"human",    sendToEvents:false,sendToNotif:false,sendToAiDetection:true},
    ],
    stats:[
      {id:"workers",     label:"Travailleurs détectés",  icon:"👷",color:"#EF4444", compute:d=>count(d,"person")},
      {id:"epi_alerts",  label:"Alertes EPI/Uniforme",   icon:"⛑️",color:"#EF4444", compute:d=>count(d,"person")}, // toutes personnes = vérif EPI
      {id:"vehicles",    label:"Véhicules industriels",  icon:"🚛",color:"#F97316", compute:d=>count(d,["truck","car","motorcycle"])},
      {id:"hse_score",   label:"Score HSE",              icon:"🛡️",color:"#EF4444", compute:d=>{
        const total=d.length; if(!total) return "—";
        const incidents=d.filter((x:any)=>x.severity==="critical").length;
        return `${Math.max(0,100-incidents*15)}/100`;
      }},
    ],
  },

  // ── 🌾 Agriculture ──────────────────────────────────────────────────────────
  agriculture: {
    id:"agriculture", name:"AgriGuard", icon:"🌾", color:"#84CC16", sector:"Agriculture",
    description:"Surveillance troupeaux, prédateurs, périmètre, cultures",
    browserNote:"COCO navigateur: animaux communs. Espèces précises & maladies cultures: YOLOv11 fine-tuned.",
    tips:["Large champ de vision pour les pâturages","Mode nuit pour les prédateurs","Alertes SMS immédiates"],
    classes:[
      {cocoClass:"person",     label:"Intrus / Braconnage",   icon:"🚨",color:"#EF4444",confidence:0.60,alertOn:true, severity:"critical",description:"Personne non autorisée en zone agricole",  category:"human",  sendToEvents:true, sendToNotif:true, sendToAiDetection:true},
      {cocoClass:"dog",        label:"Chien de troupeau",     icon:"🐕",color:"#84CC16",confidence:0.50,alertOn:false,severity:"info",    description:"Animal domestique détecté",                 category:"animal", sendToEvents:false,sendToNotif:false,sendToAiDetection:true},
      {cocoClass:"horse",      label:"Cheval",                icon:"🐎",color:"#D97706",confidence:0.55,alertOn:false,severity:"info",    description:"Équidé détecté",                            category:"animal", sendToEvents:false,sendToNotif:false,sendToAiDetection:true},
      {cocoClass:"cow",        label:"Vache / Bovin",         icon:"🐄",color:"#92400E",confidence:0.55,alertOn:false,severity:"info",    description:"Bovin dans le pâturage",                    category:"animal", sendToEvents:false,sendToNotif:false,sendToAiDetection:true},
      {cocoClass:"sheep",      label:"Mouton / Ovin",         icon:"🐑",color:"#E5E7EB",confidence:0.55,alertOn:false,severity:"info",    description:"Ovin détecté",                              category:"animal", sendToEvents:false,sendToNotif:false,sendToAiDetection:true},
      {cocoClass:"bird",       label:"Oiseau / Nuisible",     icon:"🐦",color:"#FCD34D",confidence:0.45,alertOn:false,severity:"info",    description:"Volatile détecté",                          category:"animal", sendToEvents:false,sendToNotif:false,sendToAiDetection:true},
      {cocoClass:"car",        label:"Véhicule suspect",      icon:"🚗",color:"#EF4444",confidence:0.55,alertOn:true, severity:"warning", description:"Véhicule non autorisé en zone agricole",    category:"vehicle",sendToEvents:true, sendToNotif:true, sendToAiDetection:true},
    ],
    stats:[
      {id:"livestock",  label:"Bétail détecté",    icon:"🐄",color:"#84CC16", compute:d=>count(d,["cow","sheep","horse"])},
      {id:"predators",  label:"Intrus / Prédateurs",icon:"🚨",color:"#EF4444", compute:d=>count(d,"person")},
      {id:"birds",      label:"Oiseaux",            icon:"🐦",color:"#FCD34D", compute:d=>count(d,"bird")},
      {id:"total",      label:"Total détections",   icon:"📊",color:"#84CC16", compute:d=>d.length},
    ],
  },

  // ── 🚗 Transportation ──────────────────────────────────────────────────────
  transportation: {
    id:"transportation", name:"TrafficGuard AI", icon:"🚗", color:"#8B5CF6", sector:"Transport",
    description:"Surveillance trafic, plaques OCR, comptage véhicules, accidents",
    browserNote:"COCO navigateur: véhicules, piétons, signalisation. Plaques & vitesse: YOLOv11 + OCR serveur.",
    tips:["Caméra en hauteur (4-6m) perpendiculaire à la route","Évitez les contre-jours","Calibrez la zone de détection"],
    classes:[
      {cocoClass:"car",          label:"Voiture",             icon:"🚗",color:"#8B5CF6",confidence:0.55,alertOn:false,severity:"info",    description:"Véhicule léger en circulation",      category:"vehicle",sendToEvents:false,sendToNotif:false,sendToAiDetection:true},
      {cocoClass:"truck",        label:"Camion / Poids lourd",icon:"🚛",color:"#6D28D9",confidence:0.55,alertOn:false,severity:"info",    description:"Poids lourd détecté",                category:"vehicle",sendToEvents:false,sendToNotif:false,sendToAiDetection:true},
      {cocoClass:"bus",          label:"Bus / Transport public",icon:"🚌",color:"#4C1D95",confidence:0.55,alertOn:false,severity:"info",  description:"Bus ou transport en commun",          category:"vehicle",sendToEvents:false,sendToNotif:false,sendToAiDetection:true},
      {cocoClass:"motorcycle",   label:"Moto / Deux-roues",   icon:"🏍️",color:"#7C3AED",confidence:0.50,alertOn:false,severity:"info",   description:"Deux-roues motorisé",                category:"vehicle",sendToEvents:false,sendToNotif:false,sendToAiDetection:true},
      {cocoClass:"bicycle",      label:"Vélo",                icon:"🚲",color:"#A78BFA",confidence:0.50,alertOn:false,severity:"info",    description:"Cycliste détecté",                   category:"vehicle",sendToEvents:false,sendToNotif:false,sendToAiDetection:true},
      {cocoClass:"person",       label:"Piéton",              icon:"🚶",color:"#0EA5E9",confidence:0.60,alertOn:false,severity:"info",    description:"Piéton sur voie ou trottoir",        category:"human",  sendToEvents:false,sendToNotif:false,sendToAiDetection:true},
      {cocoClass:"stop sign",    label:"Panneau Stop",        icon:"🛑",color:"#EF4444",confidence:0.50,alertOn:false,severity:"info",    description:"Signalisation stop détectée",        category:"object", sendToEvents:false,sendToNotif:false,sendToAiDetection:true},
      {cocoClass:"traffic light",label:"Feu de circulation",  icon:"🚦",color:"#10B981",confidence:0.50,alertOn:false,severity:"info",    description:"Feu tricolore détecté",              category:"object", sendToEvents:false,sendToNotif:false,sendToAiDetection:true},
    ],
    stats:[
      {id:"cars",       label:"Voitures",     icon:"🚗",color:"#8B5CF6", compute:d=>count(d,"car")},
      {id:"trucks",     label:"Poids lourds", icon:"🚛",color:"#6D28D9", compute:d=>count(d,["truck","bus"])},
      {id:"pedestrians",label:"Piétons",      icon:"🚶",color:"#0EA5E9", compute:d=>count(d,"person")},
      {id:"total_flow", label:"Flux total",   icon:"📊",color:"#8B5CF6", compute:d=>d.length},
    ],
  },

  // ── 🌆 Smart City ───────────────────────────────────────────────────────────
  smart_city: {
    id:"smart_city", name:"Smart City AI", icon:"🌆", color:"#06B6D4", sector:"Ville intelligente",
    description:"Flux piétons, incidents, gestion espaces publics",
    browserNote:"COCO navigateur: personnes, véhicules. Analyse comportementale avancée: YOLOv11 + LLM.",
    tips:["Vue panoramique sur les espaces publics","Heatmap générée automatiquement","Incidents: attroupements, comportements suspects"],
    classes:[
      {cocoClass:"person",   label:"Piéton / Citoyen",    icon:"🚶",color:"#06B6D4",confidence:0.55,alertOn:false,severity:"info", description:"Personne dans l'espace public", category:"human",  sendToEvents:false,sendToNotif:false,sendToAiDetection:true},
      {cocoClass:"car",      label:"Véhicule",            icon:"🚗",color:"#8B5CF6",confidence:0.55,alertOn:false,severity:"info", description:"Véhicule en circulation",       category:"vehicle",sendToEvents:false,sendToNotif:false,sendToAiDetection:true},
      {cocoClass:"bicycle",  label:"Vélo / Mobilité douce",icon:"🚲",color:"#06B6D4",confidence:0.50,alertOn:false,severity:"info",description:"Mobilité douce",               category:"vehicle",sendToEvents:false,sendToNotif:false,sendToAiDetection:true},
      {cocoClass:"bus",      label:"Transport public",    icon:"🚌",color:"#4C1D95",confidence:0.55,alertOn:false,severity:"info", description:"Bus détecté",                  category:"vehicle",sendToEvents:false,sendToNotif:false,sendToAiDetection:true},
    ],
    stats:[
      {id:"pedestrians",label:"Piétons",   icon:"🚶",color:"#06B6D4", compute:d=>count(d,"person")},
      {id:"vehicles",   label:"Véhicules", icon:"🚗",color:"#8B5CF6", compute:d=>count(d,["car","bus","truck"])},
      {id:"cyclists",   label:"Cyclistes", icon:"🚲",color:"#06B6D4", compute:d=>count(d,"bicycle")},
      {id:"density",    label:"Densité",   icon:"📊",color:"#06B6D4", compute:d=>{const n=d.length;return n>20?"🔴 Forte":n>10?"🟡 Moyenne":"🟢 Faible";}},
    ],
  },

  // ── 🛡️ Defense ─────────────────────────────────────────────────────────────
  defense: {
    id:"defense", name:"Defense Shield AI", icon:"🛡️", color:"#374151", sector:"Défense",
    description:"Surveillance périmétrique, drones, menaces — infrastructures critiques",
    browserNote:"COCO navigateur: personnes et véhicules suspects. Drones, armes, thermique: matériel spécialisé + YOLOv11 custom.",
    tips:["Coupler avec capteurs PIR pour réduire faux positifs","Drones: caméras spécialisées requises","Mode thermique pour surveillance nocturne"],
    classes:[
      {cocoClass:"person",     label:"Intrus / Menace",      icon:"🚨",color:"#EF4444",confidence:0.65,alertOn:true, severity:"critical",description:"Intrusion périmètre — alerte immédiate", category:"human",  sendToEvents:true, sendToNotif:true, sendToAiDetection:true},
      {cocoClass:"car",        label:"Véhicule suspect",     icon:"🚗",color:"#EF4444",confidence:0.60,alertOn:true, severity:"critical",description:"Véhicule non identifié",                 category:"vehicle",sendToEvents:true, sendToNotif:true, sendToAiDetection:true},
      {cocoClass:"truck",      label:"Véhicule lourd suspect",icon:"🚛",color:"#EF4444",confidence:0.60,alertOn:true, severity:"critical",description:"Poids lourd — alerte critique",          category:"vehicle",sendToEvents:true, sendToNotif:true, sendToAiDetection:true},
      {cocoClass:"motorcycle", label:"Deux-roues rapide",    icon:"🏍️",color:"#EF4444",confidence:0.55,alertOn:true, severity:"warning", description:"Moto à surveiller",                     category:"vehicle",sendToEvents:true, sendToNotif:true, sendToAiDetection:true},
      {cocoClass:"backpack",   label:"Colis / Bagage suspect",icon:"🎒",color:"#EF4444",confidence:0.50,alertOn:true, severity:"warning", description:"Objet abandonné potentiel",             category:"human",  sendToEvents:true, sendToNotif:true, sendToAiDetection:true},
      {cocoClass:"airplane",   label:"Aéronef / Drone",      icon:"✈️",color:"#EF4444",confidence:0.50,alertOn:true, severity:"critical",description:"Aéronef détecté — alerte critique",      category:"vehicle",sendToEvents:true, sendToNotif:true, sendToAiDetection:true},
    ],
    stats:[
      {id:"intrusions", label:"Intrusions",        icon:"🚨",color:"#EF4444", compute:d=>count(d,"person")},
      {id:"vehicles",   label:"Véhicules suspects",icon:"🚗",color:"#EF4444", compute:d=>count(d,["car","truck","motorcycle"])},
      {id:"threat",     label:"Niveau menace",     icon:"🛡️",color:"#EF4444", compute:d=>{
        const c=d.filter((x:any)=>x.severity==="critical").length;
        return c>0?"🔴 CRITIQUE":d.length>0?"🟡 ÉLEVÉ":"🟢 NORMAL";
      }},
      {id:"response",   label:"Temps réponse",     icon:"⚡",color:"#EF4444", compute:()=>"<1s"},
    ],
  },
};
