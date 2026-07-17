/**
 * AI Orchestrator — Vision Guard AI Hub
 *
 * Architecture :
 * Caméra → Orchestrator → [YOLO + SAM + OCR + ByteTrack + CLIP + LLM]
 *                       → Events → Analytics → Reports → Notifications
 *
 * L'orchestrateur choisit les modèles selon le bundle installé.
 * Chaque bundle définit un pipeline d'exécution spécifique.
 */

import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { getBundleById, type AIBundle } from "./bundles";

export interface OrchestratorContext {
  organizationId: string;
  cameraId:       string;
  enabledBundles: string[];    // IDs des bundles actifs
}

export interface DetectionContext {
  detectedClass:  string;
  confidence:     number;
  category:       string;
  severity:       string;
}

export interface OrchestratorDecision {
  shouldSaveDetection: boolean;
  shouldCreateEvent:   boolean;
  shouldNotify:        boolean;
  shouldRecordClip:    boolean;
  shouldRunOCR:        boolean;
  shouldRunSAM:        boolean;
  shouldRunCLIP:       boolean;
  shouldTrack:         boolean;
  activeModels:        string[];
  reason:              string;
}

/**
 * Décide quelles actions exécuter pour une détection donnée.
 * Basé sur les bundles actifs de l'organisation.
 */
export function orchestrate(
  detection: DetectionContext,
  context:   OrchestratorContext,
): OrchestratorDecision {
  const { enabledBundles } = context;

  // Bundles actifs
  const bundles = enabledBundles
    .map(id => getBundleById(id))
    .filter(Boolean) as AIBundle[];

  // Classes détectées par les bundles actifs
  const allClasses = new Set(bundles.flatMap(b => b.detectionClasses));
  const allModels  = new Set(bundles.flatMap(b => b.models));

  // Vérifier si cette détection est couverte par un bundle actif
  const isCovered = allClasses.has(detection.detectedClass) ||
    detection.category === "human" ||
    detection.category === "fire"  ||
    detection.category === "smoke";

  if (!isCovered && enabledBundles.length > 0) {
    return {
      shouldSaveDetection: false,
      shouldCreateEvent:   false,
      shouldNotify:        false,
      shouldRecordClip:    false,
      shouldRunOCR:        false,
      shouldRunSAM:        false,
      shouldRunCLIP:       false,
      shouldTrack:         false,
      activeModels:        [],
      reason:              `Classe "${detection.detectedClass}" non couverte par les bundles actifs`,
    };
  }

  // Décisions selon les modèles actifs
  const shouldRunOCR  = allModels.has("paddleocr");
  const shouldRunSAM  = allModels.has("sam2");
  const shouldRunCLIP = allModels.has("clip");
  const shouldTrack   = allModels.has("bytetrack");

  // Clip vidéo pour les sévérités importantes
  const shouldRecordClip = detection.severity === "critical" || detection.severity === "warning";

  // Notification pour les sévérités importantes
  const shouldNotify = detection.severity === "critical" || detection.severity === "warning";

  return {
    shouldSaveDetection: true,
    shouldCreateEvent:   true,
    shouldNotify,
    shouldRecordClip,
    shouldRunOCR,
    shouldRunSAM,
    shouldRunCLIP,
    shouldTrack,
    activeModels:        Array.from(allModels),
    reason:              `Bundle(s) actif(s): ${bundles.map(b => b.name).join(", ")}`,
  };
}

/**
 * Charge les bundles actifs depuis Firestore
 */
export async function loadActiveBundles(organizationId: string): Promise<string[]> {
  try {
    const snap = await getDocs(
      collection(db, "organizations", organizationId, "modules")
    );
    return snap.docs
      .filter(d => d.data()?.enabled === true)
      .map(d => d.id);
  } catch {
    return ["home_security"]; // fallback
  }
}

/**
 * Pipeline complet de l'orchestrateur
 * Appelé pour chaque frame avec une détection
 */
export async function runOrchestrator(
  detection:     DetectionContext,
  context:       OrchestratorContext,
  videoElement?: HTMLVideoElement,
): Promise<{ decision: OrchestratorDecision; results: Record<string, any> }> {
  const decision = orchestrate(detection, context);
  const results: Record<string, any> = {};

  if (!decision.shouldSaveDetection) {
    return { decision, results };
  }

  // Log du pipeline
  const pipeline = [
    "🎯 YOLOv11",
    decision.shouldRunSAM   ? "✂️ SAM 2"     : null,
    decision.shouldRunOCR   ? "📖 OCR"        : null,
    decision.shouldTrack    ? "👁️ ByteTrack"  : null,
    decision.shouldRunCLIP  ? "🔗 CLIP"       : null,
    decision.shouldRecordClip ? "🎬 Clip"     : null,
    decision.shouldNotify   ? "🔔 Notif"      : null,
  ].filter(Boolean).join(" → ");

  results.pipeline = pipeline;
  results.decision = decision;

  return { decision, results };
}
