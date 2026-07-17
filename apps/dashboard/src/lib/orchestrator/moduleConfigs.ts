/**
 * Module Configurations
 * Définit pour chaque module :
 * - Les classes YOLO à détecter
 * - Les statistiques à afficher
 * - Les seuils de confiance
 * - Les alertes spécifiques
 */

export interface ModuleDetectionClass {
  cocoClass:   string;          // Classe COCO-SSD disponible dans le navigateur
  label:       string;          // Label affiché
  icon:        string;
  color:       string;
  confidence:  number;          // Seuil minimum
  alertOn:     boolean;         // Déclencher une alerte ?
  severity:    "critical" | "warning" | "info";
  description: string;          // Ce que ça signifie dans ce module
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
  classes:     ModuleDetectionClass[];
  stats:       ModuleStat[];
  tips:        string[];          // Conseils d'utilisation
  yoloNote:    string;            // Note sur ce qui nécessite YOLOv11 serveur
}

export const MODULE_CONFIGS: Record<string, ModuleConfig> = {

  // ── Home Security ──────────────────────────────────────────────────────────
  home_security: {
    id:"home_security", name:"Home Security", icon:"🏠", color:"#0EA5E9", sector:"Résidentiel",
    description:"Surveillance résidentielle — Détecte intrusions, livraisons et activités suspectes",
    yoloNote:"Mode navigateur: YOLOv11 détecte personnes, véhicules, animaux. Plaques & visages nécessitent YOLOv11 serveur.",
    tips:[
      "Orientez la caméra vers l'entrée principale",
      "Assurez un bon éclairage (min 30 lux)",
      "La détection d'intrusion se déclenche dès qu'une personne entre dans la zone",
    ],
    classes:[
      { cocoClass:"person",     label:"Personne/Intrus",    icon:"🧍", color:"#EF4444", confidence:0.60, alertOn:true,  severity:"warning",  description:"Intrusion détectée" },
      { cocoClass:"car",        label:"Véhicule inconnu",   icon:"🚗", color:"#8B5CF6", confidence:0.55, alertOn:true,  severity:"info",     description:"Véhicule détecté à l'entrée" },
      { cocoClass:"cat",        label:"Chat",               icon:"🐈", color:"#F59E0B", confidence:0.50, alertOn:false, severity:"info",     description:"Animal domestique" },
      { cocoClass:"dog",        label:"Chien",              icon:"🐕", color:"#F59E0B", confidence:0.50, alertOn:false, severity:"info",     description:"Animal domestique" },
      { cocoClass:"bicycle",    label:"Vélo",               icon:"🚲", color:"#8B5CF6", confidence:0.50, alertOn:false, severity:"info",     description:"Vélo détecté" },
      { cocoClass:"motorcycle", label:"Moto suspecte",      icon:"🏍️", color:"#EF4444", confidence:0.55, alertOn:true,  severity:"warning",  description:"Moto — vérifiez" },
      { cocoClass:"backpack",   label:"Sac à dos",          icon:"🎒", color:"#6B7280", confidence:0.45, alertOn:false, severity:"info",     description:"Individu avec sac" },
      { cocoClass:"truck",      label:"Camion livraison",   icon:"🚛", color:"#8B5CF6", confidence:0.55, alertOn:false, severity:"info",     description:"Livraison en cours" },
    ],
    stats:[
      { id:"intrusions",  label:"Intrusions",      icon:"🚨", color:"#EF4444", compute:(dets)=>dets.filter(d=>d.class==="person").length },
      { id:"vehicles",    label:"Véhicules",        icon:"🚗", color:"#8B5CF6", compute:(dets)=>dets.filter(d=>["car","truck","motorcycle"].includes(d.class)).length },
      { id:"animals",     label:"Animaux",          icon:"🐾", color:"#F59E0B", compute:(dets)=>dets.filter(d=>["cat","dog","bird"].includes(d.class)).length },
      { id:"confidence",  label:"Confiance moy.",   icon:"📊", color:"#0EA5E9", compute:(dets)=>dets.length>0?`${Math.round(dets.reduce((s:number,d:any)=>s+d.score,0)/dets.length*100)}%`:"—" },
    ],
  },

  // ── Retail ────────────────────────────────────────────────────────────────
  retail: {
    id:"retail", name:"Retail Intelligence", icon:"🛒", color:"#10B981", sector:"Commerce",
    description:"Surveillance commerciale — Prévention des pertes, comptage clients, analyse du comportement",
    yoloNote:"Mode navigateur: personnes, sacs, bouteilles détectés. Vol, rayons vides & barcode nécessitent YOLOv11 serveur.",
    tips:[
      "Installez la caméra en hauteur (2.5-3m) pour couvrir toute la surface",
      "Orientez vers les zones à risque (sorties, rayons premium)",
      "Le comptage clients se base sur ByteTrack (bientôt disponible)",
    ],
    classes:[
      { cocoClass:"person",      label:"Client",              icon:"🛍️", color:"#10B981", confidence:0.55, alertOn:false, severity:"info",     description:"Client en magasin" },
      { cocoClass:"backpack",    label:"Sac à dos suspect",   icon:"🎒", color:"#F59E0B", confidence:0.50, alertOn:true,  severity:"warning",  description:"Article potentiellement caché" },
      { cocoClass:"handbag",     label:"Sac à main",          icon:"👜", color:"#6B7280", confidence:0.50, alertOn:false, severity:"info",     description:"Sac client" },
      { cocoClass:"bottle",      label:"Produit rayon",       icon:"🍾", color:"#10B981", confidence:0.45, alertOn:false, severity:"info",     description:"Produit détecté" },
      { cocoClass:"cell phone",  label:"Téléphone client",    icon:"📱", color:"#3B82F6", confidence:0.45, alertOn:false, severity:"info",     description:"Client sur téléphone" },
      { cocoClass:"suitcase",    label:"Bagage volumineux",   icon:"🧳", color:"#F59E0B", confidence:0.50, alertOn:true,  severity:"warning",  description:"Gros bagage — surveillance accrue" },
    ],
    stats:[
      { id:"clients",     label:"Clients détectés",   icon:"🛍️", color:"#10B981", compute:(dets)=>dets.filter(d=>d.class==="person").length },
      { id:"suspects",    label:"Comportements suspect",icon:"⚠️",color:"#F59E0B", compute:(dets)=>dets.filter(d=>d.class==="backpack"||d.class==="suitcase").length },
      { id:"products",    label:"Produits scannés",    icon:"📦", color:"#10B981", compute:(dets)=>dets.filter(d=>d.class==="bottle").length },
      { id:"peak",        label:"Heure de pointe",     icon:"⏰", color:"#3B82F6", compute:(dets)=>{
          if(!dets.length) return "—";
          const hours: Record<number,number>={};
          dets.forEach((d:any)=>{const h=new Date(d.detectedAt??Date.now()).getHours();hours[h]=(hours[h]??0)+1;});
          const peak=Object.entries(hours).sort((a,b)=>b[1]-a[1])[0];
          return peak?`${peak[0]}h00`:"—";
        }
      },
    ],
  },

  // ── Construction ──────────────────────────────────────────────────────────
  construction: {
    id:"construction", name:"Construction Safety", icon:"🏗️", color:"#F59E0B", sector:"Construction",
    description:"Sécurité chantier — EPI, zones dangereuses, chutes, engins",
    yoloNote:"Mode navigateur: personnes, outils, véhicules détectés. Casques, gilets & zones EPI nécessitent YOLOv11 serveur custom.",
    tips:[
      "Caméra fixe en hauteur pour couvrir la zone de travail",
      "Vérification EPI: l'IA analyse si les travailleurs portent casque et gilet",
      "Zone dangereuse: dessinez des périmètres dans les paramètres",
    ],
    classes:[
      { cocoClass:"person",      label:"Travailleur",         icon:"👷", color:"#F59E0B", confidence:0.60, alertOn:false, severity:"info",     description:"Personnel sur chantier" },
      { cocoClass:"scissors",    label:"Outil tranchant",     icon:"⚠️", color:"#EF4444", confidence:0.45, alertOn:true,  severity:"warning",  description:"Outil dangereux détecté" },
      { cocoClass:"truck",       label:"Engin de chantier",   icon:"🚛", color:"#F59E0B", confidence:0.55, alertOn:false, severity:"info",     description:"Engin en mouvement" },
      { cocoClass:"car",         label:"Véhicule zone chantier",icon:"🚗",color:"#EF4444",confidence:0.55, alertOn:true,  severity:"warning",  description:"Véhicule non autorisé" },
      { cocoClass:"motorcycle",  label:"Moto zone chantier",  icon:"🏍️", color:"#EF4444", confidence:0.50, alertOn:true,  severity:"critical", description:"Danger — moto sur chantier" },
      { cocoClass:"baseball bat",label:"Objet potentiellement dangereux",icon:"⚠️",color:"#EF4444",confidence:0.45,alertOn:true,severity:"warning",description:"Objet dangereux" },
    ],
    stats:[
      { id:"workers",     label:"Travailleurs",         icon:"👷", color:"#F59E0B", compute:(dets)=>dets.filter(d=>d.class==="person").length },
      { id:"violations",  label:"Violations détectées", icon:"🚨", color:"#EF4444", compute:(dets)=>dets.filter(d=>d.severity==="critical"||d.severity==="warning").length },
      { id:"vehicles",    label:"Engins actifs",         icon:"🚛", color:"#F59E0B", compute:(dets)=>dets.filter(d=>["truck","car"].includes(d.class)).length },
      { id:"risk_level",  label:"Niveau de risque",      icon:"📊", color:"#EF4444", compute:(dets)=>{
          const critical=dets.filter((d:any)=>d.severity==="critical").length;
          return critical>0?"🔴 Critique":dets.filter((d:any)=>d.severity==="warning").length>0?"🟡 Alerte":"🟢 Normal";
        }
      },
    ],
  },

  // ── Industrial ────────────────────────────────────────────────────────────
  industrial: {
    id:"industrial", name:"Industrial Safety", icon:"🏭", color:"#EF4444", sector:"Industrie",
    description:"Sécurité industrielle — Feu, fumée, intrusions, équipements",
    yoloNote:"Feu et fumée partiellement détectés via heuristiques couleur. YOLOv11 serveur pour précision maximale.",
    tips:[
      "Placez les caméras près des équipements à risque",
      "La détection feu/fumée est prioritaire — réponse <1 seconde",
      "Configurez les alertes SMS pour les incidents critiques",
    ],
    classes:[
      { cocoClass:"person",      label:"Personnel zone industrielle",icon:"👔",color:"#EF4444",confidence:0.60,alertOn:true, severity:"warning",  description:"Personne en zone à risque" },
      { cocoClass:"truck",       label:"Chariot élévateur",   icon:"🏭", color:"#F59E0B", confidence:0.55, alertOn:false, severity:"info",     description:"Engin industriel" },
      { cocoClass:"car",         label:"Véhicule non autorisé",icon:"🚗",color:"#EF4444", confidence:0.55, alertOn:true,  severity:"warning",  description:"Accès non autorisé" },
      { cocoClass:"scissors",    label:"Outil / Risque de coupure",icon:"✂️",color:"#EF4444",confidence:0.45,alertOn:false,severity:"info",     description:"Outil tranchant" },
      { cocoClass:"bottle",      label:"Conteneur / Produit",  icon:"🧪", color:"#10B981", confidence:0.45, alertOn:false, severity:"info",     description:"Conteneur détecté" },
      { cocoClass:"cell phone",  label:"Téléphone (zone no-phone)",icon:"📵",color:"#F59E0B",confidence:0.45,alertOn:true, severity:"warning",  description:"Téléphone interdit en zone" },
    ],
    stats:[
      { id:"incidents",   label:"Incidents",            icon:"🚨", color:"#EF4444", compute:(dets)=>dets.filter(d=>d.severity==="critical").length },
      { id:"personnel",   label:"Personnel actif",      icon:"👔", color:"#EF4444", compute:(dets)=>dets.filter(d=>d.class==="person").length },
      { id:"equipment",   label:"Équipements détectés", icon:"🏭", color:"#F59E0B", compute:(dets)=>dets.filter(d=>["truck","car"].includes(d.class)).length },
      { id:"alert_rate",  label:"Taux d'alertes",       icon:"📊", color:"#EF4444", compute:(dets)=>dets.length>0?`${Math.round(dets.filter((d:any)=>d.alertOn!==false).length/dets.length*100)}%`:"0%" },
    ],
  },

  // ── Transportation ────────────────────────────────────────────────────────
  transportation: {
    id:"transportation", name:"TrafficGuard", icon:"🚗", color:"#8B5CF6", sector:"Transport",
    description:"Surveillance trafic — Comptage véhicules, analyse accidents, plaques, statistiques",
    yoloNote:"Véhicules détectés en navigateur. Lecture plaques & détection accidents nécessitent YOLOv11 serveur + OCR.",
    tips:[
      "Caméra en hauteur (4-6m) perpendiculaire à la route pour le comptage",
      "Évitez les contre-jours — préférez une orientation nord/sud",
      "Calibrez la zone de détection sur les voies de circulation",
    ],
    classes:[
      { cocoClass:"car",         label:"Voiture",              icon:"🚗", color:"#8B5CF6", confidence:0.55, alertOn:false, severity:"info",     description:"Véhicule léger" },
      { cocoClass:"truck",       label:"Camion / Poids lourd", icon:"🚛", color:"#6D28D9", confidence:0.55, alertOn:false, severity:"info",     description:"Poids lourd" },
      { cocoClass:"bus",         label:"Bus",                  icon:"🚌", color:"#4C1D95", confidence:0.55, alertOn:false, severity:"info",     description:"Transport en commun" },
      { cocoClass:"motorcycle",  label:"Moto",                 icon:"🏍️", color:"#7C3AED", confidence:0.50, alertOn:false, severity:"info",     description:"Deux-roues motorisé" },
      { cocoClass:"bicycle",     label:"Vélo",                 icon:"🚲", color:"#A78BFA", confidence:0.50, alertOn:false, severity:"info",     description:"Deux-roues non motorisé" },
      { cocoClass:"person",      label:"Piéton",               icon:"🚶", color:"#0EA5E9", confidence:0.60, alertOn:false, severity:"info",     description:"Piéton sur voie" },
      { cocoClass:"stop sign",   label:"Panneau Stop",         icon:"🛑", color:"#EF4444", confidence:0.50, alertOn:false, severity:"info",     description:"Signalisation détectée" },
      { cocoClass:"traffic light",label:"Feu de circulation",  icon:"🚦", color:"#10B981", confidence:0.50, alertOn:false, severity:"info",     description:"Feu tricolore" },
    ],
    stats:[
      { id:"cars",        label:"Voitures",             icon:"🚗", color:"#8B5CF6", compute:(dets)=>dets.filter(d=>d.class==="car").length },
      { id:"trucks",      label:"Poids lourds",         icon:"🚛", color:"#6D28D9", compute:(dets)=>dets.filter(d=>d.class==="truck").length },
      { id:"pedestrians", label:"Piétons",              icon:"🚶", color:"#0EA5E9", compute:(dets)=>dets.filter(d=>d.class==="person").length },
      { id:"total_flow",  label:"Flux total",           icon:"📊", color:"#8B5CF6", compute:(dets)=>dets.length },
    ],
  },

  // ── Agriculture ───────────────────────────────────────────────────────────
  agriculture: {
    id:"agriculture", name:"AgriGuard", icon:"🌾", color:"#84CC16", sector:"Agriculture",
    description:"Surveillance agricole — Troupeaux, prédateurs, périmètre, cultures",
    yoloNote:"Animaux communs détectés en navigateur. Espèces spécifiques & maladies des cultures nécessitent YOLOv11 fine-tuned.",
    tips:[
      "Large champ de vision pour couvrir les pâturages",
      "Mode nuit recommandé pour les prédateurs (infrarouge)",
      "Alertes SMS immédiates en cas de prédateur détecté",
    ],
    classes:[
      { cocoClass:"dog",         label:"Chien de troupeau",    icon:"🐕", color:"#84CC16", confidence:0.50, alertOn:false, severity:"info",     description:"Animal domestique" },
      { cocoClass:"cat",         label:"Chat / Petit félin",   icon:"🐈", color:"#84CC16", confidence:0.50, alertOn:false, severity:"info",     description:"Animal détecté" },
      { cocoClass:"horse",       label:"Cheval",               icon:"🐎", color:"#D97706", confidence:0.55, alertOn:false, severity:"info",     description:"Équidé" },
      { cocoClass:"sheep",       label:"Mouton",               icon:"🐑", color:"#E5E7EB", confidence:0.55, alertOn:false, severity:"info",     description:"Ovin" },
      { cocoClass:"cow",         label:"Vache",                icon:"🐄", color:"#92400E", confidence:0.55, alertOn:false, severity:"info",     description:"Bovin" },
      { cocoClass:"bird",        label:"Oiseau / Nuisible",    icon:"🐦", color:"#FCD34D", confidence:0.45, alertOn:false, severity:"info",     description:"Volatile détecté" },
      { cocoClass:"person",      label:"Intrus / Braconnage",  icon:"🚨", color:"#EF4444", confidence:0.60, alertOn:true,  severity:"critical", description:"Personne non autorisée" },
      { cocoClass:"car",         label:"Véhicule suspect",     icon:"🚗", color:"#EF4444", confidence:0.55, alertOn:true,  severity:"warning",  description:"Véhicule en zone agricole" },
    ],
    stats:[
      { id:"livestock",   label:"Bétail détecté",       icon:"🐄", color:"#84CC16", compute:(dets)=>dets.filter(d=>["cow","sheep","horse"].includes(d.class)).length },
      { id:"predators",   label:"Prédateurs / Intrus",  icon:"🚨", color:"#EF4444", compute:(dets)=>dets.filter(d=>d.class==="person").length },
      { id:"birds",       label:"Oiseaux / Nuisibles",  icon:"🐦", color:"#FCD34D", compute:(dets)=>dets.filter(d=>d.class==="bird").length },
      { id:"alerts",      label:"Alertes déclenchées",  icon:"⚠️", color:"#EF4444", compute:(dets)=>dets.filter(d=>d.alertOn).length },
    ],
  },

  // ── Smart City ────────────────────────────────────────────────────────────
  smart_city: {
    id:"smart_city", name:"Smart City", icon:"🌆", color:"#06B6D4", sector:"Ville intelligente",
    description:"Intelligence urbaine — Flux piétons, incidents, gestion espaces publics",
    yoloNote:"Personnes et véhicules détectés en navigateur. Analyse comportementale & incidents nécessitent YOLOv11 + LLM.",
    tips:[
      "Vue panoramique sur les espaces publics",
      "Heatmap de fréquentation générée automatiquement",
      "Incidents: attroupements, comportements suspects, chutes",
    ],
    classes:[
      { cocoClass:"person",      label:"Piéton / Citoyen",     icon:"🚶", color:"#06B6D4", confidence:0.55, alertOn:false, severity:"info",     description:"Personne dans l'espace public" },
      { cocoClass:"car",         label:"Véhicule",             icon:"🚗", color:"#8B5CF6", confidence:0.55, alertOn:false, severity:"info",     description:"Véhicule en circulation" },
      { cocoClass:"bicycle",     label:"Vélo / Trottinette",   icon:"🚲", color:"#06B6D4", confidence:0.50, alertOn:false, severity:"info",     description:"Mobilité douce" },
      { cocoClass:"bus",         label:"Transport public",      icon:"🚌", color:"#4C1D95", confidence:0.55, alertOn:false, severity:"info",     description:"Bus/Tram détecté" },
      { cocoClass:"dog",         label:"Animal en espace public",icon:"🐕",color:"#F59E0B",confidence:0.45, alertOn:false, severity:"info",     description:"Animal domestique" },
      { cocoClass:"bench",       label:"Occupation espace",    icon:"🪑", color:"#64748B", confidence:0.40, alertOn:false, severity:"info",     description:"Espace occupé" },
    ],
    stats:[
      { id:"pedestrians", label:"Piétons",              icon:"🚶", color:"#06B6D4", compute:(dets)=>dets.filter(d=>d.class==="person").length },
      { id:"vehicles",    label:"Véhicules",            icon:"🚗", color:"#8B5CF6", compute:(dets)=>dets.filter(d=>["car","bus","truck"].includes(d.class)).length },
      { id:"cyclists",    label:"Cyclistes",            icon:"🚲", color:"#06B6D4", compute:(dets)=>dets.filter(d=>d.class==="bicycle").length },
      { id:"density",     label:"Densité flux",         icon:"📊", color:"#06B6D4", compute:(dets)=>{
          const n=dets.length;
          return n>20?"🔴 Forte":n>10?"🟡 Moyenne":"🟢 Faible";
        }
      },
    ],
  },

  // ── Defense ───────────────────────────────────────────────────────────────
  defense: {
    id:"defense", name:"Defense Shield", icon:"🛡️", color:"#374151", sector:"Défense",
    description:"Sécurité périmétrique — Intrusions, véhicules suspects, surveillance critique",
    yoloNote:"Personnes et véhicules en navigateur. Drones, armes & thermique nécessitent YOLOv11 spécialisé + matériel dédié.",
    tips:[
      "Couplé avec des capteurs PIR pour réduire les faux positifs",
      "La détection de drones nécessite des caméras spécialisées",
      "Mode nuit thermique recommandé pour la surveillance périmétrique",
    ],
    classes:[
      { cocoClass:"person",      label:"Intrus / Menace",      icon:"🚨", color:"#EF4444", confidence:0.65, alertOn:true,  severity:"critical", description:"Intrusion périmètre" },
      { cocoClass:"car",         label:"Véhicule suspect",     icon:"🚗", color:"#EF4444", confidence:0.60, alertOn:true,  severity:"critical", description:"Véhicule non identifié" },
      { cocoClass:"truck",       label:"Véhicule lourd suspect",icon:"🚛",color:"#EF4444", confidence:0.60, alertOn:true,  severity:"critical", description:"Poids lourd — alerte" },
      { cocoClass:"motorcycle",  label:"Deux-roues rapide",    icon:"🏍️", color:"#EF4444", confidence:0.55, alertOn:true,  severity:"warning",  description:"Moto à surveiller" },
      { cocoClass:"backpack",    label:"Colis / Bagage suspect",icon:"🎒",color:"#EF4444", confidence:0.50, alertOn:true,  severity:"warning",  description:"Objet abandonné potentiel" },
      { cocoClass:"airplane",    label:"Aéronef / Drone",      icon:"✈️", color:"#EF4444", confidence:0.50, alertOn:true,  severity:"critical", description:"Aéronef détecté" },
    ],
    stats:[
      { id:"intrusions",  label:"Intrusions",           icon:"🚨", color:"#EF4444", compute:(dets)=>dets.filter(d=>d.class==="person").length },
      { id:"vehicles",    label:"Véhicules suspects",   icon:"🚗", color:"#EF4444", compute:(dets)=>dets.filter(d=>["car","truck","motorcycle"].includes(d.class)).length },
      { id:"threat_level",label:"Niveau de menace",     icon:"🛡️", color:"#EF4444", compute:(dets)=>{
          const critical=dets.filter((d:any)=>d.severity==="critical").length;
          return critical>0?"🔴 CRITIQUE":dets.filter((d:any)=>d.severity==="warning").length>0?"🟡 ÉLEVÉ":"🟢 NORMAL";
        }
      },
      { id:"response",    label:"Temps réponse",        icon:"⚡", color:"#EF4444", compute:()=>"<1s" },
    ],
  },
};
