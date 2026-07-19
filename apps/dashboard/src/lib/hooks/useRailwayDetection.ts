/**
 * Hook Railway Detection — YOLOv11 serveur pour tous les modules
 * Fallback COCO-SSD si Railway hors ligne
 */
"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const SERVER = process.env.NEXT_PUBLIC_AI_SERVER_URL ?? "";

export interface RailwayDetection {
  class:      string;
  label:      string;
  icon:       string;
  category:   string;
  severity:   string;
  score:      number;
  confidence: number;
  bbox:       number[];
  center:     number[];
  alert:      boolean;
  module:     string;
  track_id?:  number;
  color?:     string;
}

export function useRailwayDetection(
  videoRef: React.RefObject<HTMLVideoElement>,
  options: {
    enabled:    boolean;
    moduleId:   string;
    fps?:       number;
    confidence?:number;
    onDetection?:(dets: RailwayDetection[]) => void;
  }
) {
  const [detections, setDetections] = useState<RailwayDetection[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [online,     setOnline]     = useState(false);
  const intervalRef  = useRef<NodeJS.Timeout|null>(null);
  const runningRef   = useRef(false);

  const captureFrame = useCallback((): string|null => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    const c = document.createElement("canvas");
    c.width  = Math.min(v.videoWidth, 640);
    c.height = Math.min(v.videoHeight, 480);
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.7).split(",")[1];
  }, [videoRef]);

  const detect = useCallback(async () => {
    if (runningRef.current || !options.enabled || !SERVER) return;
    const frame = captureFrame();
    if (!frame) return;

    runningRef.current = true;
    setLoading(true);
    try {
      const r = await fetch(`${SERVER}/detect`, {
        method:  "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          image:      frame,
          module_id:  options.moduleId,
          confidence: options.confidence ?? 0.42,
        }),
        signal: AbortSignal.timeout(6000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const dets: RailwayDetection[] = data.detections ?? [];
      setDetections(dets);
      setOnline(true);
      if (dets.length) options.onDetection?.(dets);
    } catch {
      setOnline(false);
    } finally {
      runningRef.current = false;
      setLoading(false);
    }
  }, [options, captureFrame]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (options.enabled && SERVER) {
      detect();
      intervalRef.current = setInterval(detect, 1000 / (options.fps ?? 2));
    } else {
      setDetections([]);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [options.enabled, options.fps, detect]);

  return { detections, loading, online };
}
