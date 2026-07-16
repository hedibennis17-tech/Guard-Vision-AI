"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getClassDef } from "@/lib/detection/classMap";

export interface Detection {
  class:    string;
  label:    string;
  category: string;
  score:    number;
  bbox:     [number, number, number, number];
  color:    string;
  severity: string;
}

export type DetectionMode = "browser" | "server" | "off";

export interface UseYoloDetectionOptions {
  mode:         DetectionMode;
  serverUrl?:   string;
  fps?:         number;
  confidence?:  number;
  voteFrames?:  number;  // nb frames pour confirmer (évite faux positifs)
  onDetection?: (dets: Detection[]) => void;
}

export function useYoloDetection(
  videoRef: React.RefObject<HTMLVideoElement>,
  options:  UseYoloDetectionOptions,
) {
  const {
    mode, serverUrl, fps = 8,
    confidence = 0.55,   // Plus strict pour éviter les faux positifs
    voteFrames = 2,      // 2 frames consécutives pour confirmer
    onDetection,
  } = options;

  const [detections, setDetections] = useState<Detection[]>([]);
  const [isLoading,  setIsLoading]  = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [currentFps, setCurrentFps] = useState(0);
  const [error,      setError]      = useState<string | null>(null);

  const modelRef    = useRef<any>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const fpsCount    = useRef(0);
  const fpsTimer    = useRef<NodeJS.Timeout | null>(null);

  // Vote buffer : class → nombre de frames consécutives détectées
  const voteBuffer = useRef<Record<string, number>>({});
  // Motion detection simple
  const prevFrame  = useRef<ImageData | null>(null);

  const hasMotion = useCallback((video: HTMLVideoElement): boolean => {
    try {
      const w = Math.floor(video.videoWidth / 4);
      const h = Math.floor(video.videoHeight / 4);
      if (!w || !h) return true;
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return true;
      ctx.drawImage(video, 0, 0, w, h);
      const curr = ctx.getImageData(0, 0, w, h);
      if (!prevFrame.current) { prevFrame.current = curr; return true; }
      let diff = 0;
      for (let i = 0; i < curr.data.length; i += 4) {
        if (Math.abs(curr.data[i+1] - prevFrame.current.data[i+1]) > 20) diff++;
      }
      prevFrame.current = curr;
      return diff / (curr.data.length / 4) >= 0.005; // 0.5% pixels bougent
    } catch { return true; }
  }, []);

  const mapPrediction = useCallback((cls: string, score: number, bbox: number[]): Detection => {
    const def = getClassDef(cls);
    return { class:cls, label:def.label, category:def.category, score,
             bbox:bbox as [number,number,number,number], color:def.color, severity:def.severity };
  }, []);

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
      setError("Impossible de charger le modèle.");
    } finally { setIsLoading(false); }
  }, []);

  const detect = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !modelRef.current || video.readyState < 2) return;

    // 1. Motion gate — analyser seulement si mouvement
    if (!hasMotion(video)) {
      // Pas de mouvement → décrémente les votes
      Object.keys(voteBuffer.current).forEach((k) => {
        voteBuffer.current[k] = Math.max(0, (voteBuffer.current[k] ?? 0) - 1);
      });
      setDetections([]); // rien à afficher
      fpsCount.current++;
      return;
    }

    // 2. Inférence YOLO
    try {
      const predictions = await modelRef.current.detect(video);

      // 3. Filtrer par confidence et classes pertinentes
      const candidates = predictions.filter((p: any) => {
        // Seuils par catégorie
        const def = getClassDef(p.class);
        const threshold = def.category === "human" ? 0.65   // très strict pour personnes
          : def.category === "animal"   ? 0.55
          : def.category === "vehicle"  ? 0.55
          : def.category === "fire"     ? 0.40   // plus sensible pour feu
          : confidence;
        return p.score >= threshold;
      });

      // 4. Vote buffer — confirmer sur N frames
      const currentClasses = new Set(candidates.map((p: any) => p.class));

      // Incrémenter les classes vues
      for (const p of candidates) {
        voteBuffer.current[p.class] = (voteBuffer.current[p.class] ?? 0) + 1;
      }
      // Décrémenter les classes absentes
      for (const cls of Object.keys(voteBuffer.current)) {
        if (!currentClasses.has(cls)) {
          voteBuffer.current[cls] = Math.max(0, (voteBuffer.current[cls] ?? 0) - 1);
        }
      }

      // 5. Garder seulement les classes confirmées (>= voteFrames)
      const confirmed = candidates.filter((p: any) =>
        (voteBuffer.current[p.class] ?? 0) >= voteFrames
      );

      const dets: Detection[] = confirmed.map((p: any) =>
        mapPrediction(p.class, p.score, p.bbox)
      );

      setDetections(dets);
      if (dets.length > 0) onDetection?.(dets);
      fpsCount.current++;
    } catch {}
  }, [videoRef, confidence, voteFrames, hasMotion, mapPrediction, onDetection]);

  useEffect(() => {
    if (mode === "off") {
      intervalRef.current && clearInterval(intervalRef.current);
      setDetections([]);
      voteBuffer.current = {};
      return;
    }
    const setup = async () => {
      if (mode === "browser") await loadModel();
      intervalRef.current && clearInterval(intervalRef.current);
      intervalRef.current = setInterval(detect, Math.round(1000 / fps));
      fpsTimer.current && clearInterval(fpsTimer.current);
      fpsTimer.current = setInterval(() => {
        setCurrentFps(fpsCount.current); fpsCount.current = 0;
      }, 1000);
    };
    setup();
    return () => {
      intervalRef.current && clearInterval(intervalRef.current);
      fpsTimer.current    && clearInterval(fpsTimer.current);
    };
  }, [mode, fps, loadModel, detect]);

  return { detections, isLoading, modelReady, fps: currentFps, error };
}
