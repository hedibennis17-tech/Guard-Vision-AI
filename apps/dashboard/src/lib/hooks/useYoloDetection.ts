"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface Detection {
  class:      string;
  score:      number;            // 0-1
  bbox:       [number, number, number, number]; // [x, y, width, height] en pixels
  color:      string;
}

export type DetectionMode = "browser" | "server" | "off";

export interface UseYoloDetectionOptions {
  mode:          DetectionMode;
  serverUrl?:    string;   // URL du Python AI Engine ex: http://localhost:8000
  fps?:          number;   // frames analysées par seconde (défaut: 10)
  confidence?:   number;   // seuil minimum (défaut: 0.45)
}

export interface UseYoloDetectionResult {
  detections:   Detection[];
  isLoading:    boolean;
  modelReady:   boolean;
  fps:          number;
  error:        string | null;
  mode:         DetectionMode;
}

// Palette de couleurs par classe
const CLASS_COLORS: Record<string, string> = {
  person:      "#0EA5E9",   // bleu brand
  car:         "#8B5CF6",   // violet
  truck:       "#6366F1",   // indigo
  bus:         "#06B6D4",   // cyan
  motorcycle:  "#3B82F6",   // bleu
  bicycle:     "#60A5FA",   // bleu clair
  dog:         "#F59E0B",   // amber
  cat:         "#FBBF24",   // jaune
  bird:        "#FCD34D",   // jaune clair
  fire:        "#EF4444",   // rouge
  smoke:       "#F97316",   // orange
  default:     "#10B981",   // vert
};

export function getDetectionColor(className: string): string {
  return CLASS_COLORS[className.toLowerCase()] ?? CLASS_COLORS.default;
}

export function useYoloDetection(
  videoRef: React.RefObject<HTMLVideoElement>,
  options: UseYoloDetectionOptions,
): UseYoloDetectionResult {
  const { mode, serverUrl, fps = 10, confidence = 0.45 } = options;

  const [detections, setDetections] = useState<Detection[]>([]);
  const [isLoading,  setIsLoading]  = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [currentFps, setCurrentFps] = useState(0);
  const [error,      setError]      = useState<string | null>(null);

  const modelRef     = useRef<any>(null);
  const intervalRef  = useRef<NodeJS.Timeout | null>(null);
  const fpsCountRef  = useRef(0);
  const fpsTimerRef  = useRef<NodeJS.Timeout | null>(null);

  // ── Mode browser : TensorFlow.js COCO-SSD ───────────────────────────────
  const loadBrowserModel = useCallback(async () => {
    if (modelRef.current) return;
    setIsLoading(true);
    setError(null);
    try {
      const tf     = await import("@tensorflow/tfjs");
      const cocoSsd = await import("@tensorflow-models/coco-ssd");
      await tf.ready();
      modelRef.current = await cocoSsd.load({
        base: "mobilenet_v2",   // rapide, précis
      });
      setModelReady(true);
      setIsLoading(false);
    } catch (err: any) {
      setError("Impossible de charger le modèle IA. Vérifiez votre connexion.");
      setIsLoading(false);
    }
  }, []);

  const detectBrowser = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !modelRef.current || video.readyState < 2) return;
    try {
      const predictions = await modelRef.current.detect(video);
      const dets: Detection[] = predictions
        .filter((p: any) => p.score >= confidence)
        .map((p: any) => ({
          class: p.class,
          score: p.score,
          bbox:  p.bbox as [number, number, number, number],
          color: getDetectionColor(p.class),
        }));
      setDetections(dets);
      fpsCountRef.current++;
    } catch {}
  }, [videoRef, confidence]);

  // ── Mode server : envoyer frames au Python AI Engine ───────────────────
  const detectServer = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !serverUrl) return;
    try {
      // Capturer une frame du flux vidéo
      const canvas = document.createElement("canvas");
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);
      const base64 = canvas.toDataURL("image/jpeg", 0.7).split(",")[1];

      const response = await fetch(`${serverUrl}/analyze/frame`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ image_base64: base64 }),
        signal:  AbortSignal.timeout(2000),
      });

      if (!response.ok) throw new Error("AI Engine non disponible");
      const data = await response.json();

      const dets: Detection[] = (data.detections ?? [])
        .filter((d: any) => d.confidence >= confidence)
        .map((d: any) => {
          // Convertir bounding box normalisée → pixels
          const w = video.videoWidth;
          const h = video.videoHeight;
          return {
            class: d.class_name,
            score: d.confidence,
            bbox: [
              (d.bounding_box.x - d.bounding_box.width  / 2) * w,
              (d.bounding_box.y - d.bounding_box.height / 2) * h,
              d.bounding_box.width  * w,
              d.bounding_box.height * h,
            ] as [number, number, number, number],
            color: getDetectionColor(d.class_name),
          };
        });

      setDetections(dets);
      setModelReady(true);
      setError(null);
      fpsCountRef.current++;
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setError("AI Engine non joignable. Mode navigateur disponible.");
      }
    }
  }, [videoRef, serverUrl, confidence]);

  // ── Boucle principale ───────────────────────────────────────────────────
  useEffect(() => {
    if (mode === "off") {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setDetections([]);
      return;
    }

    const setup = async () => {
      if (mode === "browser") await loadBrowserModel();

      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(
        mode === "browser" ? detectBrowser : detectServer,
        Math.round(1000 / fps),
      );

      // Compteur FPS
      if (fpsTimerRef.current) clearInterval(fpsTimerRef.current);
      fpsTimerRef.current = setInterval(() => {
        setCurrentFps(fpsCountRef.current);
        fpsCountRef.current = 0;
      }, 1000);
    };

    setup();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (fpsTimerRef.current) clearInterval(fpsTimerRef.current);
    };
  }, [mode, fps, loadBrowserModel, detectBrowser, detectServer]);

  return { detections, isLoading, modelReady, fps: currentFps, error, mode };
}
