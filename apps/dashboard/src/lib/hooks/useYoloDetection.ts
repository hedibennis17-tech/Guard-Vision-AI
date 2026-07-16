"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getClassDef } from "@/lib/detection/classMap";

export interface Detection {
  class:      string;
  label:      string;
  category:   string;
  score:      number;
  bbox:       [number, number, number, number];
  color:      string;
  severity:   string;
}

export type DetectionMode = "browser" | "server" | "off";

export interface UseYoloDetectionOptions {
  mode:              DetectionMode;
  serverUrl?:        string;
  fps?:              number;
  confidence?:       number;
  onDetection?:      (detections: Detection[]) => void;  // callback pour sauvegarder
}

export interface UseYoloDetectionResult {
  detections:  Detection[];
  isLoading:   boolean;
  modelReady:  boolean;
  fps:         number;
  error:       string | null;
}

export function useYoloDetection(
  videoRef: React.RefObject<HTMLVideoElement>,
  options:  UseYoloDetectionOptions,
): UseYoloDetectionResult {
  const { mode, serverUrl, fps = 10, confidence = 0.40, onDetection } = options;

  const [detections, setDetections] = useState<Detection[]>([]);
  const [isLoading,  setIsLoading]  = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [currentFps, setCurrentFps] = useState(0);
  const [error,      setError]      = useState<string | null>(null);

  const modelRef    = useRef<any>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const fpsCount    = useRef(0);
  const fpsTimer    = useRef<NodeJS.Timeout | null>(null);

  // Mapper une prédiction → Detection Vision Guard
  const mapPrediction = useCallback((cls: string, score: number, bbox: number[]): Detection => {
    const def = getClassDef(cls);
    return {
      class:    cls,
      label:    def.label,
      category: def.category,
      score,
      bbox:     bbox as [number, number, number, number],
      color:    def.color,
      severity: def.severity,
    };
  }, []);

  // ── Mode browser : TF.js COCO-SSD ──────────────────────────────────────
  const loadModel = useCallback(async () => {
    if (modelRef.current) return;
    setIsLoading(true);
    setError(null);
    try {
      await import("@tensorflow/tfjs");
      const cocoSsd = await import("@tensorflow-models/coco-ssd");
      modelRef.current = await cocoSsd.load({ base: "mobilenet_v2" });
      setModelReady(true);
    } catch {
      setError("Impossible de charger le modèle IA.");
    } finally {
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
        .map((p: any) => mapPrediction(p.class, p.score, p.bbox));

      setDetections(dets);
      if (dets.length > 0) onDetection?.(dets);
      fpsCount.current++;
    } catch {}
  }, [videoRef, confidence, mapPrediction, onDetection]);

  // ── Mode server : Python AI Engine ─────────────────────────────────────
  const detectServer = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !serverUrl) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0);
      const base64 = canvas.toDataURL("image/jpeg", 0.65).split(",")[1];

      const res = await fetch(`${serverUrl}/analyze/frame`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ image_base64: base64 }),
        signal:  AbortSignal.timeout(2000),
      });
      if (!res.ok) throw new Error("Serveur non disponible");

      const data = await res.json();
      const vw = video.videoWidth;
      const vh = video.videoHeight;

      const dets: Detection[] = (data.detections ?? [])
        .filter((d: any) => d.confidence >= confidence)
        .map((d: any) => {
          const bb = d.bounding_box;
          const px_x = (bb.x - bb.width  / 2) * vw;
          const px_y = (bb.y - bb.height / 2) * vh;
          return mapPrediction(d.class_name, d.confidence, [px_x, px_y, bb.width * vw, bb.height * vh]);
        });

      setDetections(dets);
      if (dets.length > 0) onDetection?.(dets);
      setModelReady(true);
      setError(null);
      fpsCount.current++;
    } catch (err: any) {
      if (err.name !== "AbortError") setError("YOLOv11 server unreachable. Passer en mode navigateur.");
    }
  }, [videoRef, serverUrl, confidence, mapPrediction, onDetection]);

  // ── Boucle principale ───────────────────────────────────────────────────
  useEffect(() => {
    if (mode === "off") {
      intervalRef.current && clearInterval(intervalRef.current);
      setDetections([]);
      setModelReady(false);
      return;
    }

    const setup = async () => {
      if (mode === "browser") await loadModel();
      intervalRef.current && clearInterval(intervalRef.current);
      intervalRef.current = setInterval(
        mode === "browser" ? detectBrowser : detectServer,
        Math.round(1000 / fps),
      );
      fpsTimer.current && clearInterval(fpsTimer.current);
      fpsTimer.current = setInterval(() => {
        setCurrentFps(fpsCount.current);
        fpsCount.current = 0;
      }, 1000);
    };

    setup();
    return () => {
      intervalRef.current && clearInterval(intervalRef.current);
      fpsTimer.current    && clearInterval(fpsTimer.current);
    };
  }, [mode, fps, loadModel, detectBrowser, detectServer]);

  return { detections, isLoading, modelReady, fps: currentFps, error };
}
