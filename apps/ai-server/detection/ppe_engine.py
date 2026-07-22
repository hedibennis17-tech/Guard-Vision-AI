"""
PPE Intelligence Engine — Vision Guard AI v2
Association anatomique personne→EPI + score conformité pondéré
"""
import time
from typing import List, Dict

CLASS_INFO = {
    "helmet":    {"severity":"critical","label":"Casque ✅",           "icon":"⛑️",  "color":"#10B981"},
    "no_helmet": {"severity":"critical","label":"SANS CASQUE 🚨",      "icon":"🚫",  "color":"#EF4444"},
    "no-helmet": {"severity":"critical","label":"SANS CASQUE 🚨",      "icon":"🚫",  "color":"#EF4444"},
    "vest":      {"severity":"warning", "label":"Gilet ✅",            "icon":"🦺",  "color":"#10B981"},
    "no_vest":   {"severity":"critical","label":"SANS GILET 🚨",       "icon":"🚫",  "color":"#EF4444"},
    "no-vest":   {"severity":"critical","label":"SANS GILET 🚨",       "icon":"🚫",  "color":"#EF4444"},
    "gloves":    {"severity":"warning", "label":"Gants ✅",            "icon":"🧤",  "color":"#10B981"},
    "no_gloves": {"severity":"warning", "label":"SANS GANTS ⚠️",      "icon":"⚠️", "color":"#F59E0B"},
    "boots":     {"severity":"warning", "label":"Bottes sécu ✅",      "icon":"👢",  "color":"#10B981"},
    "no_boots":  {"severity":"warning", "label":"SANS BOTTES ⚠️",     "icon":"⚠️", "color":"#F59E0B"},
    "glasses":   {"severity":"warning", "label":"Lunettes ✅",         "icon":"🥽",  "color":"#10B981"},
    "no_glasses":{"severity":"warning", "label":"SANS LUNETTES ⚠️",   "icon":"⚠️", "color":"#F59E0B"},
    "harness":   {"severity":"critical","label":"Harnais ✅",          "icon":"🪝",  "color":"#10B981"},
    "no_harness":{"severity":"critical","label":"SANS HARNAIS 🚨",     "icon":"🚫",  "color":"#EF4444"},
    "uniform":   {"severity":"info",    "label":"Uniforme ✅",         "icon":"👷",  "color":"#10B981"},
    "no_uniform":{"severity":"warning", "label":"SANS UNIFORME ⚠️",   "icon":"⚠️", "color":"#F59E0B"},
    "mask":      {"severity":"info",    "label":"Masque ✅",           "icon":"😷",  "color":"#10B981"},
    "person":    {"severity":"info",    "label":"Travailleur 👷",      "icon":"👷",  "color":"#3B82F6"},
}

SEVERITY_WEIGHTS = {"critical": 35, "warning": 20, "info": 5}

import os
COMPLIANCE_THRESHOLD = int(os.environ.get("COMPLIANCE_THRESHOLD", 65))

# Régions anatomiques (proportions du corps)
ANATOMIC_REGIONS = {
    "head":  {"y_from":0.0,  "y_to":0.30, "classes":{"helmet","no_helmet","no-helmet","glasses","no_glasses","mask"}},
    "torso": {"y_from":0.20, "y_to":0.75, "classes":{"vest","no_vest","no-vest","harness","no_harness","uniform","no_uniform","gloves","no_gloves"}},
    "feet":  {"y_from":0.65, "y_to":1.0,  "classes":{"boots","no_boots"}},
}

def iou(b1:List, b2:List) -> float:
    xi=max(b1[0],b2[0]); yi=max(b1[1],b2[1])
    xa=min(b1[2],b2[2]); ya=min(b1[3],b2[3])
    inter=max(0,xa-xi)*max(0,ya-yi)
    if not inter: return 0.0
    a1=(b1[2]-b1[0])*(b1[3]-b1[1]); a2=(b2[2]-b2[0])*(b2[3]-b2[1])
    return inter/(a1+a2-inter) if (a1+a2-inter) else 0.0

def epi_in_person_region(person_box:List, epi_box:List, epi_class:str) -> bool:
    """Vérifie si l'EPI est dans la bonne région anatomique de la personne"""
    px1,py1,px2,py2 = person_box
    p_height = max(py2-py1, 1)
    p_width  = max(px2-px1, 1)

    ex1,ey1,ex2,ey2 = epi_box
    e_cx = (ex1+ex2)/2
    e_cy = (ey1+ey2)/2

    # Élargir la box personne horizontalement
    margin_x = p_width * 0.3

    # Vérifier que le centre de l'EPI est dans la bonne région
    for region in ANATOMIC_REGIONS.values():
        if epi_class in region["classes"]:
            r_y1 = py1 + p_height * region["y_from"]
            r_y2 = py1 + p_height * region["y_to"]
            if (px1-margin_x <= e_cx <= px2+margin_x) and (r_y1 <= e_cy <= r_y2):
                return True
            # Fallback: IoU simple si pas dans la région mais proche
            if iou(person_box, epi_box) > 0.05:
                return True
            return False

    # Classe inconnue → IoU ou proximité générale
    return iou(person_box, epi_box) > 0.1 or (
        px1-p_width*0.3 <= e_cx <= px2+p_width*0.3 and
        py1-p_height*0.1 <= e_cy <= py2+p_height*0.1
    )

def calculate_compliance_score(absent_epis: List[Dict]) -> int:
    """Score pondéré par sévérité"""
    score = 100
    for a in absent_epis:
        info = CLASS_INFO.get(a.get("class",""), {})
        weight = SEVERITY_WEIGHTS.get(info.get("severity","warning"), 20)
        score -= weight
    return max(0, score)

def associate_ppe_to_persons(detections: List[Dict]) -> List[Dict]:
    persons = [d for d in detections if d.get("class") == "person"]
    epis    = [d for d in detections if d.get("class") != "person"]

    workers = []
    for i, person in enumerate(persons):
        worker_id = person.get("track_id", i+1)
        pbox      = person.get("bbox", [0,0,0,0])

        worker_epis = [e for e in epis if epi_in_person_region(pbox, e.get("bbox",[0,0,0,0]), e.get("class",""))]

        present = [e for e in worker_epis if not e.get("alert", False) and e.get("class") != "person"]
        absent  = [e for e in worker_epis if e.get("alert", False)]

        missing_items = []
        for a in absent:
            cls = a.get("class","")
            if "helmet" in cls: missing_items.append("Casque")
            elif "vest"  in cls: missing_items.append("Gilet")
            elif "glove" in cls: missing_items.append("Gants")
            elif "boot"  in cls: missing_items.append("Bottes")
            elif "glass" in cls: missing_items.append("Lunettes")
            elif "harness" in cls: missing_items.append("Harnais")
            elif "uniform" in cls: missing_items.append("Uniforme")

        score     = calculate_compliance_score(absent)
        compliant = score >= COMPLIANCE_THRESHOLD
        ts        = time.strftime("%H:%M:%S")

        timeline = [{"time":ts,"event":f"👷 Travailleur #{worker_id}","type":"person"}]
        for e in present:  timeline.append({"time":ts,"event":f"✅ {e.get('label',e.get('class'))}","type":"present"})
        for a in absent:   timeline.append({"time":ts,"event":f"🚨 {a.get('label',a.get('class'))}","type":"absent"})
        if not compliant:  timeline.append({"time":ts,"event":f"🚨 Alerte — {len(absent)} violation(s)","type":"alert"})

        workers.append({
            "worker_id":    worker_id,
            "bbox":         pbox,
            "color":        "#10B981" if compliant else "#EF4444",
            "score":        score,
            "compliant":    compliant,
            "epi_present":  [{"class":e.get("class"),"label":e.get("label",e.get("class")),"bbox":e.get("bbox"),"score":e.get("score",0),"color":"#10B981","icon":"✅"} for e in present],
            "epi_absent":   [{"class":a.get("class"),"label":a.get("label",a.get("class")),"bbox":a.get("bbox"),"score":a.get("score",0),"color":"#EF4444","icon":"🚨"} for a in absent],
            "missing_items":missing_items,
            "violations":   len(absent),
            "alerts":       [{"type":"missing_ppe","label":a.get("label"),"severity":CLASS_INFO.get(a.get("class",""),{}).get("severity","warning"),"bbox":a.get("bbox"),"color":"#EF4444"} for a in absent],
            "timeline":     timeline,
            "label":        f"Travailleur #{worker_id} — {'✅ Conforme' if compliant else f'❌ {len(absent)} violation(s) ({score}%)'}",
            "confidence":   round(person.get("score",0)*100,1),
        })
    return workers

def enrich_detections(detections: List[Dict]) -> Dict:
    for det in detections:
        cls = det.get("class","")
        info = CLASS_INFO.get(cls, {})
        if not det.get("color"):  det["color"] = info.get("color","#94A3B8")
        if not det.get("icon"):   det["icon"]  = info.get("icon","📦")
        det["alert"]  = info.get("severity") in ("critical","warning") and cls.startswith("no")
        det["is_epi"] = cls != "person"

    workers = associate_ppe_to_persons(detections)
    total   = len(workers)
    n_ok    = sum(1 for w in workers if w["compliant"])
    site_sc = int(n_ok/total*100) if total else 100

    return {
        "detections":      detections,
        "workers":         workers,
        "site_compliance": {
            "score":         site_sc,
            "total_workers": total,
            "compliant":     n_ok,
            "violations":    total-n_ok,
            "status":        "✅ Site conforme" if site_sc>=80 else "🚨 Violations détectées",
            "color":         "#10B981" if site_sc>=80 else "#EF4444",
        },
        "all_alerts": [a for w in workers for a in w["alerts"]],
        "timestamp":  time.strftime("%H:%M:%S"),
    }
