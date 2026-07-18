import { NextResponse } from "next/server";

const SERVER = process.env.NEXT_PUBLIC_AI_SERVER_URL ?? "";

async function checkServer() {
  if (!SERVER) return { online:false, info:null, ocr:null, ppe:null, shoplifting:null, ms:null };
  const start = Date.now();
  try {
    const [rootRes, ocrRes, ppeRes, shopliftRes] = await Promise.allSettled([
      fetch(`${SERVER}/`,                    { signal:AbortSignal.timeout(5000), cache:"no-store" }),
      fetch(`${SERVER}/ocr/status`,          { signal:AbortSignal.timeout(5000), cache:"no-store" }),
      fetch(`${SERVER}/detect/ppe/status`,   { signal:AbortSignal.timeout(5000), cache:"no-store" }),
      fetch(`${SERVER}/detect/shoplifting/status`, { signal:AbortSignal.timeout(5000), cache:"no-store" }),
    ]);

    const rootOk = rootRes.status==="fulfilled" && rootRes.value.ok;
    const info   = rootOk ? await rootRes.value.json() : null;
    const ocr    = ocrRes.status==="fulfilled"  && ocrRes.value.ok  ? await ocrRes.value.json()  : null;
    const ppe    = ppeRes.status==="fulfilled"  && ppeRes.value.ok  ? await ppeRes.value.json()  : null;
    const shop   = shopliftRes.status==="fulfilled" && shopliftRes.value.ok ? await shopliftRes.value.json() : null;

    return { online:rootOk, info, ocr, ppe, shoplifting:shop, ms:Date.now()-start };
  } catch {
    return { online:false, info:null, ocr:null, ppe:null, shoplifting:null, ms:null };
  }
}

export async function GET() {
  const { online, info, ocr, ppe, shoplifting, ms } = await checkServer();

  // ── État réel de chaque modèle ────────────────────────────────────────────
  const models = [
    {
      id:"coco_ssd",
      name:"COCO-SSD (TensorFlow.js)",
      icon:"🟢",
      status:"running",
      where:"Navigateur",
      deployed:true,
      real_status:"✅ ACTIF — tourne dans le navigateur sans serveur",
      detects:["person","car","truck","motorcycle","bicycle","bus","dog","cat","horse","cow","sheep","bird","backpack","handbag","suitcase","cell phone","bottle","scissors","stop sign","traffic light"],
      limitation:"Détecte les classes COCO standard UNIQUEMENT — ne distingue PAS casque présent/absent, uniforme, comportement vol",
      action:"✅ Actif maintenant",
    },
    {
      id:"yolov11_onnx",
      name:"YOLOv11n ONNX Runtime",
      icon: online ? "🟢" : "🔴",
      status: online ? "running" : "not_deployed",
      where:"Serveur Railway",
      deployed: online,
      real_status: online
        ? "✅ ACTIF sur Railway — mêmes 80 classes COCO avec labels enrichis par module"
        : "❌ Serveur Railway hors ligne ou NEXT_PUBLIC_AI_SERVER_URL manquant",
      detects:["80 classes COCO","Alertes enrichies: Construction→Vérif EPI","Defense→INTRUS critique","Retail→Sac suspect","Agriculture→Intrus"],
      limitation:"Modèle général COCO. Ne détecte PAS casque/gilet/uniforme présent ou absent précisément — nécessite modèle PPE custom",
      action: online ? `✅ Actif: ${SERVER}` : "Configurer NEXT_PUBLIC_AI_SERVER_URL dans Vercel",
    },
    {
      id:"bytetrack",
      name:"ByteTrack (Tracking multi-objets)",
      icon: online ? "🟢" : "🔴",
      status: online ? "running" : "not_deployed",
      where:"Serveur Railway",
      deployed: online,
      real_status: online ? "✅ ACTIF — ID unique par objet tracké" : "❌ Serveur Railway hors ligne",
      detects:["ID unique par personne/véhicule entre frames","Trajectoires","Comptage entrées/sorties"],
      limitation:"Actif uniquement quand le serveur Railway tourne",
      action: online ? "✅ Inclus dans le serveur YOLOv11" : "Démarrer le serveur Railway",
    },
    {
      id:"ocr_engine",
      name:"Vision Guard OCR Engine (Tesseract + pyzbar + OpenCV)",
      icon: online && ocr?.loaded ? "🟢" : online ? "🟡" : "🔴",
      status: online && ocr?.loaded ? "running" : online ? "partial" : "not_deployed",
      where:"Serveur Railway",
      deployed: online && (ocr?.loaded ?? false),
      real_status: !online
        ? "❌ Serveur Railway hors ligne"
        : ocr?.loaded
        ? "✅ ACTIF — Tesseract + pyzbar + OpenCV QR"
        : "⚠️ Serveur en ligne mais OCR engine non chargé",
      detects:[
        `Tesseract: ${ocr?.engines?.tesseract ? "✅ actif" : "❌ non disponible"}`,
        `pyzbar (EAN/Code128/QR): ${ocr?.engines?.pyzbar ? "✅ actif" : "❌ non disponible"}`,
        `OpenCV QR: ✅ toujours actif`,
        `EasyOCR multilingue: ${ocr?.engines?.easyocr ? "✅ actif" : "❌ non installé"}`,
        `PaddleOCR haute précision: ${ocr?.engines?.paddleocr ? "✅ actif" : "❌ non installé (trop lourd)"}`,
      ],
      limitation:"PaddleOCR non installé (1GB+ trop lourd pour Railway). Tesseract fonctionne mais moins précis sur les plaques à distance",
      action: online ? "✅ OCR de base actif — PaddleOCR nécessite Railway Pro (plus de RAM)" : "Démarrer le serveur Railway",
    },
    {
      id:"shoplifting",
      name:"Shoplifting Detection (PyResearch)",
      icon: online ? "🟡" : "🔴",
      status: online ? "fallback_active" : "not_deployed",
      where:"Serveur Railway",
      deployed: online,
      real_status: !online
        ? "❌ Serveur Railway hors ligne"
        : shoplifting?.model_available
        ? "✅ Modèle PyResearch actif"
        : "⚠️ FALLBACK actif — détection comportementale (sacs suspects). Modèle précis PyResearch non disponible",
      detects:[
        shoplifting?.model_available ? "cls1=Shoplifting 🚨 / cls0=Normal ✅ (PyResearch)" : "Fallback: backpack/suitcase suspects",
        "shoplifting_wights.pt: " + (shoplifting?.model_available ? "✅ chargé" : "❌ ABSENT — non publié par PyResearch"),
      ],
      limitation:"shoplifting_wights.pt jamais publié par PyResearch sur GitHub. Fallback comportemental actif mais moins précis",
      action: online
        ? "Contacter PyResearch pour les poids OU entraîner avec train_shoplifting.py"
        : "Démarrer le serveur Railway",
    },
    {
      id:"ppe_custom",
      name:"YOLOv11 PPE Custom (Casque/Gilet/Uniforme)",
      icon:"🔴",
      status:"weights_missing",
      where:"Serveur Railway",
      deployed:false,
      real_status:"❌ CODE PRÊT — Poids manquants. Le détecteur existe mais models/ppe.pt est absent → retourne toujours 0 détection",
      detects:[
        "helmet ✅ / no_helmet 🚨 — NÉCESSITE ppe.pt",
        "safety_vest ✅ / no_vest 🚨 — NÉCESSITE ppe.pt",
        "uniform ✅ / no_uniform ⚠️ — NÉCESSITE ppe.pt",
        "fall_harness ✅ / no_harness 🚨 — NÉCESSITE ppe.pt",
        "safety_boots, gloves, safety_glasses — NÉCESSITE ppe.pt",
        "worker / visitor / contractor / supervisor / intruder",
        `Modèles disponibles sur Railway: ${ppe?.models_available?.join(", ") || "aucun"}`,
      ],
      limitation:"❌ AUCUN POIDS DISPONIBLE. Sans ppe.pt le détecteur retourne 0 résultat même si le serveur tourne",
      action:"PRIORITÉ #1: Clé API Roboflow gratuite → python ppe_training/download_dataset.py CLE → python ppe_training/train_ppe.py → uploader models/ppe.pt",
    },
    {
      id:"sam2",
      name:"SAM 2 (Meta — Segmentation)",
      icon:"⚫",
      status:"needs_gpu",
      where:"Non installé",
      deployed:false,
      real_status:"❌ NON INSTALLÉ — GPU 16GB+ VRAM requis. Railway = CPU uniquement",
      detects:["Segmentation pixel-perfect","Masques haute résolution","Tracking par segmentation"],
      limitation:"GPU NVIDIA A100/T4 obligatoire. Impossible sur Railway free tier",
      action:"RunPod.io ou Google Cloud Run GPU (~$0.50/heure)",
    },
    {
      id:"grounding_dino",
      name:"Grounding DINO",
      icon:"⚫",
      status:"needs_gpu",
      where:"Non installé",
      deployed:false,
      real_status:"❌ NON INSTALLÉ — GPU requis",
      detects:["Détection open-vocabulary via texte","Zero-shot detection"],
      limitation:"GPU 7GB+ VRAM requis",
      action:"Serveur GPU dédié après SAM2",
    },
    {
      id:"clip",
      name:"CLIP (OpenAI — Recherche sémantique)",
      icon:"⚫",
      status:"needs_gpu",
      where:"Non installé",
      deployed:false,
      real_status:"❌ NON INSTALLÉ — GPU recommandé (CPU trop lent)",
      detects:["Recherche par texte dans vidéo","Classification zero-shot","Images similaires"],
      limitation:"CPU possible mais 30s+/image — inutilisable en production",
      action:"Inclure dans serveur GPU avec SAM2",
    },
    {
      id:"florence2",
      name:"Florence-2 (Microsoft)",
      icon:"⚫",
      status:"needs_gpu",
      where:"Non installé",
      deployed:false,
      real_status:"❌ NON INSTALLÉ — GPU A100 requis",
      detects:["Compréhension scènes complexes","Description automatique","OCR avancé"],
      limitation:"GPU A100 14GB+ VRAM requis",
      action:"Serveur GPU dédié",
    },
    {
      id:"llm",
      name:"LLM — Rapports IA",
      icon:"🟡",
      status:"partial",
      where:"À configurer",
      deployed:false,
      real_status:"⚠️ NON CONNECTÉ — API Anthropic/OpenAI possible sans GPU",
      detects:["Génération rapports PDF","Analyse incidents","Résumés événements","Assistant IA"],
      limitation:"Llama/Qwen = GPU A100. Alternative immédiate: API Anthropic Claude = clé API + 2h dev",
      action:"PRIORITÉ #2: Ajouter ANTHROPIC_API_KEY dans Railway → rapports IA actifs immédiatement",
    },
  ];

  const running    = models.filter(m=>m.deployed).length;
  const fallback   = models.filter(m=>m.status==="fallback_active").length;
  const missing    = models.filter(m=>["not_deployed","weights_missing"].includes(m.status)).length;
  const needsGPU   = models.filter(m=>m.status==="needs_gpu").length;

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    server: {
      url:     SERVER || "❌ NEXT_PUBLIC_AI_SERVER_URL non configuré dans Vercel",
      online,
      latency: ms ? `${ms}ms` : null,
      details: info,
    },
    summary: { total:models.length, running, fallback, missing, needs_gpu:needsGPU },
    honest_summary: [
      `✅ ${running} modèle(s) réellement actif(s)`,
      `⚠️ ${fallback} en mode fallback (partiel)`,
      `❌ ${missing} non déployé(s) / poids manquants`,
      `⚫ ${needsGPU} nécessitent GPU (non prévu sur Railway)`,
    ],
    priority_actions: [
      {
        num:1,
        task:"Activer PPE Custom (casque/gilet/uniforme)",
        how:"Clé Roboflow gratuite → download_dataset.py → train_ppe.py → upload ppe.pt",
        impact:"Construction Safety + Industrial Safety pleinement fonctionnels",
        effort:"Clé gratuite + 30min entraînement GPU ou 3h CPU",
      },
      {
        num:2,
        task:"Connecter API Anthropic Claude pour rapports IA",
        how:"Ajouter ANTHROPIC_API_KEY dans Railway variables",
        impact:"Génération rapports PDF IA sur tous les modules",
        effort:"10 minutes",
      },
      {
        num:3,
        task:"Configurer NEXT_PUBLIC_AI_SERVER_URL dans Vercel",
        how:"Vercel → Settings → Env Vars → NEXT_PUBLIC_AI_SERVER_URL=https://guard-vision-ai-production.up.railway.app",
        impact:"Tout le serveur Railway visible dans le dashboard",
        effort:"2 minutes",
        urgent: !SERVER,
      },
    ],
    models,
  });
}
