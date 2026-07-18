/**
 * Vision Guard AI Hub — Catalogue des bundles Marketplace
 *
 * Architecture : AI Orchestrator → active les bons moteurs selon le bundle installé
 *
 * Caméra → AI Orchestrator → [YOLO + SAM + OCR + ByteTrack + CLIP + LLM]
 *                          → Events → Analytics → Reports → Notifications
 */

export type BundleStatus = "available" | "beta" | "coming_soon" | "enterprise";
export type ModelType =
  | "YOLO"    | "SAM"     | "OCR"      | "CLIP"    | "LLM"
  | "Barcode" | "Tracker" | "Thermal"  | "NightVision";

export interface AIModel {
  id:          string;
  name:        string;
  version:     string;
  type:        ModelType;
  description: string;
  icon:        string;
  size:        string;          // ex: "6.2MB nano" / "137MB large"
  available:   boolean;
  comingSoon?: boolean;
}

export interface BundleFeature {
  label:     string;
  model?:    string;           // modèle IA qui gère cette feature
  included:  boolean;
}

export interface AIBundle {
  id:          string;
  name:        string;
  icon:        string;
  tagline:     string;
  description: string;
  sector:      string;
  status:      BundleStatus;
  minPlan:     "free" | "home" | "pro" | "business" | "enterprise";
  price:       number | null;  // null = inclus dans le plan
  models:      string[];       // IDs des modèles
  features:    BundleFeature[];
  workflow:    string[];       // Pipeline d'exécution
  detectionClasses: string[];
  color:       string;
  popular?:    boolean;
}

// ── Catalogue des modèles IA ──────────────────────────────────────────────────

export const AI_MODELS: Record<string, AIModel> = {
  yolov11: {
    id:"yolov11", name:"YOLOv11", version:"11.0", type:"YOLO",
    description:"Détection d'objets temps réel — le plus rapide et précis",
    icon:"🎯", size:"6.2MB (nano) → 137MB (large)", available:true,
  },
  sam2: {
    id:"sam2", name:"SAM 2", version:"2.0", type:"SAM",
    description:"Segment Anything — segmentation pixel-perfect de n'importe quel objet",
    icon:"✂️", size:"38MB", available:true, comingSoon:false,
  },
  paddleocr: {
    id:"paddleocr", name:"PaddleOCR", version:"2.7", type:"OCR",
    description:"OCR multilingue — lecture de texte, plaques, codes-barres",
    icon:"📖", size:"12MB", available:true,
  },
  clip: {
    id:"clip", name:"CLIP", version:"ViT-B/32", type:"CLIP",
    description:"Compréhension image-texte — recherche sémantique visuelle",
    icon:"🔗", size:"151MB", available:true,
  },
  bytetrack: {
    id:"bytetrack", name:"ByteTrack", version:"1.0", type:"Tracker",
    description:"Tracking multi-objets — suivre des personnes/véhicules entre frames",
    icon:"👁️", size:"2MB", available:true,
  },
  llama3: {
    id:"llama3", name:"Llama 3.2", version:"3.2", type:"LLM",
    description:"LLM léger — analyse contextuelle des scènes et génération de rapports",
    icon:"🦙", size:"2GB (3B)", available:false, comingSoon:true,
  },
  grounding_dino: {
    id:"grounding_dino", name:"Grounding DINO", version:"1.0", type:"YOLO",
    description:"Détection open-vocabulary — détecter n'importe quoi avec du texte",
    icon:"🦖", size:"694MB", available:false, comingSoon:true,
  },
  florence2: {
    id:"florence2", name:"Florence-2", version:"2.0", type:"CLIP",
    description:"Vision foundation model Microsoft — caption, OCR, détection",
    icon:"🌸", size:"232MB", available:false, comingSoon:true,
  },
  whisper: {
    id:"whisper", name:"Whisper", version:"v3", type:"LLM",
    description:"Reconnaissance vocale — alertes vocales et transcription",
    icon:"🎙️", size:"1.5GB", available:false, comingSoon:true,
  },
  deepseek: {
    id:"deepseek", name:"DeepSeek-V3", version:"V3", type:"LLM",
    description:"Analyse avancée des scènes et raisonnement complexe",
    icon:"🔍", size:"685GB", available:false, comingSoon:true,
  },
};

// ── Catalogue des bundles ─────────────────────────────────────────────────────

export const AI_BUNDLES = [
  // ── Home Security ─────────────────────────────────────────────────────────
  {
    id:"home_security", name:"Home Security", icon:"🏠", sector:"Résidentiel",
    tagline:"Protégez votre maison 24h/7j",
    description:"Surveillance intelligente pour particuliers. Détecte personnes, animaux, colis et véhicules.",
    status:"available", minPlan:"free", price:null, popular:true,
    color:"#0EA5E9",
    models:["yolov11","bytetrack"],
    detectionClasses:["person","animal","car","truck","bicycle","package","bird","cat","dog"],
    workflow:["Caméra","YOLOv11 Détection","ByteTrack Suivi","Events","Notifications Push/Email","Rapports PDF"],
    features:[
      { label:"Détection personne",      model:"YOLOv11",   included:true  },
      { label:"Détection animal",        model:"YOLOv11",   included:true  },
      { label:"Détection colis",         model:"YOLOv11",   included:true  },
      { label:"Détection véhicule",      model:"YOLOv11",   included:true  },
      { label:"Détection intrusion",     model:"YOLOv11",   included:true  },
      { label:"Suivi multi-objets",      model:"ByteTrack", included:true  },
      { label:"Alertes push/email",      model:"—",         included:true  },
      { label:"Rapports PDF",            model:"—",         included:true  },
      { label:"Clip vidéo 12s",          model:"—",         included:true  },
      { label:"Mode nuit",               model:"—",         included:false },
    ],
  },

  // ── Retail ────────────────────────────────────────────────────────────────
  {
    id:"retail", name:"Retail Intelligence", icon:"🛒", sector:"Commerce",
    tagline:"Prévention des pertes & analytics client",
    description:"Surveillance commerciale avancée. Détecte vols, rayons vides, compte clients et lit les codes-barres.",
    status:"beta", minPlan:"pro", price:null,
    color:"#10B981",
    models:["yolov11","sam2","paddleocr","bytetrack","clip"],
    detectionClasses:["person","shoplifting","empty_shelf","barcode","qr_code","cashier","cart"],
    workflow:["Caméra","YOLOv11 Détection","SAM Segmentation","PaddleOCR Lecture","ByteTrack Comptage","CLIP Analyse","Events","Analytics Retail","Rapports Inventaire"],
    features:[
      { label:"Détection vol",           model:"YOLOv11",   included:true  },
      { label:"Rayon vide",              model:"YOLOv11",   included:true  },
      { label:"Comptage clients",        model:"ByteTrack", included:true  },
      { label:"Lecture barcode/QR",      model:"PaddleOCR", included:true  },
      { label:"Segmentation produits",   model:"SAM 2",     included:true  },
      { label:"Analyse planogramme",     model:"CLIP",      included:true  },
      { label:"Analytics flux clients",  model:"ByteTrack", included:true  },
      { label:"Monitoring caissier",     model:"YOLOv11",   included:true  },
      { label:"Self-checkout monitor",   model:"YOLOv11",   included:true  },
      { label:"Inventaire automatique",  model:"CLIP",      included:false },
    ],
  },

  // ── Construction ──────────────────────────────────────────────────────────
  {
    id:"construction", name:"Construction Safety", icon:"🏗️", sector:"Construction",
    tagline:"Zéro accident sur le chantier",
    description:"Sécurité chantier IA. Détecte violations EPI, chutes, zones dangereuses et engins.",
    status:"beta", minPlan:"business", price:null,
    color:"#F59E0B",
    models:["yolov11","sam2","bytetrack"],
    detectionClasses:["helmet","safety_vest","safety_glasses","fall_detection","danger_zone","crane","forklift","ppe_violation"],
    workflow:["Caméra","YOLOv11 EPI Detection","SAM Zone Segmentation","ByteTrack Personnel","Events Critiques","Alertes SMS","Rapports Sécurité"],
    features:[
      { label:"Détection casque",        model:"YOLOv11",   included:true  },
      { label:"Détection gilet sécurité",model:"YOLOv11",   included:true  },
      { label:"Détection lunettes",      model:"YOLOv11",   included:true  },
      { label:"Détection chute",         model:"YOLOv11",   included:true  },
      { label:"Zones dangereuses",       model:"SAM 2",     included:true  },
      { label:"Suivi engins",            model:"ByteTrack", included:true  },
      { label:"Détection grue",          model:"YOLOv11",   included:true  },
      { label:"Analytics EPI",           model:"—",         included:true  },
      { label:"Rapport conformité",      model:"—",         included:true  },
      { label:"Alertes temps réel",      model:"—",         included:true  },
    ],
  },

  // ── Industrial ────────────────────────────────────────────────────────────
  {
    id:"industrial", name:"Industrial Safety", icon:"🏭", sector:"Industrie",
    tagline:"Sécurité industrielle & maintenance prédictive",
    description:"Détection feu, fumée, gaz, fuites et monitoring des machines.",
    status:"beta", minPlan:"business", price:null,
    color:"#EF4444",
    models:["yolov11","sam2"],
    detectionClasses:["fire","smoke","gas","leak","forklift","machine","temperature","person","ppe_violation"],
    workflow:["Caméra","YOLOv11 Détection","SAM Segmentation","Analyse Thermique","Events Critiques","Alertes SMS/Email","Maintenance Log"],
    features:[
      { label:"Détection feu/flamme",    model:"YOLOv11",   included:true  },
      { label:"Détection fumée",         model:"YOLOv11",   included:true  },
      { label:"Détection gaz/fuite",     model:"YOLOv11",   included:true  },
      { label:"Monitoring machines",     model:"YOLOv11",   included:true  },
      { label:"Suivi chariots",          model:"ByteTrack", included:true  },
      { label:"Zones de sécurité",       model:"SAM 2",     included:true  },
      { label:"Maintenance prédictive",  model:"—",         included:false },
      { label:"Support caméra thermique",model:"—",         included:false },
      { label:"Analytics production",    model:"—",         included:true  },
      { label:"Rapports incidents",      model:"—",         included:true  },
    ],
  },

  // ── Agriculture ───────────────────────────────────────────────────────────
  {
    id:"agriculture", name:"AgriGuard", icon:"🌾", sector:"Agriculture",
    tagline:"Protégez vos cultures et vos troupeaux",
    description:"Surveillance agricole. Détecte animaux, prédateurs, irrigation et maladies des cultures.",
    status:"coming_soon", minPlan:"pro", price:null,
    color:"#84CC16",
    models:["yolov11","clip"],
    detectionClasses:["animal","predator","person","vehicle","crop_disease","irrigation","bird","cattle"],
    workflow:["Caméra","YOLOv11 Détection","CLIP Analyse Cultures","Events","Alertes","Rapports Agricoles"],
    features:[
      { label:"Détection troupeaux",     model:"YOLOv11",   included:true  },
      { label:"Détection prédateurs",    model:"YOLOv11",   included:true  },
      { label:"Monitoring périmètre",    model:"YOLOv11",   included:true  },
      { label:"Analyse cultures",        model:"CLIP",      included:true  },
      { label:"Détection maladies",      model:"CLIP",      included:true  },
      { label:"Tracking véhicules",      model:"ByteTrack", included:true  },
      { label:"Monitoring irrigation",   model:"—",         included:false },
      { label:"Rapports récolte",        model:"—",         included:true  },
    ],
  },

  // ── Transportation ────────────────────────────────────────────────────────
  {
    id:"transportation", name:"TrafficGuard", icon:"🚗", sector:"Transport",
    tagline:"Intelligence urbaine & gestion du trafic",
    description:"Surveillance routière. Lecture de plaques, comptage véhicules, parking et infractions.",
    status:"coming_soon", minPlan:"business", price:null,
    color:"#8B5CF6",
    models:["yolov11","paddleocr","bytetrack"],
    detectionClasses:["car","truck","bus","motorcycle","bicycle","license_plate","pedestrian","parking"],
    workflow:["Caméra","YOLOv11 Détection","PaddleOCR Plaques","ByteTrack Comptage","Analytics Trafic","Rapports"],
    features:[
      { label:"Détection véhicules",     model:"YOLOv11",   included:true  },
      { label:"Lecture plaques OCR",     model:"PaddleOCR", included:true  },
      { label:"Comptage trafic",         model:"ByteTrack", included:true  },
      { label:"Détection infractions",   model:"YOLOv11",   included:true  },
      { label:"Gestion parking",         model:"YOLOv11",   included:true  },
      { label:"Détection vitesse",       model:"—",         included:false },
      { label:"Heatmap trafic",          model:"—",         included:true  },
      { label:"Rapports municipaux",     model:"—",         included:true  },
    ],
  },

  // ── Smart City ────────────────────────────────────────────────────────────
  {
    id:"smart_city", name:"Smart City", icon:"🌆", sector:"Ville intelligente",
    tagline:"Intelligence urbaine à grande échelle",
    description:"Gestion intelligente de la ville. Flux piétons, sécurité publique et gestion des espaces.",
    status:"coming_soon", minPlan:"enterprise", price:null,
    color:"#06B6D4",
    models:["yolov11","bytetrack","clip","paddleocr"],
    detectionClasses:["person","vehicle","crowd","incident","waste","graffiti"],
    workflow:["Multi-Caméras","AI Orchestrator","YOLOv11+ByteTrack","Analyse Scène CLIP","City Analytics","Dashboard Ville"],
    features:[
      { label:"Analyse flux piétons",    model:"ByteTrack", included:true  },
      { label:"Détection incidents",     model:"YOLOv11",   included:true  },
      { label:"Gestion foules",          model:"ByteTrack", included:true  },
      { label:"Surveillance espaces",    model:"CLIP",      included:true  },
      { label:"Détection graffiti",      model:"YOLOv11",   included:false },
      { label:"Analytics urbains",       model:"—",         included:true  },
      { label:"Dashboard ville",         model:"—",         included:true  },
      { label:"API municipale",          model:"—",         included:true  },
    ],
  },


  // ── Agriculture / AgriGuard ──────────────────────────────────────────────────
  {
    id:"agriculture", name:"AgriGuard AI", icon:"🌾", sector:"Agriculture",
    tagline:"Protégez vos cultures, bétail et exploitations 24h/7j",
    description:"Surveillance IA complète pour fermes, élevages, serres et exploitations.",
    status:"available", minPlan:"pro", price:null, color:"#84CC16",
    models:["yolov11","sam2","grounding_dino","florence2","paddleocr","clip","bytetrack","llama3"],
    detectionClasses:["person","cow","horse","sheep","pig","chicken","dog","cat","car","fire","smoke"],
    workflow:["Caméra","YOLOv11","Grounding DINO","Florence-2","ByteTrack","Events","Alertes"],
    features:[
      {label:"Comptage bétail temps réel", model:"YOLOv11+ByteTrack",included:true},
      {label:"Détection intrus",           model:"YOLOv11",          included:true},
      {label:"Détection prédateurs",       model:"YOLOv11",          included:true},
      {label:"Détection feu/fumée",        model:"YOLOv11",          included:true},
      {label:"Analyse cultures",           model:"Florence-2",       included:false},
    ],
    popular:false,
  },

  // ── Defense ───────────────────────────────────────────────────────────────
  {
    id:"defense", name:"Defense Shield", icon:"🛡️", sector:"Défense",
    tagline:"Sécurité périmétrique critique",
    description:"Surveillance militaire et infrastructures critiques. Drones, armes, vision thermique.",
    status:"enterprise", minPlan:"enterprise", price:null,
    color:"#374151",
    models:["yolov11","bytetrack","grounding_dino"],
    detectionClasses:["drone","weapon","person","vehicle","perimeter","intruder"],
    workflow:["Multi-Caméras Thermiques","AI Orchestrator","YOLOv11 Spécialisé","Grounding DINO","ByteTrack","Alertes Critiques","Command Center"],
    features:[
      { label:"Détection drones",        model:"YOLOv11",   included:true  },
      { label:"Détection armes",         model:"YOLOv11",   included:true  },
      { label:"Sécurité périmètre",      model:"YOLOv11",   included:true  },
      { label:"Vision thermique",        model:"—",         included:true  },
      { label:"Vision nocturne",         model:"—",         included:true  },
      { label:"Tracking multi-caméras",  model:"ByteTrack", included:true  },
      { label:"Open-vocabulary detection",model:"Grounding DINO",included:false},
      { label:"Déploiement on-premise",  model:"—",         included:true  },
    ],
  },
,

  // ── Energy ────────────────────────────────────────────────────────────────────
  {
    id:"energy", name:"EnergyGuard AI", icon:"⚡", sector:"Énergie",
    tagline:"Sécurisez vos infrastructures énergétiques critiques",
    description:"IA pour centrales électriques, barrages, éoliennes, panneaux solaires, pipelines et réseaux. Maintenance prédictive et sécurité périmétrique.",
    status:"coming_soon", minPlan:"enterprise", price:null,
    color:"#F59E0B",
    models:["yolov11","sam2","grounding_dino","florence2","paddleocr","bytetrack","clip","llama3"],
    detectionClasses:["person","fire","smoke","car","drone"],
    workflow:["Multi-Caméras","AI Orchestrator","YOLOv11+SAM2","Analyse Thermique","Firebase Events","Alertes critiques","Maintenance prédictive"],
    features:[
      {label:"Détection feu/fumée/gaz",        model:"YOLOv11",      included:true},
      {label:"Anomalies équipements",           model:"YOLOv11+CLIP", included:true},
      {label:"Maintenance prédictive",          model:"Florence-2",   included:false},
      {label:"Détection drones non autorisés",  model:"YOLOv11",      included:true},
      {label:"Surveillance périmètre 24/7",     model:"ByteTrack",    included:true},
      {label:"Points chauds thermiques",        model:"Thermique",    included:false},
      {label:"Rapports HSE Énergie",            model:"LLM",          included:true},
    ],
    popular:false,
  },

  // ── EnergyGuard ──────────────────────────────────────────────────────────────
  {
    id:"energy", name:"EnergyGuard AI", icon:"⚡", sector:"Énergie",
    tagline:"Sécurisez vos infrastructures énergétiques critiques",
    description:"IA pour centrales, barrages, éoliennes, panneaux solaires et pipelines.",
    status:"coming_soon", minPlan:"enterprise", price:null, color:"#F59E0B",
    models:["yolov11","sam2","grounding_dino","florence2","bytetrack","clip","llama3"],
    detectionClasses:["person","fire","smoke","car","drone"],
    workflow:["Multi-Caméras","YOLOv11+SAM2","Analyse Thermique","Events","Alertes","Maintenance"],
    features:[
      {label:"Détection feu/fumée/gaz",       model:"YOLOv11",     included:true},
      {label:"Anomalies équipements",          model:"YOLOv11",     included:true},
      {label:"Drones non autorisés",           model:"YOLOv11",     included:true},
      {label:"Maintenance prédictive",         model:"Florence-2",  included:false},
      {label:"Rapports HSE Énergie",           model:"LLM",         included:true},
    ],
    popular:false,
  },
];
// ── Helpers exportés ──────────────────────────────────────────────────────────

export const BUNDLE_STATUS_LABELS: Record<BundleStatus, {label:string;color:string;bg:string}> = {
  available:   {label:"Disponible",  color:"#10B981", bg:"#10B98120"},
  beta:        {label:"Bêta",        color:"#F59E0B", bg:"#F59E0B20"},
  coming_soon: {label:"Bientôt",     color:"#64748B", bg:"#64748B20"},
  enterprise:  {label:"Entreprise",  color:"#8B5CF6", bg:"#8B5CF620"},
};

export function getBundleById(id: string): AIBundle | undefined {
  return (AI_BUNDLES as any[]).find(b => b && b.id === id) as AIBundle | undefined;
}

export function getBundlesByStatus(status: BundleStatus): AIBundle[] {
  return (AI_BUNDLES as any[]).filter(b => b && b.status === status) as AIBundle[];
}
