"use client";

import { useRef, useCallback, useState } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { storage, db } from "@/lib/firebase/client";

export interface ClipResult {
  videoClipUrl:    string;
  durationSeconds: number;
  sizeKb:          number;
}

export function useMediaRecorder(videoRef: React.RefObject<HTMLVideoElement>) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef   = useRef<Blob[]>([]);
  const timeoutRef  = useRef<NodeJS.Timeout | null>(null);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);

  const startClip = useCallback(async (options: {
    organizationId: string;
    cameraId:       string;
    eventId:        string;
    durationSec?:   number;
  }): Promise<ClipResult | null> => {
    const { organizationId, cameraId, eventId, durationSec = 15 } = options;
    const stream = videoRef.current?.srcObject as MediaStream | null;
    if (!stream || recording) return null;

    const mimeType = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
    ].find((m) => MediaRecorder.isTypeSupported(m)) ?? "video/webm";

    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1_500_000 });
    recorderRef.current = recorder;

    return new Promise((resolve) => {
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };

      recorder.onstop = async () => {
        setRecording(false);
        setUploading(true);
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const ext  = mimeType.includes("mp4") ? "mp4" : "webm";
        const path = `organizations/${organizationId}/clips/${cameraId}/${eventId}.${ext}`;
        try {
          const sRef = ref(storage, path);
          await uploadBytes(sRef, blob, { contentType: mimeType });
          const videoClipUrl = await getDownloadURL(sRef);
          await updateDoc(doc(db, "organizations", organizationId, "events", eventId),
            { videoClipUrl, updatedAt: new Date().toISOString() });
          setUploading(false);
          resolve({ videoClipUrl, durationSeconds: durationSec, sizeKb: Math.round(blob.size / 1024) });
        } catch {
          setUploading(false);
          resolve(null);
        }
      };

      recorder.start(500);
      setRecording(true);
      timeoutRef.current = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, durationSec * 1000);
    });
  }, [videoRef, recording]);

  const stopClip = useCallback(() => {
    timeoutRef.current && clearTimeout(timeoutRef.current);
    recorderRef.current?.state === "recording" && recorderRef.current.stop();
  }, []);

  return { startClip, stopClip, recording, uploading };
}
