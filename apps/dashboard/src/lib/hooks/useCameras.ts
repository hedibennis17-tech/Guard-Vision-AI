"use client";

import { useEffect, useState } from "react";
import {
  collection, onSnapshot, query, orderBy,
  doc, getDoc, type Unsubscribe,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase/client";
import type { CameraDoc } from "@visionguard/shared";

interface UseCamerasResult {
  cameras:    CameraDoc[];
  loading:    boolean;
  error:      string | null;
}

/**
 * Écoute en temps réel la collection cameras d'une organisation.
 * Retourne la liste mise à jour automatiquement dès que Firestore change.
 */
export function useCameras(organizationId: string | null): UseCamerasResult {
  const [cameras, setCameras] = useState<CameraDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) {
      setCameras([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const q = query(
      collection(db, "organizations", organizationId, "cameras"),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe: Unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as CameraDoc[];
        setCameras(docs);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("[useCameras]", err);
        setError("Impossible de charger les caméras.");
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [organizationId]);

  return { cameras, loading, error };
}

/** Récupère une caméra unique par ID. */
export async function getCameraById(
  organizationId: string,
  cameraId: string,
): Promise<CameraDoc | null> {
  const snap = await getDoc(
    doc(db, "organizations", organizationId, "cameras", cameraId)
  );
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as CameraDoc;
}
