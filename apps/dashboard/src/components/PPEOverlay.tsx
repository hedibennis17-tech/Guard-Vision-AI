"use client";
/**
 * PPE Overlay — Vision Guard AI
 * Affiche les boxes colorées par type d'EPI
 * Vert = présent, Rouge = absent/manquant, Bleu = personne
 */
import { useEffect, useRef } from "react";

interface Detection {
  class:  string;
  label:  string;
  bbox:   number[];
  score:  number;
  color?: string;
  icon?:  string;
  alert?: boolean;
}

interface Worker {
  worker_id:    number;
  bbox:         number[];
  color:        string;
  score:        number;
  compliant:    boolean;
  epi_present:  {label:string; bbox:number[]; color:string}[];
  epi_absent:   {label:string; bbox:number[]; color:string}[];
  missing_items:string[];
}

interface PPEOverlayProps {
  detections: Detection[];
  workers?:   Worker[];
  videoRef:   React.RefObject<HTMLVideoElement>;
}

export function PPEOverlay({ detections, workers = [], videoRef }: PPEOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width  = video.videoWidth  || video.clientWidth;
    canvas.height = video.videoHeight || video.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width  / (video.videoWidth  || canvas.width);
    const scaleY = canvas.height / (video.videoHeight || canvas.height);

    function drawBox(
      bbox: number[], label: string, color: string,
      score?: number, bold?: boolean
    ) {
      if (!bbox || bbox.length < 4) return;
      const [x1,y1,x2,y2] = bbox;
      const w = (x2-x1)*scaleX, h = (y2-y1)*scaleY;
      const sx = x1*scaleX, sy = y1*scaleY;

      // Box
      ctx!.strokeStyle = color;
      ctx!.lineWidth   = bold ? 3 : 2;
      ctx!.strokeRect(sx, sy, w, h);

      // Fond label
      const fontSize = bold ? 13 : 11;
      ctx!.font = `${bold?"bold ":""}${fontSize}px sans-serif`;
      const text = score ? `${label} ${Math.round(score*100)}%` : label;
      const tw   = ctx!.measureText(text).width;
      ctx!.fillStyle = color;
      ctx!.fillRect(sx, sy - fontSize - 4, tw + 8, fontSize + 6);

      // Texte
      ctx!.fillStyle = "#FFFFFF";
      ctx!.fillText(text, sx + 4, sy - 4);
    }

    if (workers.length > 0) {
      // Mode PPE Engine — boxes par personne et EPI
      for (const w of workers) {
        // Box personne
        drawBox(w.bbox, `#${w.worker_id} ${w.compliant?"✅":"❌"} ${w.score}%`, w.color, undefined, true);

        // EPI présents — vert
        for (const e of w.epi_present) {
          if (e.bbox) drawBox(e.bbox, e.label, "#10B981");
        }
        // EPI absents — rouge
        for (const a of w.epi_absent) {
          if (a.bbox) drawBox(a.bbox, a.label, "#EF4444", undefined, true);
        }
      }
    } else {
      // Mode fallback — boxes par détection individuelle
      for (const det of detections) {
        if (!det.bbox) continue;
        const color =
          det.color || (det.alert ? "#EF4444" : det.class==="person" ? "#3B82F6" : "#10B981");
        drawBox(det.bbox, `${det.icon||""} ${det.label}`, color, det.score);
      }
    }
  }, [detections, workers, videoRef]);

  return (
    <canvas ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{mixBlendMode:"normal"}}/>
  );
}
