/**
 * Vision Guard — TrafficGuard AI
 * Configuration complète v1.0
 */

export const TRAFFIC_CONFIG = {
  module: {
    id:"transportation", name:"TrafficGuard AI", icon:"🚗", color:"#8B5CF6",
    description:"Real-time traffic monitoring, license plate recognition & accident detection",
    goal:"Improve traffic flow, enhance road safety and automate violation detection.",
  },

  // ── Véhicules détectés ──────────────────────────────────────────────────────
  vehicles: [
    { id:"car",          label:"Voiture",             icon:"🚗", count_weight:1  },
    { id:"truck",        label:"Camion / PL",         icon:"🚛", count_weight:2  },
    { id:"bus",          label:"Bus",                 icon:"🚌", count_weight:2  },
    { id:"motorcycle",   label:"Moto",                icon:"🏍️", count_weight:0.5},
    { id:"bicycle",      label:"Vélo",                icon:"🚲", count_weight:0.3},
    { id:"scooter",      label:"Scooter",             icon:"🛵", count_weight:0.5},
    { id:"van",          label:"Camionnette",         icon:"🚐", count_weight:1.5},
    { id:"taxis",        label:"Taxi",                icon:"🚕", count_weight:1  },
    { id:"ambulance",    label:"Ambulance",           icon:"🚑", severity:"critical" },
    { id:"fire_truck",   label:"Camion pompier",      icon:"🚒", severity:"critical" },
    { id:"police_car",   label:"Voiture de police",   icon:"🚓", severity:"critical" },
    { id:"pedestrian",   label:"Piéton",              icon:"🚶", count_weight:0.1},
    { id:"wheelchair",   label:"Fauteuil roulant",    icon:"♿", count_weight:0.1},
  ],

  // ── Infractions détectées ───────────────────────────────────────────────────
  violations: [
    { id:"red_light",         label:"Franchissement feu rouge",     icon:"🚦", severity:"critical", fine:true },
    { id:"stop_sign",         label:"Non-respect panneau stop",     icon:"🛑", severity:"warning",  fine:true },
    { id:"speeding",          label:"Excès de vitesse",             icon:"💨", severity:"warning",  fine:true },
    { id:"illegal_parking",   label:"Stationnement interdit",       icon:"🅿️", severity:"warning",  fine:true },
    { id:"wrong_way",         label:"Contresens",                   icon:"🔄", severity:"critical", fine:true },
    { id:"phone_while_driving",label:"Téléphone au volant",        icon:"📱", severity:"warning",  fine:true },
    { id:"no_seatbelt",       label:"Ceinture non attachée",       icon:"🔒", severity:"warning",  fine:true },
    { id:"illegal_turn",      label:"Virage interdit",              icon:"🔄", severity:"warning",  fine:true },
    { id:"bus_lane",          label:"Empiétement voie bus",         icon:"🚌", severity:"info",     fine:true },
    { id:"bike_lane",         label:"Empiétement piste cyclable",   icon:"🚲", severity:"info",     fine:true },
    { id:"no_horn_zone",      label:"Klaxon zone silencieuse",      icon:"📢", severity:"info",     fine:false},
    { id:"overloaded",        label:"Véhicule surchargé",           icon:"⚖️", severity:"warning",  fine:true },
  ],

  // ── Incidents & Accidents ───────────────────────────────────────────────────
  incidents: [
    { id:"accident",        label:"Accident",                icon:"💥", severity:"critical", response_time:"immediate" },
    { id:"breakdown",       label:"Panne véhicule",          icon:"🔧", severity:"warning",  response_time:"5min"      },
    { id:"pedestrian_hit",  label:"Piéton renversé",         icon:"🚨", severity:"critical", response_time:"immediate" },
    { id:"hit_and_run",     label:"Délit de fuite",          icon:"🏃", severity:"critical", response_time:"immediate" },
    { id:"debris",          label:"Débris sur chaussée",     icon:"🪨", severity:"warning",  response_time:"10min"     },
    { id:"flood",           label:"Inondation route",        icon:"💧", severity:"critical", response_time:"15min"     },
    { id:"ice_patch",       label:"Verglas détecté",         icon:"🧊", severity:"critical", response_time:"immediate" },
    { id:"congestion",      label:"Embouteillage formé",     icon:"🚗", severity:"warning",  response_time:"30min"     },
  ],

  // ── OCR Plaques ─────────────────────────────────────────────────────────────
  license_plate: [
    { id:"plate_read",      label:"Lecture plaque",          icon:"🔤", status:"active"      },
    { id:"plate_blacklist", label:"Plaque liste noire",      icon:"🚫", status:"active",      alert:true },
    { id:"plate_whitelist", label:"Plaque liste blanche",    icon:"✅", status:"active"      },
    { id:"stolen_vehicle",  label:"Véhicule volé",           icon:"🚨", status:"active",      alert:true },
    { id:"no_registration", label:"Véhicule non immatriculé",icon:"❓", status:"coming_soon" },
    { id:"expired_plate",   label:"Plaque expirée",          icon:"⏰", status:"coming_soon" },
  ],

  // ── Analytics trafic ─────────────────────────────────────────────────────────
  analytics: [
    { id:"vehicle_count",    label:"Comptage véhicules",       icon:"🔢", unit:"véh/h"  },
    { id:"speed_avg",        label:"Vitesse moyenne",           icon:"📊", unit:"km/h"   },
    { id:"density",          label:"Densité trafic",           icon:"📈", unit:"véh/km" },
    { id:"flow_direction",   label:"Flux par direction",       icon:"➡️", unit:"%"      },
    { id:"peak_times",       label:"Heures de pointe",         icon:"⏰", unit:""       },
    { id:"incident_rate",    label:"Taux d'incidents",         icon:"⚠️", unit:"nb/h"   },
    { id:"pedestrian_count", label:"Comptage piétons",         icon:"🚶", unit:"pers/h" },
    { id:"bicycle_count",    label:"Comptage vélos",           icon:"🚲", unit:"vélo/h" },
    { id:"parking_occupancy",label:"Taux occupation parking",  icon:"🅿️", unit:"%"      },
    { id:"violation_rate",   label:"Taux d'infractions",       icon:"🚨", unit:"nb/h"   },
    { id:"plate_captures",   label:"Plaques lues",             icon:"🔤", unit:"nb"     },
    { id:"co2_estimate",     label:"Estimation CO₂",           icon:"🌿", unit:"tonnes" },
  ],

  // ── Zones de surveillance ────────────────────────────────────────────────────
  zones: [
    { id:"intersection",   label:"Intersection",            icon:"✚"  },
    { id:"crosswalk",      label:"Passage piéton",          icon:"🦓" },
    { id:"bus_stop",       label:"Arrêt de bus",            icon:"🚌" },
    { id:"school_zone",    label:"Zone scolaire",           icon:"🏫" },
    { id:"hospital_zone",  label:"Zone hospitalière",       icon:"🏥" },
    { id:"parking_lot",    label:"Parking",                 icon:"🅿️" },
    { id:"highway_ramp",   label:"Bretelle d'autoroute",    icon:"🛣️" },
    { id:"tunnel",         label:"Tunnel",                  icon:"🌑" },
    { id:"bridge",         label:"Pont",                    icon:"🌉" },
    { id:"toll_booth",     label:"Péage",                   icon:"🏧" },
  ],
};
