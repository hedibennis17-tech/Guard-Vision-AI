/**
 * Hook PPE Detection — appelle Railway /detect/ppe avec les frames caméra
 * Retourne detections + workers + site_compliance en temps réel
 */
"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const SERVER = process.env.NEXT_PUBLIC_AI_SERVER_URL ?? "";

export interface PPEWorker {
  worker_id:    number;
  bbox:         number[];
  color:        string;
  score:        number;
  compliant:    boolean;
  epi_present:  {label:string; bbox:number[]; color:string; icon:string}[];
  epi_absent:   {label:string; bbox:number[]; color:string; icon:string}[];
  missing_items:string[];
  violations:   number;
  label:        string;
  confidence:   number;
  timeline:     {time:string; event:string; type:string}[];
}

export interface PPEResult {
  detections:      any[];
  workers:         PPEWorker[];
  site_compliance: { score:number; total_workers:number; compliant:number; violations:number; status:string; color:string };
  all_alerts:      any[];
  timestamp:       string;
}

export function usePPEDetection(
  videoRef: React.RefObject<HTMLVideoElement>,
  options: {
    enabled:   boolean;
    sector:    string;
    fps?:      number;
    orgId?:    string;
    camId?:    string;
    onResult?: (result: PPEResult) => void;
  }
) {
  const [result,   setResult]   = useState<PPEResult|null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string|null>(null);
  const intervalRef = useRef<NodeJS.Timeout|null>(null);
  const runningRef  = useRef(false);

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const canvas = document.createElement("canvas");
    canvas.width  = Math.min(video.videoWidth, 640);
    canvas.height = Math.min(video.videoHeight, 480);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7).split(",")[1];
  }, [videoRef]);

  const detect = useCallback(async () => {
    if (runningRef.current || !options.enabled) return;
    if (!SERVER) { setError("NEXT_PUBLIC_AI_SERVER_URL non configuré"); return; }
    const frame = captureFrame();
    if (!frame) return;

    runningRef.current = true;
    setLoading(true);
    try {
      const r = await fetch(`${SERVER}/detect/ppe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image:           frame,
          sector:          options.sector,
          organization_id: options.orgId ?? "",
          camera_id:       options.camId ?? "",
          confidence:      0.40,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data: PPEResult = await r.json();
      if ((data as any).error) throw new Error((data as any).error);
      setResult(data);
      setError(null);
      options.onResult?.(data);
    } catch(e:any) {
      setError(e.message);
    } finally {
      runningRef.current = false;
      setLoading(false);
    }
  }, [options, captureFrame]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (options.enabled) {
      detect();
      const ms = Math.round(1000 / (options.fps ?? 2));
      intervalRef.current = setInterval(detect, ms);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [options.enabled, options.fps, detect]);

  return { result, loading, error };
}
