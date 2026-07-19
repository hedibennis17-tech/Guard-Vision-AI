"""
PPE Intelligence Engine — Vision Guard AI
Association personne → EPI + conformité par travailleur
Spec ChatGPT: rectangles individuels, fiche conformité, alertes détaillées
"""
from typing import List, Dict, Optional
import time

# Classes EPI présents / absents
EPI_PRESENT = {"helmet", "vest", "safety_vest", "uniform", "gloves",
               "safety_glasses", "safety_boots", "fall_harness", "ear_protection",
               "respirator", "face_shield"}

EPI_ABSENT  = {"no-helmet","no_helmet","no-vest","no_vest","no_uniform",
               "no_gloves","no_glasses","no_boots","no_harness"}

# Couleur par type de détection
DETECTION_COLORS = {
    # Présents → vert
    "helmet":        "#10B981",
    "vest":          "#10B981",
    "safety_vest":   "#10B981",
    "uniform":       "#10B981",
    "gloves":        "#10B981",
    "safety_glasses":"#10B981",
    "safety_boots":  "#10B981",
    "fall_harness":  "#10B981",
    # Absents → rouge
    "no-helmet":     "#EF4444",
    "no_helmet":     "#EF4444",
    "no-vest":       "#EF4444",
    "no_vest":       "#EF4444",
    "no_uniform":    "#EF4444",
    "no_gloves":     "#EF4444",
    "no_glasses":    "#EF4444",
    "no_boots":      "#EF4444",
    "no_harness":    "#EF4444",
    # Personne → bleu
    "person":        "#3B82F6",
    # Inconnu → gris
    "default":       "#94A3B8",
}

ICONS = {
    "helmet":"⛑️","vest":"🦺","safety_vest":"🦺","no-helmet":"🚫",
    "no_helmet":"🚫","no-vest":"🚫","no_vest":"🚫","person":"👷",
}


def iou(b1:List, b2:List) -> float:
    """Intersection over Union entre 2 bboxes [x1,y1,x2,y2]"""
    xi = max(b1[0],b2[0]); yi = max(b1[1],b2[1])
    xa = min(b1[2],b2[2]); ya = min(b1[3],b2[3])
    inter = max(0,xa-xi)*max(0,ya-yi)
    if not inter: return 0.0
    a1 = (b1[2]-b1[0])*(b1[3]-b1[1])
    a2 = (b2[2]-b2[0])*(b2[3]-b2[1])
    return inter/(a1+a2-inter) if (a1+a2-inter) else 0.0


def is_overlapping(person_box:List, epi_box:List, threshold:float=0.1) -> bool:
    """Vérifie si un EPI appartient à une personne (IoU ou centre dans la box)"""
    if iou(person_box, epi_box) > threshold:
        return True
    # Vérifier si le centre de l'EPI est dans la box personne élargie
    ex = (epi_box[0]+epi_box[2])/2
    ey = (epi_box[1]+epi_box[3])/2
    px1,py1,px2,py2 = person_box
    margin = (py2-py1)*0.3  # marge 30% hauteur personne
    return px1-margin <= ex <= px2+margin and py1-margin <= ey <= py2+margin


def associate_ppe_to_persons(detections: List[Dict]) -> List[Dict]:
    """
    Associe chaque EPI à la personne la plus proche.
    Retourne des workers avec leur liste d'EPI et score de conformité.
    """
    persons = [d for d in detections if d.get("class") == "person"]
    epis    = [d for d in detections if d.get("class") != "person"]

    workers = []

    for i, person in enumerate(persons):
        worker_id = person.get("track_id", i+1)
        pbox      = person.get("bbox", [0,0,0,0])

        # Trouver les EPI appartenant à cette personne
        worker_epis = []
        for epi in epis:
            ebox = epi.get("bbox", [0,0,0,0])
            if is_overlapping(pbox, ebox):
                worker_epis.append(epi)

        # Analyser la conformité
        present = [e for e in worker_epis if e["class"] in EPI_PRESENT]
        absent  = [e for e in worker_epis if e["class"] in EPI_ABSENT]

        # Classes absentes détectées
        missing_items = []
        for a in absent:
            cls = a["class"]
            if "helmet" in cls: missing_items.append("Casque")
            elif "vest"  in cls: missing_items.append("Gilet")
            elif "glove" in cls: missing_items.append("Gants")
            elif "boot"  in cls: missing_items.append("Bottes")
            elif "glass" in cls: missing_items.append("Lunettes")
            elif "harness" in cls: missing_items.append("Harnais")
            elif "uniform" in cls: missing_items.append("Uniforme")

        # Score conformité
        n_violations = len(absent)
        score = max(0, 100 - n_violations * 25)
        compliant = score >= 75

        # Générer les alertes détaillées
        alerts = []
        for a in absent:
            alerts.append({
                "type":    "missing_ppe",
                "label":   a.get("label", a["class"]),
                "severity":"critical",
                "icon":    "🚨",
                "bbox":    a.get("bbox"),
                "color":   "#EF4444",
            })

        # Timeline des détections
        ts = time.strftime("%H:%M:%S")
        timeline = [{"time":ts, "event":f"Travailleur #{worker_id} détecté", "type":"person"}]
        for e in present:
            timeline.append({"time":ts, "event":f"✅ {e.get('label',e['class'])}", "type":"present"})
        for a in absent:
            timeline.append({"time":ts, "event":f"❌ {a.get('label',a['class'])}", "type":"absent"})
        if not compliant:
            timeline.append({"time":ts, "event":f"🚨 Alerte envoyée — {len(absent)} violation(s)", "type":"alert"})

        workers.append({
            "worker_id":    worker_id,
            "bbox":         pbox,
            "color":        "#EF4444" if not compliant else "#10B981",
            "score":        score,
            "compliant":    compliant,
            "epi_present":  [{"class":e["class"],"label":e.get("label",e["class"]),"bbox":e.get("bbox"),"score":e.get("score",0),"color":"#10B981","icon":"✅"} for e in present],
            "epi_absent":   [{"class":a["class"],"label":a.get("label",a["class"]),"bbox":a.get("bbox"),"score":a.get("score",0),"color":"#EF4444","icon":"❌"} for a in absent],
            "missing_items":missing_items,
            "violations":   len(absent),
            "alerts":       alerts,
            "timeline":     timeline,
            "label":        f"Travailleur #{worker_id} — {'✅ Conforme' if compliant else f'❌ {len(absent)} violation(s)'}",
            "confidence":   round(person.get("score",0)*100,1),
        })

    return workers


def enrich_detections(detections: List[Dict]) -> Dict:
    """
    Point d'entrée principal — enrichit les détections avec:
    - Couleurs par type
    - Association personne-EPI
    - Fiches conformité par travailleur
    - Score global
    """
    # Enrichir chaque détection avec sa couleur
    for det in detections:
        cls = det.get("class","")
        det["color"]  = DETECTION_COLORS.get(cls, DETECTION_COLORS["default"])
        det["icon"]   = ICONS.get(cls, "📦")
        det["is_epi"] = cls in EPI_PRESENT or cls in EPI_ABSENT

    # Associer EPI aux personnes
    workers = associate_ppe_to_persons(detections)

    # Score global chantier
    total     = len(workers)
    compliant = sum(1 for w in workers if w["compliant"])
    site_score= int(compliant/total*100) if total else 100

    return {
        "detections": detections,
        "workers":    workers,
        "site_compliance": {
            "score":        site_score,
            "total_workers":total,
            "compliant":    compliant,
            "violations":   total - compliant,
            "status":       "✅ Conforme" if site_score >= 80 else "🚨 Non conforme",
            "color":        "#10B981" if site_score >= 80 else "#EF4444",
        },
        "all_alerts": [a for w in workers for a in w["alerts"]],
        "timestamp":  time.strftime("%H:%M:%S"),
    }
