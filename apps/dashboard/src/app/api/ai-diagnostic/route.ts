import { NextResponse } from "next/server";

const SERVER = process.env.NEXT_PUBLIC_AI_SERVER_URL ?? "";

async function pingServer() {
  if (!SERVER) return { online: false, info: null, latency: null };
  const start = Date.now();
  try {
    const res = await fetch(`${SERVER}/`, {
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    const latency = Date.now() - start;
    return { online: res.ok, info: res.ok ? await res.json() : null, latency };
  } catch {
    return { online: false, info: null, latency: null };
  }
}

export async function GET() {
  const { online, info, latency } = await pingServer();

  const models = [
    {
      id: "coco_ssd",
      name: "COCO-SSD (TensorFlow.js)",
      icon: "🟢",
      status: "running",
      where: "Navigateur",
      deployed: true,
      detects: [
        "person","car","truck","bus","motorcycle","bicycle",
        "dog","cat","horse","cow","sheep","bird",
        "backpack","handbag","suitcase","cell phone",
        "bottle","scissors","stop sign","traffic light",
      ],
      limitation: "Détecte les objets MAIS ne sait pas si casque/gilet/uniforme absent",
      action: "✅ Actif maintenant — aucune installation requise",
    },
    {
      id: "yolov11",
      name: "YOLOv11n (ONNX Runtime)",
      icon: online ? "🟢" : "🔴",
      status: online ? "running" : "not_deployed",
      where: "Serveur Railway",
      deployed: online,
      detects: [
        "Toutes les classes COCO (80)",
        "Alertes enrichies par module",
        "Construction: Travailleur → vérif EPI",
        "Industrial: Vérif uniforme",
        "Defense: INTRUS critique",
        "Retail: Sac suspect",
      ],
      limitation: online
        ? "Modèle général COCO — poids PPE custom non encore chargés"
        : "Serveur Python non déployé ou NEXT_PUBLIC_AI_SERVER_URL manquant",
      action: online
        ? "✅ Actif sur Railway — " + SERVER
        : "Déployer apps/ai-server sur Railway.app",
    },
    {
      id: "bytetrack",
      name: "ByteTrack (Tracking multi-objets)",
      icon: online ? "🟢" : "🔴",
      status: online ? "running" : "not_deployed",
      where: "Serveur Railway",
      deployed: online,
      detects: [
        "ID unique par personne/véhicule",
        "Trajectoires entre frames",
        "Comptage entrées/sorties",
        "Suivi persistant cross-frame",
      ],
      limitation: "Inclus dans le serveur Python",
      action: online ? "✅ Actif — inclus dans YOLOv11" : "Déployer le serveur Python",
    },
    {
      id: "shoplifting",
      name: "YOLOv11 Shoplifting (PyResearch)",
      icon: "🟡",
      status: "fallback_active",
      where: "Serveur Railway",
      deployed: online,
      detects: [
        online
          ? "Mode fallback: backpack/suitcase suspects"
          : "Non disponible",
        "Mode précis: VOL DÉTECTÉ (nécessite shoplifting_wights.pt)",
        "cls0 = Normal | cls1 = Shoplifting",
      ],
      limitation: "shoplifting_wights.pt non publié par PyResearch — fallback comportemental actif",
      action: online
        ? "⚠️ Fallback actif — contacter PyResearch ou entraîner avec train.py"
        : "Déployer le serveur d'abord",
    },
    {
      id: "paddleocr",
      name: "PaddleOCR (Plaques + Texte)",
      icon: "🔴",
      status: "not_deployed",
      where: "À installer",
      deployed: false,
      detects: [
        "Plaques d'immatriculation (ALPR)",
        "Numéros de série",
        "Texte sur panneaux",
        "Codes-barres et QR codes",
      ],
      limitation: "Package non installé sur Railway (trop lourd pour le build actuel)",
      action: "Ajouter paddlepaddle + paddleocr sur un serveur avec plus de RAM",
    },
    {
      id: "yolov11_ppe",
      name: "YOLOv11 PPE Custom (Casque/Gilet/Uniforme)",
      icon: "🔴",
      status: "weights_missing",
      where: "Serveur Railway",
      deployed: false,
      detects: [
        "helmet ✓ / no_helmet 🚨",
        "safety_vest ✓ / no_vest 🚨",
        "uniform ✓ / no_uniform ⚠️",
        "fall_harness ✓ / no_harness 🚨",
        "safety_boots ✓",
        "worker / visitor / intruder",
      ],
      limitation: "Poids ppe.pt non encore disponibles — modèle à fine-tuner sur dataset PPE",
      action: "Entraîner YOLOv11 sur dataset PPE public (Roboflow) → uploader models/ppe.pt",
    },
    {
      id: "sam2",
      name: "SAM 2 (Meta — Segmentation)",
      icon: "⚫",
      status: "needs_gpu",
      where: "GPU Server",
      deployed: false,
      detects: [
        "Segmentation pixel-perfect",
        "Découpe précise d'objets",
        "Masques haute résolution",
        "Tracking par segmentation",
      ],
      limitation: "GPU NVIDIA 16GB+ VRAM requis — Railway CPU uniquement",
      action: "RunPod.io ou Google Cloud Run GPU (~$0.50/heure)",
    },
    {
      id: "grounding_dino",
      name: "Grounding DINO",
      icon: "⚫",
      status: "needs_gpu",
      where: "GPU Server",
      deployed: false,
      detects: [
        "Détection open-vocabulary via texte",
        "'Trouve les tracteurs rouges'",
        "Aucun entraînement requis",
        "Zero-shot detection",
      ],
      limitation: "GPU 7GB+ VRAM requis",
      action: "Serveur GPU dédié",
    },
    {
      id: "florence2",
      name: "Florence-2 (Microsoft)",
      icon: "⚫",
      status: "needs_gpu",
      where: "GPU Server",
      deployed: false,
      detects: [
        "Compréhension scènes complexes",
        "Description automatique",
        "OCR avancé",
        "Analyse comportements",
      ],
      limitation: "GPU A100 14GB+ VRAM requis",
      action: "Serveur GPU dédié",
    },
    {
      id: "clip",
      name: "CLIP (OpenAI — Recherche sémantique)",
      icon: "⚫",
      status: "needs_gpu",
      where: "GPU Server",
      deployed: false,
      detects: [
        "Recherche par texte dans vidéo",
        "Images similaires",
        "Classification zero-shot",
        "Vision-langage",
      ],
      limitation: "GPU fortement recommandé (très lent CPU)",
      action: "Inclure dans serveur GPU avec SAM2",
    },
    {
      id: "llm",
      name: "LLM — Rapports IA (Claude/Llama/Qwen)",
      icon: "🟡",
      status: "partial",
      where: "API externe",
      deployed: false,
      detects: [
        "Génération rapports PDF",
        "Analyse incidents",
        "Résumés événements",
        "Assistant IA conversationnel",
      ],
      limitation: "Llama/Qwen = GPU A100. Alternative: API Anthropic Claude (immédiat)",
      action: "Intégrer API Anthropic Claude → rapports IA disponibles sans GPU",
    },
  ];

  const running    = models.filter(m => m.deployed).length;
  const fallback   = models.filter(m => m.status === "fallback_active").length;
  const notDeplyed = models.filter(m => ["not_deployed","weights_missing"].includes(m.status)).length;
  const needsGPU   = models.filter(m => m.status === "needs_gpu").length;

  return NextResponse.json({
    timestamp:     new Date().toISOString(),
    server: {
      url:     SERVER || "❌ NEXT_PUBLIC_AI_SERVER_URL non configuré",
      online,
      latency: latency ? `${latency}ms` : null,
      yolo:    info?.yolo ?? null,
      firebase:info?.firebase ?? null,
      version: info?.version ?? null,
    },
    summary: {
      total:        models.length,
      running,
      fallback,
      not_deployed: notDeplyed,
      needs_gpu:    needsGPU,
    },
    current_capabilities: {
      works_now: [
        "✅ Détection COCO-SSD navigateur (80 classes)",
        online ? "✅ YOLOv11n serveur Railway + ByteTrack" : "❌ Serveur Railway hors ligne",
        online ? "⚠️ Retail: fallback comportemental (sacs suspects)" : "",
        "✅ Events + Notifications → Firestore temps réel",
        "✅ Enregistrement vidéo → Firebase Storage",
        "✅ 8 modules avec tabs Camera/AI/Events/Notifs/Analytics/Rapports",
      ].filter(Boolean),
      not_working: [
        "❌ Casque/gilet/uniforme absent → YOLOv11 PPE custom (poids manquants)",
        "❌ Vol précis → shoplifting_wights.pt (PyResearch privé)",
        "❌ Lecture plaques → PaddleOCR non installé",
        "❌ Segmentation → SAM2 (GPU requis)",
        "❌ Rapports IA → LLM (GPU ou API)",
      ],
    },
    next_steps: [
      {
        priority: 1,
        task:     "Entraîner YOLOv11 PPE custom",
        impact:   "Détection casque/gilet/uniforme pour Construction + Industrial",
        effort:   "Dataset Roboflow public + 30min entraînement",
      },
      {
        priority: 2,
        task:     "Intégrer API Anthropic Claude pour rapports",
        impact:   "Génération rapports IA sur tous les modules",
        effort:   "Clé API Anthropic + 2h développement",
      },
      {
        priority: 3,
        task:     "Installer PaddleOCR sur serveur dédié",
        impact:   "Lecture plaques pour TrafficGuard",
        effort:   "Serveur 4GB RAM séparé ou Railway Pro",
      },
      {
        priority: 4,
        task:     "Serveur GPU pour SAM2 + CLIP + Florence-2",
        impact:   "Segmentation précise + recherche sémantique",
        effort:   "RunPod ~$50/mois",
      },
    ],
    models,
  }, { status: 200 });
}
