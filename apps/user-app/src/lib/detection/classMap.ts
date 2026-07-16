/**
 * Vision Guard — Classification des détections
 *
 * Mappe les 80 classes COCO-SSD (et les classes custom YOLO)
 * vers les catégories Vision Guard avec couleurs, icônes et sévérité.
 */

export type VGCategory =
  | "human"
  | "animal"
  | "vehicle"
  | "fire"
  | "smoke"
  | "retail_item"
  | "tool"
  | "electronic"
  | "furniture"
  | "food"
  | "sport"
  | "bag"
  | "unknown";

export interface ClassDefinition {
  category:   VGCategory;
  label:      string;     // Label affiché
  icon:       string;
  color:      string;     // hex
  severity:   "critical" | "warning" | "info";
  /** Si true → alerte push même en mode info */
  alertable:  boolean;
}

/** Mapping COCO 80 classes + classes custom YOLO → Vision Guard */
export const CLASS_MAP: Record<string, ClassDefinition> = {
  // ── Humain ──────────────────────────────────────────────────────────────
  person:           { category:"human",        label:"Personne",          icon:"🧍", color:"#0EA5E9", severity:"warning",  alertable:true  },

  // ── Animaux ─────────────────────────────────────────────────────────────
  cat:              { category:"animal",        label:"Chat",              icon:"🐈", color:"#F59E0B", severity:"info",     alertable:false },
  dog:              { category:"animal",        label:"Chien",             icon:"🐕", color:"#F59E0B", severity:"info",     alertable:false },
  bird:             { category:"animal",        label:"Oiseau",            icon:"🐦", color:"#FCD34D", severity:"info",     alertable:false },
  horse:            { category:"animal",        label:"Cheval",            icon:"🐎", color:"#D97706", severity:"info",     alertable:false },
  sheep:            { category:"animal",        label:"Mouton",            icon:"🐑", color:"#F3F4F6", severity:"info",     alertable:false },
  cow:              { category:"animal",        label:"Vache",             icon:"🐄", color:"#92400E", severity:"info",     alertable:false },
  elephant:         { category:"animal",        label:"Éléphant",          icon:"🐘", color:"#6B7280", severity:"warning",  alertable:true  },
  bear:             { category:"animal",        label:"Ours",              icon:"🐻", color:"#78350F", severity:"critical", alertable:true  },
  zebra:            { category:"animal",        label:"Zèbre",             icon:"🦓", color:"#1F2937", severity:"info",     alertable:false },
  giraffe:          { category:"animal",        label:"Girafe",            icon:"🦒", color:"#D97706", severity:"info",     alertable:false },

  // ── Véhicules ────────────────────────────────────────────────────────────
  bicycle:          { category:"vehicle",       label:"Vélo",              icon:"🚲", color:"#8B5CF6", severity:"info",     alertable:false },
  car:              { category:"vehicle",       label:"Voiture",           icon:"🚗", color:"#8B5CF6", severity:"info",     alertable:false },
  motorcycle:       { category:"vehicle",       label:"Moto",              icon:"🏍️", color:"#7C3AED", severity:"warning",  alertable:true  },
  airplane:         { category:"vehicle",       label:"Avion",             icon:"✈️", color:"#6D28D9", severity:"info",     alertable:false },
  bus:              { category:"vehicle",       label:"Bus",               icon:"🚌", color:"#5B21B6", severity:"info",     alertable:false },
  train:            { category:"vehicle",       label:"Train",             icon:"🚂", color:"#4C1D95", severity:"info",     alertable:false },
  truck:            { category:"vehicle",       label:"Camion",            icon:"🚛", color:"#6D28D9", severity:"warning",  alertable:true  },
  boat:             { category:"vehicle",       label:"Bateau",            icon:"⛵", color:"#1D4ED8", severity:"info",     alertable:false },

  // ── Feu / Fumée (classes custom YOLOv11) ─────────────────────────────────
  fire:             { category:"fire",          label:"Feu",               icon:"🔥", color:"#EF4444", severity:"critical", alertable:true  },
  smoke:            { category:"smoke",         label:"Fumée",             icon:"💨", color:"#F97316", severity:"critical", alertable:true  },
  flame:            { category:"fire",          label:"Flamme",            icon:"🔥", color:"#EF4444", severity:"critical", alertable:true  },

  // ── Retail / Nourriture ──────────────────────────────────────────────────
  bottle:           { category:"retail_item",   label:"Bouteille",         icon:"🍾", color:"#10B981", severity:"info",     alertable:false },
  "wine glass":     { category:"retail_item",   label:"Verre",             icon:"🍷", color:"#10B981", severity:"info",     alertable:false },
  cup:              { category:"retail_item",   label:"Tasse",             icon:"☕", color:"#10B981", severity:"info",     alertable:false },
  fork:             { category:"tool",          label:"Fourchette",        icon:"🍴", color:"#6B7280", severity:"info",     alertable:false },
  knife:            { category:"tool",          label:"Couteau",           icon:"🔪", color:"#EF4444", severity:"warning",  alertable:true  },
  spoon:            { category:"tool",          label:"Cuillère",          icon:"🥄", color:"#6B7280", severity:"info",     alertable:false },
  bowl:             { category:"retail_item",   label:"Bol",               icon:"🥣", color:"#10B981", severity:"info",     alertable:false },
  banana:           { category:"food",          label:"Banane",            icon:"🍌", color:"#FCD34D", severity:"info",     alertable:false },
  apple:            { category:"food",          label:"Pomme",             icon:"🍎", color:"#EF4444", severity:"info",     alertable:false },
  sandwich:         { category:"food",          label:"Sandwich",          icon:"🥪", color:"#D97706", severity:"info",     alertable:false },
  orange:           { category:"food",          label:"Orange",            icon:"🍊", color:"#F97316", severity:"info",     alertable:false },
  broccoli:         { category:"food",          label:"Brocoli",           icon:"🥦", color:"#10B981", severity:"info",     alertable:false },
  carrot:           { category:"food",          label:"Carotte",           icon:"🥕", color:"#F97316", severity:"info",     alertable:false },
  "hot dog":        { category:"food",          label:"Hot-dog",           icon:"🌭", color:"#D97706", severity:"info",     alertable:false },
  pizza:            { category:"food",          label:"Pizza",             icon:"🍕", color:"#D97706", severity:"info",     alertable:false },
  donut:            { category:"food",          label:"Donut",             icon:"🍩", color:"#F472B6", severity:"info",     alertable:false },
  cake:             { category:"food",          label:"Gâteau",            icon:"🎂", color:"#F472B6", severity:"info",     alertable:false },

  // ── Électronique ─────────────────────────────────────────────────────────
  tv:               { category:"electronic",    label:"Télévision",        icon:"📺", color:"#3B82F6", severity:"info",     alertable:false },
  laptop:           { category:"electronic",    label:"Ordinateur",        icon:"💻", color:"#3B82F6", severity:"info",     alertable:false },
  mouse:            { category:"electronic",    label:"Souris",            icon:"🖱️", color:"#3B82F6", severity:"info",     alertable:false },
  remote:           { category:"electronic",    label:"Télécommande",      icon:"📡", color:"#3B82F6", severity:"info",     alertable:false },
  keyboard:         { category:"electronic",    label:"Clavier",           icon:"⌨️", color:"#3B82F6", severity:"info",     alertable:false },
  "cell phone":     { category:"electronic",    label:"Téléphone",         icon:"📱", color:"#3B82F6", severity:"info",     alertable:false },
  microwave:        { category:"electronic",    label:"Micro-ondes",       icon:"📻", color:"#6B7280", severity:"info",     alertable:false },
  oven:             { category:"electronic",    label:"Four",              icon:"🫕", color:"#6B7280", severity:"info",     alertable:false },
  toaster:          { category:"electronic",    label:"Grille-pain",       icon:"🍞", color:"#6B7280", severity:"info",     alertable:false },
  refrigerator:     { category:"electronic",    label:"Réfrigérateur",     icon:"🧊", color:"#06B6D4", severity:"info",     alertable:false },

  // ── Mobilier ─────────────────────────────────────────────────────────────
  chair:            { category:"furniture",     label:"Chaise",            icon:"🪑", color:"#92400E", severity:"info",     alertable:false },
  couch:            { category:"furniture",     label:"Canapé",            icon:"🛋️", color:"#92400E", severity:"info",     alertable:false },
  "potted plant":   { category:"furniture",     label:"Plante",            icon:"🪴", color:"#10B981", severity:"info",     alertable:false },
  bed:              { category:"furniture",     label:"Lit",               icon:"🛏️", color:"#92400E", severity:"info",     alertable:false },
  "dining table":   { category:"furniture",     label:"Table",             icon:"🪵", color:"#92400E", severity:"info",     alertable:false },
  toilet:           { category:"furniture",     label:"Toilettes",         icon:"🚽", color:"#6B7280", severity:"info",     alertable:false },
  sink:             { category:"furniture",     label:"Évier",             icon:"🚿", color:"#6B7280", severity:"info",     alertable:false },

  // ── Outils / Sport ───────────────────────────────────────────────────────
  scissors:         { category:"tool",          label:"Ciseaux",           icon:"✂️", color:"#EF4444", severity:"info",     alertable:false },
  "baseball bat":   { category:"sport",         label:"Batte de baseball", icon:"⚾", color:"#D97706", severity:"warning",  alertable:true  },
  "sports ball":    { category:"sport",         label:"Ballon",            icon:"⚽", color:"#10B981", severity:"info",     alertable:false },
  skateboard:       { category:"sport",         label:"Skateboard",        icon:"🛹", color:"#8B5CF6", severity:"info",     alertable:false },
  surfboard:        { category:"sport",         label:"Planche de surf",   icon:"🏄", color:"#0EA5E9", severity:"info",     alertable:false },
  "tennis racket":  { category:"sport",         label:"Raquette",          icon:"🎾", color:"#10B981", severity:"info",     alertable:false },
  skis:             { category:"sport",         label:"Skis",              icon:"⛷️", color:"#0EA5E9", severity:"info",     alertable:false },
  kite:             { category:"sport",         label:"Cerf-volant",       icon:"🪁", color:"#F59E0B", severity:"info",     alertable:false },

  // ── Sacs / Accessoires ───────────────────────────────────────────────────
  backpack:         { category:"bag",           label:"Sac à dos",         icon:"🎒", color:"#6B7280", severity:"info",     alertable:false },
  umbrella:         { category:"bag",           label:"Parapluie",         icon:"☂️", color:"#6B7280", severity:"info",     alertable:false },
  handbag:          { category:"bag",           label:"Sac à main",        icon:"👜", color:"#EC4899", severity:"info",     alertable:false },
  suitcase:         { category:"bag",           label:"Valise",            icon:"🧳", color:"#6B7280", severity:"info",     alertable:false },

  // ── Divers ───────────────────────────────────────────────────────────────
  "traffic light":  { category:"vehicle",       label:"Feu tricolore",     icon:"🚦", color:"#10B981", severity:"info",     alertable:false },
  "stop sign":      { category:"vehicle",       label:"Stop",              icon:"🛑", color:"#EF4444", severity:"info",     alertable:false },
  "parking meter":  { category:"vehicle",       label:"Parcmètre",         icon:"🅿️", color:"#6B7280", severity:"info",     alertable:false },
  bench:            { category:"furniture",     label:"Banc",              icon:"🪑", color:"#92400E", severity:"info",     alertable:false },
  clock:            { category:"electronic",    label:"Horloge",           icon:"🕐", color:"#6B7280", severity:"info",     alertable:false },
  vase:             { category:"retail_item",   label:"Vase",              icon:"🏺", color:"#6B7280", severity:"info",     alertable:false },
  "teddy bear":     { category:"retail_item",   label:"Peluche",           icon:"🧸", color:"#D97706", severity:"info",     alertable:false },
  "hair drier":     { category:"tool",          label:"Sèche-cheveux",     icon:"💨", color:"#6B7280", severity:"info",     alertable:false },
  toothbrush:       { category:"tool",          label:"Brosse à dents",    icon:"🪥", color:"#6B7280", severity:"info",     alertable:false },
  book:             { category:"retail_item",   label:"Livre",             icon:"📚", color:"#8B5CF6", severity:"info",     alertable:false },
  tie:              { category:"bag",           label:"Cravate",           icon:"👔", color:"#6B7280", severity:"info",     alertable:false },

  // ── Classes custom Vision Guard (YOLOv11 fine-tuned) ─────────────────────
  ppe_violation:    { category:"human",         label:"Violation EPI",     icon:"⛑️", color:"#EF4444", severity:"critical", alertable:true  },
  fall_detection:   { category:"human",         label:"Chute détectée",    icon:"⚠️", color:"#EF4444", severity:"critical", alertable:true  },
  shoplifting:      { category:"human",         label:"Vol potentiel",     icon:"🚨", color:"#EF4444", severity:"critical", alertable:true  },
  empty_shelf:      { category:"retail_item",   label:"Rayon vide",        icon:"📦", color:"#F59E0B", severity:"warning",  alertable:true  },
  drone:            { category:"vehicle",       label:"Drone",             icon:"🚁", color:"#EF4444", severity:"critical", alertable:true  },
  weapon:           { category:"tool",          label:"Arme",              icon:"⚠️", color:"#EF4444", severity:"critical", alertable:true  },
};

/** Catégorie inconnue (fallback) */
export const UNKNOWN_CLASS: ClassDefinition = {
  category:"unknown", label:"Objet", icon:"📦", color:"#64748B", severity:"info", alertable:false,
};

/** Obtenir la définition d'une classe par son nom */
export function getClassDef(className: string): ClassDefinition {
  const key = className.toLowerCase();
  return CLASS_MAP[key] ?? UNKNOWN_CLASS;
}

/** Labels des catégories pour l'UI */
export const CATEGORY_LABELS: Record<VGCategory, { label: string; icon: string; color: string }> = {
  human:        { label:"Humain",      icon:"🧍", color:"#0EA5E9" },
  animal:       { label:"Animal",      icon:"🐾", color:"#F59E0B" },
  vehicle:      { label:"Véhicule",    icon:"🚗", color:"#8B5CF6" },
  fire:         { label:"Feu",         icon:"🔥", color:"#EF4444" },
  smoke:        { label:"Fumée",       icon:"💨", color:"#F97316" },
  retail_item:  { label:"Retail",      icon:"🛍️", color:"#10B981" },
  tool:         { label:"Outil",       icon:"🔧", color:"#6B7280" },
  electronic:   { label:"Électronique",icon:"💻", color:"#3B82F6" },
  furniture:    { label:"Mobilier",    icon:"🪑", color:"#92400E" },
  food:         { label:"Nourriture",  icon:"🍎", color:"#EC4899" },
  sport:        { label:"Sport",       icon:"⚽", color:"#34D399" },
  bag:          { label:"Sac",         icon:"🎒", color:"#A78BFA" },
  unknown:      { label:"Inconnu",     icon:"📦", color:"#64748B" },
};
