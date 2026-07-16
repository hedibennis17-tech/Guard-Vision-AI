"use client";

import { useRef, useCallback } from "react";

/**
 * Détection de mouvement par comparaison de frames.
 * N'analyse avec YOLO que si un vrai mouvement est détecté.
 * Réduit drastiquement les faux positifs.
 */

export function useMotionDetection() {
  const prevFrameRef = useRef<ImageData | null>(null);

  /**
   * Retourne le % de pixels qui ont changé entre la frame précédente et la courante.
   * 0 = pas de mouvement, 1 = toute l'image a changé.
   */
  const detectMotion = useCallback((
    video:    HTMLVideoElement,
    minChange: number = 0.008, // 0.8% de pixels = mouvement réel
  ): boolean => {
    try {
      const w = Math.floor(video.videoWidth  / 4); // sous-résolution 4x pour perf
      const h = Math.floor(video.videoHeight / 4);
      if (w === 0 || h === 0) return true;

      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return true;

      ctx.drawImage(video, 0, 0, w, h);
      const curr = ctx.getImageData(0, 0, w, h);

      if (!prevFrameRef.current || prevFrameRef.current.width !== w) {
        prevFrameRef.current = curr;
        return true; // première frame → analyser
      }

      const prev = prevFrameRef.current;
      let diffPixels = 0;
      const total = curr.data.length / 4;

      for (let i = 0; i < curr.data.length; i += 4) {
        // Différence sur canal vert (moins sensible aux variations lumière)
        const diff = Math.abs(curr.data[i+1] - prev.data[i+1]);
        if (diff > 25) diffPixels++;
      }

      prevFrameRef.current = curr;
      const motionRatio = diffPixels / total;
      return motionRatio >= minChange;
    } catch {
      return true;
    }
  }, []);

  return { detectMotion };
}
