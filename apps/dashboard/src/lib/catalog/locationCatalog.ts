/**
 * Vision Guard — Camera Location Catalog
 * Architecture 5 niveaux : Secteur → Type → Zone → Emplacement → Caméra
 */

export interface LocationItem {
  id:    string;
  label: string;
  icon?: string;
}

export interface LocationZone {
  id:          string;
  label:       string;
  emplacements: LocationItem[];
}

export interface LocationType {
  id:    string;
  label: string;
  zones: LocationZone[];
}

export interface LocationSector {
  id:    string;
  label: string;
  icon:  string;
  color: string;
  types: LocationType[];
}

export const LOCATION_CATALOG: LocationSector[] = [
  // ── 🏠 Résidentiel ─────────────────────────────────────────────────────────
  {
    id:"residential", label:"Résidentiel", icon:"🏠", color:"#0EA5E9",
    types: [
      {
        id:"exterior", label:"Extérieur",
        zones: [
          { id:"entrance", label:"Entrées", emplacements:[
            {id:"front_door",    label:"Porte avant"},
            {id:"back_door",     label:"Porte arrière"},
            {id:"side_door",     label:"Porte latérale"},
            {id:"main_entrance", label:"Entrée principale"},
            {id:"gate",          label:"Portail"},
          ]},
          { id:"garage", label:"Garage", emplacements:[
            {id:"garage_interior", label:"Garage intérieur"},
            {id:"garage_exterior", label:"Garage extérieur"},
            {id:"garage_door",     label:"Porte de garage"},
            {id:"driveway",        label:"Allée"},
            {id:"carport",         label:"Abri d'auto"},
          ]},
          { id:"yard", label:"Cour & Jardin", emplacements:[
            {id:"front_yard",  label:"Cour avant"},
            {id:"backyard",    label:"Cour arrière"},
            {id:"garden",      label:"Jardin"},
            {id:"terrace",     label:"Terrasse"},
            {id:"patio",       label:"Patio"},
            {id:"pool",        label:"Piscine"},
          ]},
          { id:"perimeter", label:"Périmètre", emplacements:[
            {id:"fence_north", label:"Clôture Nord"},
            {id:"fence_south", label:"Clôture Sud"},
            {id:"fence_east",  label:"Clôture Est"},
            {id:"fence_west",  label:"Clôture Ouest"},
            {id:"mailbox",     label:"Boîte aux lettres"},
            {id:"shed",        label:"Remise / Cabanon"},
            {id:"parking",     label:"Stationnement"},
            {id:"balcony",     label:"Balcon"},
          ]},
        ],
      },
      {
        id:"interior", label:"Intérieur",
        zones: [
          { id:"common", label:"Espaces communs", emplacements:[
            {id:"hall",         label:"Hall d'entrée"},
            {id:"living_room",  label:"Salon"},
            {id:"dining_room",  label:"Salle à manger"},
            {id:"kitchen",      label:"Cuisine"},
            {id:"pantry",       label:"Garde-manger"},
            {id:"corridor",     label:"Couloir"},
            {id:"staircase",    label:"Escalier"},
          ]},
          { id:"private", label:"Espaces privés", emplacements:[
            {id:"master_bedroom", label:"Chambre principale"},
            {id:"bedroom_1",      label:"Chambre 1"},
            {id:"bedroom_2",      label:"Chambre 2"},
            {id:"bedroom_3",      label:"Chambre 3"},
            {id:"office",         label:"Bureau"},
            {id:"bathroom",       label:"Salle de bain"},
          ]},
          { id:"utility", label:"Utilitaires", emplacements:[
            {id:"basement",     label:"Sous-sol"},
            {id:"laundry",      label:"Salle de lavage"},
            {id:"game_room",    label:"Salle de jeux"},
            {id:"cinema_room",  label:"Salle de cinéma"},
            {id:"gym",          label:"Gym"},
            {id:"workshop",     label:"Atelier"},
            {id:"wine_cellar",  label:"Cave"},
          ]},
        ],
      },
    ],
  },

  // ── 🏢 Bureau ───────────────────────────────────────────────────────────────
  {
    id:"office", label:"Bureau", icon:"🏢", color:"#8B5CF6",
    types: [
      {
        id:"entrances", label:"Entrées",
        zones: [
          { id:"entry", label:"Accès", emplacements:[
            {id:"main_entrance",  label:"Entrée principale"},
            {id:"staff_entrance", label:"Entrée employés"},
            {id:"reception",      label:"Réception"},
            {id:"hall",           label:"Hall"},
          ]},
        ],
      },
      {
        id:"workspaces", label:"Espaces de travail",
        zones: [
          { id:"offices", label:"Bureaux", emplacements:[
            {id:"dir_office",  label:"Bureau Direction"},
            {id:"accounting",  label:"Bureau Comptabilité"},
            {id:"hr",          label:"Bureau RH"},
            {id:"it",          label:"Bureau Informatique"},
            {id:"meeting_1",   label:"Salle de réunion 1"},
            {id:"meeting_2",   label:"Salle de réunion 2"},
            {id:"meeting_3",   label:"Salle de réunion 3"},
            {id:"open_space",  label:"Open Space"},
            {id:"server_room", label:"Salle Serveur"},
            {id:"archives",    label:"Archives"},
          ]},
          { id:"common", label:"Espaces communs", emplacements:[
            {id:"cafeteria",  label:"Cafétéria"},
            {id:"kitchen",    label:"Cuisine"},
            {id:"corridor_a", label:"Corridor A"},
            {id:"corridor_b", label:"Corridor B"},
            {id:"staircase",  label:"Escalier"},
            {id:"elevator",   label:"Ascenseur"},
            {id:"parking",    label:"Parking"},
            {id:"loading",    label:"Quai livraison"},
          ]},
        ],
      },
    ],
  },

  // ── 🏪 Commerce ─────────────────────────────────────────────────────────────
  {
    id:"retail", label:"Commerce / Magasin", icon:"🏪", color:"#10B981",
    types: [
      {
        id:"storefront", label:"Devanture",
        zones: [
          { id:"front", label:"Façade", emplacements:[
            {id:"window_left",    label:"Vitrine gauche"},
            {id:"window_right",   label:"Vitrine droite"},
            {id:"entrance",       label:"Entrée"},
            {id:"exit",           label:"Sortie"},
          ]},
        ],
      },
      {
        id:"checkout", label:"Caisses",
        zones: [
          { id:"checkout_zone", label:"Zone caisse", emplacements:
            Array.from({length:10},(_,i)=>({id:`checkout_${i+1}`,label:`Caisse ${i+1}`}))
            .concat([
              {id:"self_checkout_1", label:"Libre-service 1"},
              {id:"self_checkout_2", label:"Libre-service 2"},
              {id:"customer_service",label:"Service client"},
            ]),
          },
        ],
      },
      {
        id:"store_floor", label:"Surface de vente",
        zones: [
          { id:"aisles", label:"Allées", emplacements:[
            {id:"main_aisle", label:"Allée centrale"},
            {id:"aisle_a",    label:"Allée A"},
            {id:"aisle_b",    label:"Allée B"},
            {id:"aisle_c",    label:"Allée C"},
            {id:"aisle_d",    label:"Allée D"},
            {id:"promo_area", label:"Rayon Promo"},
          ]},
          { id:"back", label:"Arrière-boutique", emplacements:[
            {id:"stockroom",  label:"Réserve"},
            {id:"office",     label:"Bureau"},
            {id:"loading",    label:"Quai livraison"},
            {id:"parking",    label:"Parking"},
          ]},
        ],
      },
    ],
  },

  // ── 🛒 Supermarché ──────────────────────────────────────────────────────────
  {
    id:"supermarket", label:"Supermarché", icon:"🛒", color:"#F59E0B",
    types: [
      {
        id:"entries", label:"Entrées & Sorties",
        zones: [
          { id:"doors", label:"Portes", emplacements:[
            {id:"door_1",    label:"Porte 1"},
            {id:"door_2",    label:"Porte 2"},
            {id:"door_3",    label:"Porte 3"},
            {id:"exit_1",    label:"Sortie principale"},
            {id:"delivery",  label:"Porte Livraison"},
          ]},
        ],
      },
      {
        id:"departments", label:"Rayons",
        zones: [
          { id:"fresh", label:"Produits frais", emplacements:[
            {id:"fruits",      label:"Fruits & Légumes"},
            {id:"meat",        label:"Viandes"},
            {id:"fish",        label:"Poissons"},
            {id:"deli",        label:"Charcuterie"},
            {id:"bakery",      label:"Boulangerie"},
            {id:"pastry",      label:"Pâtisserie"},
            {id:"dairy",       label:"Produits laitiers"},
            {id:"frozen",      label:"Surgelés"},
          ]},
          { id:"beverages", label:"Boissons", emplacements:[
            {id:"water",    label:"Eau"},
            {id:"juice",    label:"Jus"},
            {id:"beer",     label:"Bière"},
            {id:"wine",     label:"Vin"},
            {id:"spirits",  label:"Spiritueux"},
          ]},
          { id:"grocery", label:"Épicerie", emplacements:[
            {id:"canned",     label:"Conserves"},
            {id:"pasta",      label:"Pâtes & Riz"},
            {id:"spices",     label:"Épices"},
            {id:"coffee_tea", label:"Café & Thé"},
            {id:"cereals",    label:"Céréales"},
            {id:"biscuits",   label:"Biscuits"},
            {id:"chocolate",  label:"Chocolats & Confiseries"},
            {id:"organic",    label:"Produits bio"},
          ]},
          { id:"non_food", label:"Non-alimentaire", emplacements:[
            {id:"hygiene",    label:"Hygiène"},
            {id:"cosmetics",  label:"Cosmétique"},
            {id:"pharmacy",   label:"Pharmacie"},
            {id:"pet",        label:"Animalerie"},
            {id:"garden",     label:"Jardin"},
            {id:"electronics",label:"Électronique"},
            {id:"toys",       label:"Jouets"},
            {id:"clothing",   label:"Vêtements"},
          ]},
        ],
      },
      {
        id:"operations", label:"Opérations",
        zones: [
          { id:"stockroom", label:"Réserve", emplacements:[
            {id:"zone_a",label:"Zone A"},{id:"zone_b",label:"Zone B"},
            {id:"zone_c",label:"Zone C"},{id:"zone_d",label:"Zone D"},
          ]},
          { id:"loading", label:"Livraison", emplacements:[
            {id:"dock_1",label:"Quai 1"},{id:"dock_2",label:"Quai 2"},{id:"dock_3",label:"Quai 3"},
          ]},
          { id:"parking_sm", label:"Parking", emplacements:[
            {id:"parking_n",label:"Parking Nord"},{id:"parking_s",label:"Parking Sud"},
            {id:"parking_e",label:"Parking Est"},{id:"parking_w",label:"Parking Ouest"},
          ]},
        ],
      },
    ],
  },

  // ── 🏭 Entrepôt / Industrie ─────────────────────────────────────────────────
  {
    id:"warehouse", label:"Entrepôt / Industrie", icon:"🏭", color:"#EF4444",
    types: [
      {
        id:"access", label:"Accès",
        zones: [
          { id:"gates", label:"Entrées", emplacements:[
            {id:"main_gate",   label:"Entrée principale"},
            {id:"staff_gate",  label:"Entrée employés"},
            {id:"dock_1",      label:"Quai 1"},
            {id:"dock_2",      label:"Quai 2"},
            {id:"dock_3",      label:"Quai 3"},
            {id:"dock_4",      label:"Quai 4"},
          ]},
        ],
      },
      {
        id:"floor", label:"Surface",
        zones: [
          { id:"zones", label:"Zones", emplacements:
            ["A","B","C","D","E","F","G","H"].map(z=>({id:`zone_${z.toLowerCase()}`,label:`Zone ${z}`}))
          },
          { id:"racks", label:"Racks", emplacements:
            ["A","B","C"].flatMap(l=>
              Array.from({length:5},(_,i)=>({id:`rack_${l}${i+1}`,label:`Rack ${l}${i+1}`}))
            ).concat([
              {id:"pallet_zone",label:"Zone palettes"},
              {id:"hazmat",     label:"Zone produits dangereux"},
              {id:"cold_room",  label:"Zone réfrigérée"},
            ])
          },
        ],
      },
      {
        id:"exterior_wh", label:"Extérieur",
        zones: [
          { id:"outdoor", label:"Extérieur", emplacements:[
            {id:"parking",  label:"Parking"},
            {id:"courtyard",label:"Cour"},
            {id:"back",     label:"Derrière bâtiment"},
            {id:"fence",    label:"Clôture"},
            {id:"gate",     label:"Portail"},
          ]},
        ],
      },
    ],
  },

  // ── 🏗️ Construction ─────────────────────────────────────────────────────────
  {
    id:"construction", label:"Chantier / Construction", icon:"🏗️", color:"#F59E0B",
    types: [
      {
        id:"site", label:"Chantier",
        zones: [
          { id:"access_c", label:"Accès", emplacements:[
            {id:"site_entrance", label:"Entrée chantier"},
            {id:"site_office",   label:"Bureau chantier"},
            {id:"site_exit",     label:"Sortie"},
          ]},
          { id:"work_zones", label:"Zones de travail", emplacements:[
            {id:"excavation", label:"Zone Excavation"},
            {id:"formwork",   label:"Zone Coffrage"},
            {id:"concrete",   label:"Zone Béton"},
            {id:"steel",      label:"Zone Acier"},
            {id:"crane",      label:"Zone Grue"},
            {id:"trucks",     label:"Zone Camions"},
            {id:"tools",      label:"Zone Outils"},
            {id:"storage",    label:"Zone Stockage"},
            {id:"waste",      label:"Zone Déchets"},
            {id:"parking_c",  label:"Parking"},
          ]},
        ],
      },
    ],
  },

  // ── 🚦 Transport ────────────────────────────────────────────────────────────
  {
    id:"transportation", label:"Transport", icon:"🚦", color:"#8B5CF6",
    types: [
      {
        id:"station", label:"Gare / Station",
        zones: [
          { id:"platforms", label:"Quais", emplacements:
            Array.from({length:6},(_,i)=>({id:`platform_${i+1}`,label:`Quai ${i+1}`}))
          },
          { id:"facilities", label:"Installations", emplacements:[
            {id:"waiting_room", label:"Salle d'attente"},
            {id:"ticketing",    label:"Billetterie"},
            {id:"corridor",     label:"Corridor"},
            {id:"parking_t",    label:"Parking"},
            {id:"bus_depot",    label:"Dépôt autobus"},
          ]},
        ],
      },
      {
        id:"road", label:"Route / Trafic",
        zones: [
          { id:"intersections", label:"Intersections", emplacements:[
            {id:"intersection_main", label:"Intersection principale"},
            {id:"traffic_light_1",   label:"Feu de circulation 1"},
            {id:"traffic_light_2",   label:"Feu de circulation 2"},
            {id:"pedestrian_cross",  label:"Passage piéton"},
          ]},
          { id:"roads", label:"Voies", emplacements:[
            {id:"road_north",   label:"Voie Nord"},
            {id:"road_south",   label:"Voie Sud"},
            {id:"highway_ramp", label:"Bretelle autoroute"},
            {id:"parking_road", label:"Stationnement rue"},
          ]},
        ],
      },
    ],
  },

  // ── 🏬 Centre Commercial ─────────────────────────────────────────────────────
  {
    id:"mall", label:"Centre Commercial", icon:"🏬", color:"#EC4899",
    types: [
      {
        id:"mall_access", label:"Accès",
        zones: [
          { id:"doors_mall", label:"Portes", emplacements:[
            {id:"north_door",    label:"Porte Nord"},
            {id:"south_door",    label:"Porte Sud"},
            {id:"east_door",     label:"Porte Est"},
            {id:"west_door",     label:"Porte Ouest"},
            {id:"delivery_mall", label:"Porte Livraison"},
          ]},
        ],
      },
      {
        id:"mall_floor", label:"Surfaces",
        zones: [
          { id:"corridors", label:"Corridors", emplacements:[
            {id:"corridor_a",label:"Corridor A"},{id:"corridor_b",label:"Corridor B"},
            {id:"corridor_c",label:"Corridor C"},{id:"corridor_d",label:"Corridor D"},
          ]},
          { id:"common_areas", label:"Aires communes", emplacements:[
            {id:"food_court",  label:"Aire de restauration"},
            {id:"main_hall",   label:"Hall principal"},
            {id:"staircase_m", label:"Escalier"},
            {id:"escalator",   label:"Escalator"},
            {id:"elevator_m",  label:"Ascenseur"},
          ]},
          { id:"services_mall", label:"Services", emplacements:[
            {id:"bank",       label:"Banque"},
            {id:"atm",        label:"ATM"},
            {id:"pharmacy_m", label:"Pharmacie"},
            {id:"security",   label:"Sécurité"},
            {id:"restrooms",  label:"Toilettes"},
          ]},
        ],
      },
      {
        id:"mall_parking", label:"Parking",
        zones: [
          { id:"levels", label:"Niveaux", emplacements:
            Array.from({length:4},(_,i)=>({id:`level_p${i+1}`,label:`Niveau P${i+1}`}))
          },
        ],
      },
    ],
  },

  // ── 🏥 Hôpital / Clinique ───────────────────────────────────────────────────
  {
    id:"hospital", label:"Hôpital / Clinique", icon:"🏥", color:"#EF4444",
    types: [
      {
        id:"hospital_zones", label:"Zones",
        zones: [
          { id:"emergency", label:"Urgences & Soins", emplacements:[
            {id:"er_reception", label:"Réception urgences"},
            {id:"waiting",      label:"Salle d'attente"},
            {id:"or",           label:"Bloc opératoire"},
            {id:"pharmacy_h",   label:"Pharmacie"},
            {id:"radiology",    label:"Radiologie"},
            {id:"lab",          label:"Laboratoire"},
          ]},
          { id:"hospital_common", label:"Circulation", emplacements:[
            {id:"corridor_h",   label:"Corridor"},
            {id:"elevator_h",   label:"Ascenseur"},
            {id:"staircase_h",  label:"Escalier"},
            {id:"parking_h",    label:"Parking"},
            {id:"main_entry_h", label:"Entrée principale"},
          ]},
        ],
      },
    ],
  },

  // ── 🏫 École / Université ───────────────────────────────────────────────────
  {
    id:"school", label:"École / Université", icon:"🏫", color:"#84CC16",
    types: [
      {
        id:"school_zones", label:"Zones",
        zones: [
          { id:"access_s", label:"Accès", emplacements:[
            {id:"main_entry_s",  label:"Entrée principale"},
            {id:"student_entry", label:"Entrée élèves"},
            {id:"parking_s",     label:"Parking"},
          ]},
          { id:"indoor_s", label:"Intérieur", emplacements:[
            {id:"yard",         label:"Cour de récréation"},
            {id:"corridor_sa",  label:"Corridor A"},
            {id:"corridor_sb",  label:"Corridor B"},
            {id:"gym_s",        label:"Gymnase"},
            {id:"library",      label:"Bibliothèque"},
            {id:"cafeteria_s",  label:"Cafétéria"},
          ]},
          { id:"classrooms", label:"Salles", emplacements:
            Array.from({length:10},(_,i)=>({id:`class_${100+i+1}`,label:`Classe ${101+i}`}))
          },
        ],
      },
    ],
  },

  // ── 🛡️ Défense / Militaire ───────────────────────────────────────────────────
  {
    id:"defense", label:"Défense / Militaire", icon:"🛡️", color:"#374151",
    types: [
      {
        id:"perimeter_d", label:"Périmètre",
        zones: [
          { id:"checkpoints", label:"Points de contrôle", emplacements:[
            {id:"main_gate_d",    label:"Porte principale"},
            {id:"checkpoint_a",  label:"Checkpoint Alpha"},
            {id:"checkpoint_b",  label:"Checkpoint Bravo"},
            {id:"perimeter_n",   label:"Périmètre Nord"},
            {id:"perimeter_s",   label:"Périmètre Sud"},
            {id:"perimeter_e",   label:"Périmètre Est"},
            {id:"perimeter_w",   label:"Périmètre Ouest"},
          ]},
          { id:"guard_posts", label:"Postes de garde", emplacements:[
            {id:"guard_n",label:"Tour Nord"},{id:"guard_s",label:"Tour Sud"},
            {id:"guard_e",label:"Tour Est"}, {id:"guard_w",label:"Tour Ouest"},
          ]},
        ],
      },
      {
        id:"base_zones", label:"Zones de base",
        zones: [
          { id:"buildings", label:"Bâtiments", emplacements:[
            {id:"barracks",     label:"Caserne"},
            {id:"armory",       label:"Armurerie"},
            {id:"ammo_depot",   label:"Dépôt munitions"},
            {id:"hangar_1",     label:"Hangar 1"},
            {id:"hangar_2",     label:"Hangar 2"},
            {id:"command",      label:"Centre de commandement"},
            {id:"server_d",     label:"Salle serveurs"},
          ]},
          { id:"outdoor_d", label:"Zones extérieures", emplacements:[
            {id:"drone_zone",  label:"Zone drones"},
            {id:"runway",      label:"Piste"},
            {id:"helipad",     label:"Héliport"},
            {id:"vehicle_bay", label:"Garage véhicules"},
            {id:"maintenance", label:"Zone maintenance"},
            {id:"mil_parking", label:"Parking militaire"},
          ]},
        ],
      },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getSectorById(id: string) {
  return LOCATION_CATALOG.find(s => s.id === id);
}

export function buildCameraName(
  sectorId: string,
  typeId:   string,
  zoneId:   string,
  locationId: string,
  custom?:  string,
): string {
  const sector   = LOCATION_CATALOG.find(s=>s.id===sectorId);
  const type     = sector?.types.find(t=>t.id===typeId);
  const zone     = type?.zones.find(z=>z.id===zoneId);
  const location = zone?.emplacements.find(e=>e.id===locationId);

  if (custom?.trim()) return custom.trim();
  if (location && zone) return `${zone.label} - ${location.label}`;
  if (location) return location.label;
  return "Caméra";
}

export function buildCameraId(zoneId:string, locationId:string, index:number=1): string {
  const zone = zoneId.slice(0,3).toUpperCase();
  const loc  = locationId.slice(0,3).toUpperCase();
  return `CAM-${zone}-${loc}-${String(index).padStart(2,"0")}`;
}

// ── Catalogue spécifique Industrial Safety ────────────────────────────────────
export const INDUSTRIAL_LOCATIONS = {
  id:"industrial_site", label:"Site Industriel", icon:"🏭", color:"#EF4444",
  categories: [
    {
      id:"access_i", label:"🚪 Accès", locations:[
        "Entrée principale","Entrée employés","Entrée visiteurs","Sortie principale",
        "Sortie d'urgence","Portail Nord","Portail Sud","Portail Est","Portail Ouest",
        "Guérite de sécurité","Contrôle d'accès","Réception",
      ],
    },
    {
      id:"production_i", label:"🏭 Production", locations:[
        "Ligne de production 1","Ligne de production 2","Ligne de production 3","Ligne de production 4",
        "Ligne d'assemblage","Ligne d'emballage","Ligne robotisée",
        "Convoyeur A","Convoyeur B","Convoyeur C",
        "Cellule robotique","Zone inspection qualité","Zone tests","Zone maintenance",
      ],
    },
    {
      id:"machines_i", label:"🤖 Machines", locations:[
        "Presse hydraulique","Presse mécanique","Tour CNC","Fraiseuse CNC",
        "Découpe laser","Découpe plasma","Machine de moulage","Robot industriel","Bras robotisé",
        "Imprimante 3D","Compresseur","Génératrice","Salle des machines",
      ],
    },
    {
      id:"warehouse_i", label:"📦 Entrepôt", locations:[
        "Réception marchandises","Expédition","Quai 1","Quai 2","Quai 3","Quai 4",
        "Zone palettes","Zone racks","Rack A","Rack B","Rack C","Rack D",
        "Zone produits finis","Zone matières premières","Zone emballage","Zone préparation commandes",
      ],
    },
    {
      id:"hazmat_i", label:"⚠️ Matières dangereuses", locations:[
        "Salle produits chimiques","Salle gaz","Salle solvants","Zone déchets dangereux",
        "Cuves","Réservoirs","Zone inflammable","Zone ATEX",
      ],
    },
    {
      id:"electrical_i", label:"⚡ Électricité", locations:[
        "Salle électrique","Transformateur","Tableau électrique","Génératrice","UPS","Salle serveurs",
      ],
    },
    {
      id:"circulation_i", label:"🚛 Circulation", locations:[
        "Zone chariots élévateurs","Zone AGV","Parking employés","Parking visiteurs",
        "Cour de manœuvre","Aire chargement","Aire déchargement","Route interne",
      ],
    },
    {
      id:"safety_i", label:"🔥 Sécurité incendie", locations:[
        "Extincteurs","Salle incendie","Gicleurs","Point de rassemblement",
        "Sortie urgence","Corridor principal",
      ],
    },
  ],
};

// ── Catalogue spécifique Construction Safety ──────────────────────────────────
export const CONSTRUCTION_LOCATIONS = {
  id:"construction_site", label:"Chantier de Construction", icon:"🏗️", color:"#F59E0B",
  categories: [
    {
      id:"access_c", label:"🚧 Accès chantier", locations:[
        "Entrée principale","Entrée employés","Entrée visiteurs","Sortie",
        "Guérite","Clôture Nord","Clôture Sud","Clôture Est","Clôture Ouest",
      ],
    },
    {
      id:"temp_c", label:"🏢 Installations temporaires", locations:[
        "Bureau chantier","Salle réunion","Conteneur outils","Conteneur matériaux",
        "Salle premiers soins","Toilettes","Cafétéria","Vestiaires",
      ],
    },
    {
      id:"work_c", label:"🚜 Zones de travail", locations:[
        "Excavation","Fondation","Coffrage","Bétonnage","Ferraillage","Maçonnerie",
        "Charpente","Toiture","Façade","Isolation","Cloisons",
        "Plomberie","Électricité","Ventilation","Finition intérieure","Finition extérieure",
        "Démolition","Nettoyage",
      ],
    },
    {
      id:"structures_c", label:"🏗️ Structures", locations:[
        "Échafaudage Nord","Échafaudage Sud","Échafaudage Est","Échafaudage Ouest",
        "Escaliers temporaires","Ascenseur chantier","Plateforme élévatrice",
      ],
    },
    {
      id:"vehicles_c", label:"🚛 Véhicules et engins", locations:[
        "Zone grue","Zone pelle mécanique","Zone bulldozer","Zone chargeuse",
        "Zone camion","Zone bétonnière","Zone nacelle","Zone chariot télescopique","Parking engins",
      ],
    },
    {
      id:"storage_c", label:"📦 Stockage", locations:[
        "Zone ciment","Zone acier","Zone bois","Zone briques","Zone tuyaux",
        "Zone câbles","Zone outils","Zone déchets","Zone recyclage","Zone carburant",
      ],
    },
    {
      id:"risk_c", label:"⚠️ Zones à risque", locations:[
        "Bord de fouille","Zone haute tension","Zone levage","Zone charges suspendues",
        "Zone produits dangereux","Zone glissante","Zone interdite","Zone EPI obligatoire",
      ],
    },
    {
      id:"safety_c", label:"🚨 Sécurité", locations:[
        "Point rassemblement","Poste sécurité","Infirmerie","Station lavage yeux",
        "Extincteurs","Issues secours",
      ],
    },
  ],
};

// ── Zones environnementales communes ─────────────────────────────────────────
export const ENVIRONMENTAL_LOCATIONS = {
  id:"environmental", label:"Zones Extérieures / Environnement", icon:"🌍", color:"#10B981",
  locations:[
    "Périmètre Nord","Périmètre Sud","Périmètre Est","Périmètre Ouest",
    "Clôture","Portail","Route d'accès","Aire de stationnement",
    "Cour extérieure","Aire de chargement","Aire de déchargement",
    "Zone verte","Bassin de rétention","Zone de drainage","Réservoir d'eau",
    "Tour de refroidissement","Local technique","Toiture","Sous-sol","Tunnel technique",
  ],
};

/** Retourne le catalogue selon l'ID de module */
export function getModuleLocationCatalog(moduleId: string) {
  if (moduleId === "industrial")    return INDUSTRIAL_LOCATIONS;
  if (moduleId === "construction")  return CONSTRUCTION_LOCATIONS;
  return null;
}
