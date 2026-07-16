"use client";

import { useEffect, useRef } from "react";
import type { Detection } from "@/lib/hooks/useYoloDetection";

interface DetectionOverlayProps {
  detections:  Detection[];
  videoRef:    React.RefObject<HTMLVideoElement>;
  className?:  string;
}

/**
 * Canvas transparent superposé sur le flux vidéo.
 * Dessine les bounding boxes + labels YOLO en temps réel.
 */
export function DetectionOverlay({ detections, videoRef, className }: DetectionOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Synchroniser les dimensions du canvas avec la vidéo
    canvas.width  = video.videoWidth  || canvas.offsetWidth;
    canvas.height = video.videoHeight || canvas.offsetHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width  / (video.videoWidth  || canvas.width);
    const scaleY = canvas.height / (video.videoHeight || canvas.height);

    for (const det of detections) {
      const [x, y, w, h] = det.bbox;
      const sx = x * scaleX;
      const sy = y * scaleY;
      const sw = w * scaleX;
      const sh = h * scaleY;

      // ── Bounding box ────────────────────────────────────────────────────
      ctx.strokeStyle = det.color;
      ctx.lineWidth   = 2.5;
      ctx.strokeRect(sx, sy, sw, sh);

      // Remplissage semi-transparent
      ctx.fillStyle = det.color + "18";  // 10% opacité
      ctx.fillRect(sx, sy, sw, sh);

      // ── Label ────────────────────────────────────────────────────────────
      const label    = `${det.class} ${Math.round(det.score * 100)}%`;
      const fontSize = Math.max(11, Math.min(14, sw / 6));
      ctx.font       = `600 ${fontSize}px system-ui, sans-serif`;

      const textMetrics = ctx.measureText(label);
      const labelW      = textMetrics.width + 10;
      const labelH      = fontSize + 8;
      const labelY      = sy > labelH ? sy - labelH : sy + sh;

      // Background du label
      ctx.fillStyle = det.color;
      ctx.beginPath();
      ctx.roundRect(sx - 1, labelY, labelW, labelH, 4);
      ctx.fill();

      // Texte blanc
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(label, sx + 4, labelY + labelH - 5);
    }
  }, [detections, videoRef]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 h-full w-full ${className ?? ""}`}
    />
  );
}
