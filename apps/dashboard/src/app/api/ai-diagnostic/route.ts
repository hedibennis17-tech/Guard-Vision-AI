import { NextResponse } from "next/server";

const SERVER = process.env.NEXT_PUBLIC_AI_SERVER_URL ?? "";

async function pingServer() {
  if (!SERVER) return { online:false, info:null };
  try {
    const r = await fetch(`${SERVER}/`, { signal:AbortSignal.timeout(3000) });
    return { online:r.ok, info:r.ok ? await r.json() : null };
  } catch { return { online:false, info:null }; }
}

export async function GET() {
  const { online, info } = await pingServer();

  const models = [
    {
      id:"coco_ssd", name:"COCO-SSD (TensorFlow.js)", icon:"🟢",
      status:"running", where:"browser", deployed:true,
      detects:["person","car","truck","bicycle","motorcycle","dog","cat","horse","cow","sheep","bird","bottle","backpack","cell phone","stop sign","traffic light"],
      limitation:"Détecte la classe 'person' UNIQUEMENT — ne sait PAS si uniforme/casque/gilet présent ou absent",
      action:"Déjà actif — aucune installation requise",
    },
    {
      id:"yolov11_ppe", name:"YOLOv11 PPE Custom", icon:online?"🟡":"🔴",
      status:online?"server_online_model_missing":"not_deployed", where:"python_server", deployed:online && info?.models?.yolov11?.loaded,
      detects:["helmet ✓","no_helmet ✓","safety_vest ✓","no_vest ✓","uniform ✓","no_uniform ✓","safety_boots","fall_harness","worker","forklift","excavator"],
      limitation:"Nécessite: 1) Serveur Python déployé + 2) Poids modèle PPE custom téléchargés",
      action: online ? "Serveur en ligne ✅ — uploader les poids PPE dans models/" : "Déployer apps/ai-server sur Railway.app",
    },
    {
      id:"shoplifting", name:"YOLOv11 Shoplifting (PyResearch)", icon:online?"🟡":"🔴",
      status:online?"server_online_model_missing":"not_deployed", where:"python_server", deployed:online && info?.models?.shoplifting?.loaded,
      detects:["shoplifting (vol) ✓","customer_normal ✓"],
      limitation:"Nécessite: serveur Python + fichier shoplifting_wights.pt (disponible sur GitHub PyResearch)",
      action: online ? "Télécharger shoplifting_wights.pt → apps/ai-server/models/" : "Déployer serveur Python d'abord",
    },
    {
      id:"bytetrack", name:"ByteTrack (Multi-Object Tracking)", icon:online?"🟡":"🔴",
      status:online?"available_if_server":"not_deployed", where:"python_server", deployed:online,
      detects:["ID unique par personne/véhicule","Trajectoires entre frames","Comptage entrées/sorties","Suivi persistant"],
      limitation:"Inclus dans le serveur Python — actif dès que le serveur tourne",
      action: online ? "✅ ByteTrack actif dans le serveur" : "Déployer serveur Python",
    },
    {
      id:"paddleocr", name:"PaddleOCR (Plaques + Texte)", icon:online?"🟡":"🔴",
      status:online?"available_if_server":"not_deployed", where:"python_server", deployed:online && info?.models?.paddleocr?.loaded,
      detects:["Plaques immatriculation","Numéros de série","Texte panneaux","Codes-barres","QR codes"],
      limitation:"Inclus dans le serveur Python — nécessite déploiement",
      action: online ? "✅ PaddleOCR actif" : "Déployer serveur Python",
    },
    {
      id:"sam2", name:"SAM 2 (Meta — Segmentation)", icon:"⚫",
      status:"needs_gpu", where:"gpu_server", deployed:false,
      detects:["Segmentation pixel-perfect","Découpe précise d'objets","Masques haute résolution"],
      limitation:"Minimum: GPU NVIDIA A100 ou T4 (16GB+ VRAM) — Railway ne supporte pas encore GPU",
      action:"Google Cloud Run GPU ou RunPod.io (~$0.50/heure) — intégrable après serveur Python de base",
    },
    {
      id:"grounding_dino", name:"Grounding DINO", icon:"⚫",
      status:"needs_gpu", where:"gpu_server", deployed:false,
      detects:["Détection open-vocabulary via texte","'Trouve les tracteurs rouges'","Aucun entraînement requis"],
      limitation:"GPU requis — 7GB+ VRAM",
      action:"Déployer après SAM2 sur serveur GPU",
    },
    {
      id:"florence2", name:"Florence-2 (Microsoft)", icon:"⚫",
      status:"needs_gpu", where:"gpu_server", deployed:false,
      detects:["Compréhension scènes","Description automatique","Analyse comportements complexes"],
      limitation:"GPU A100 requis — 14GB+ VRAM",
      action:"Déployer sur GPU dédié",
    },
    {
      id:"clip", name:"CLIP (OpenAI — Recherche sémantique)", icon:"⚫",
      status:"needs_gpu", where:"gpu_server", deployed:false,
      detects:["Recherche par texte dans vidéo","Images similaires","Classification zero-shot"],
      limitation:"GPU fortement recommandé (très lent sur CPU)",
      action:"Inclure dans le serveur GPU après Florence-2",
    },
    {
      id:"llm", name:"LLM (Llama/Qwen/DeepSeek)", icon:"⚫",
      status:"planned", where:"gpu_server", deployed:false,
      detects:["Génération rapports","Analyse incidents","Assistant IA","Résumés événements"],
      limitation:"GPU A100 requis ou API externe (OpenAI/Anthropic)",
      action:"Intégrer API Anthropic Claude dans le dashboard pour les rapports",
    },
  ];

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    python_server: { url:SERVER||"Non configuré (NEXT_PUBLIC_AI_SERVER_URL manquant)", online, details:info },
    summary: {
      running:     models.filter(m=>m.deployed).length,
      not_deployed:models.filter(m=>m.status==="not_deployed"||m.status==="server_online_model_missing").length,
      needs_gpu:   models.filter(m=>m.status==="needs_gpu").length,
      total:       models.length,
    },
    honest_status: {
      what_detects_NOW: "COCO-SSD: person/car/truck/bicycle/dog/cat uniquement. PAS de casque, gilet, uniforme, vol.",
      to_get_ppe_detection: "Déployer apps/ai-server sur Railway.app + ajouter FIREBASE_CREDENTIALS_JSON",
      to_get_shoplifting:   "Déployer serveur Python + télécharger shoplifting_wights.pt",
      to_get_gpu_models:    "Créer un serveur GPU séparé (RunPod/GCP) — environ $50-200/mois",
    },
    models,
    deploy_guide: {
      step1: "railway.app → New Project → Deploy from GitHub → sélectionner Guard-Vision-AI",
      step2: "Root directory: apps/ai-server",
      step3: "Variables: FIREBASE_PROJECT_ID=ai-guard-vision-8ef41 + FIREBASE_CREDENTIALS_JSON=<service-account-json>",
      step4: "Copier l'URL Railway → Vercel env: NEXT_PUBLIC_AI_SERVER_URL=https://xxx.railway.app",
      result: "YOLOv11 + ByteTrack + PaddleOCR actifs immédiatement",
    },
  }, { status:200 });
}
