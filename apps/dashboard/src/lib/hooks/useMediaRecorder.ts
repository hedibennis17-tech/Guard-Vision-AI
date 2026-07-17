"use client";

import { useRef, useCallback, useState } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { storage, db } from "@/lib/firebase/client";

export interface ClipResult {
  videoClipUrl:    string;  // URL Firebase Storage OU blob: URL local (fallback)
  durationSeconds: number;
  sizeKb:          number;
  isLocal?:        boolean; // true = blob URL local, pas encore dans Storage
  storageError?:   string;  // message d'erreur Storage si échec
}

export function useMediaRecorder(videoRef: React.RefObject<HTMLVideoElement>) {
  const recorderRef  = useRef<MediaRecorder | null>(null);
  const chunksRef    = useRef<Blob[]>([]);
  const timeoutRef   = useRef<NodeJS.Timeout | null>(null);
  const blobUrlRef   = useRef<string | null>(null); // blob URL courant (pour cleanup)
  const [recording,  setRecording]  = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [storageOk,  setStorageOk]  = useState<boolean | null>(null); // null=inconnu
  const [lastLog,    setLastLog]    = useState<string>("");

  const startClip = useCallback(async (options: {
    organizationId: string;
    cameraId:       string;
    eventId:        string;
    durationSec?:   number;
  }): Promise<ClipResult | null> => {
    const { organizationId, cameraId, eventId, durationSec = 12 } = options;

    // Récupère le stream depuis le videoRef
    const stream = videoRef.current?.srcObject as MediaStream | null;
    if (!stream) {
      const msg = "⚠️ Pas de flux vidéo détecté";
      setLastLog(msg);
      console.warn("[useMediaRecorder]", msg);
      return null;
    }
    if (recording) {
      const msg = "⚠️ Enregistrement déjà en cours";
      setLastLog(msg);
      return null;
    }

    // Choix du mimeType supporté par le navigateur
    const mimeType = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
    ].find((m) => MediaRecorder.isTypeSupported(m)) ?? "video/webm";

    const startMsg = `🎬 Enregistrement démarré (${mimeType}, ${durationSec}s)`;
    setLastLog(startMsg);
    console.log("[useMediaRecorder]", startMsg);

    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1_200_000 });
    recorderRef.current = recorder;

    return new Promise((resolve) => {
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onerror = (e) => {
        const msg = "❌ Erreur MediaRecorder";
        console.error("[useMediaRecorder]", msg, e);
        setLastLog(msg);
        setRecording(false);
        resolve(null);
      };

      recorder.onstop = async () => {
        setRecording(false);
        setUploading(true);

        const blob = new Blob(chunksRef.current, { type: mimeType });
        const sizeKb = Math.round(blob.size / 1024);
        
        const blobMsg = `📦 Blob prêt: ${sizeKb}KB (${mimeType})`;
        setLastLog(blobMsg);
        console.log("[useMediaRecorder]", blobMsg);

        if (sizeKb < 1) {
          const emptyMsg = "⚠️ Clip vide — capture échouée";
          setLastLog(emptyMsg);
          setUploading(false);
          resolve(null);
          return;
        }

        const ext  = mimeType.includes("mp4") ? "mp4" : "webm";
        const path = `organizations/${organizationId}/clips/${cameraId}/${eventId}.${ext}`;

        try {
          const sRef = ref(storage, path);
          await uploadBytes(sRef, blob, { contentType: mimeType });
          const videoClipUrl = await getDownloadURL(sRef);

          // Mise à jour Firestore
          await updateDoc(doc(db, "organizations", organizationId, "events", eventId), {
            videoClipUrl,
            clipStatus: "ready",
            updatedAt:  new Date().toISOString(),
          });

          setStorageOk(true);
          setUploading(false);
          const okMsg = `✅ Clip → Firebase Storage (${sizeKb}KB)`;
          setLastLog(okMsg);
          console.log("[useMediaRecorder]", okMsg);
          resolve({ videoClipUrl, durationSeconds: durationSec, sizeKb });

        } catch (storageErr: any) {
          // Storage échoue → fallback blob URL local
          const errMsg = storageErr?.message ?? "Erreur Storage";
          setStorageOk(false);

          // Libère l'ancien blob URL si existant
          if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
          const blobUrl = URL.createObjectURL(blob);
          blobUrlRef.current = blobUrl;

          const failMsg = `⚠️ Clip local — Erreur Storage: ${errMsg}`;
          setLastLog(failMsg);
          console.error("[useMediaRecorder]", failMsg);

          // Écrit le blob URL dans Firestore pour que Events page le voie (fallback temporaire)
          try {
            await updateDoc(doc(db, "organizations", organizationId, "events", eventId), {
              videoClipUrl: blobUrl,
              clipStatus:   "local",
              storageError: errMsg,
              updatedAt:    new Date().toISOString(),
            });
          } catch (fsErr) {
            console.error("[useMediaRecorder] Firestore update failed:", fsErr);
          }

          setUploading(false);
          resolve({
            videoClipUrl:  blobUrl,
            durationSeconds: durationSec,
            sizeKb,
            isLocal:       true,
            storageError:  errMsg,
          });
        }
      };

      recorder.start(500);
      setRecording(true);

      timeoutRef.current = setTimeout(() => {
        if (recorder.state === "recording") {
          setLastLog("⏹ Arrêt automatique (timeout)");
          recorder.stop();
        }
      }, durationSec * 1000);
    });
  }, [videoRef, recording]);

  const stopClip = useCallback(() => {
    timeoutRef.current && clearTimeout(timeoutRef.current);
    if (recorderRef.current?.state === "recording") {
      setLastLog("⏹ Arrêt manuel");
      recorderRef.current.stop();
    }
  }, []);

  return { startClip, stopClip, recording, uploading, storageOk, lastLog };
}
