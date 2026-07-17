"use client";

import { useEffect, useState } from "react";
import {
  collection, query, orderBy, limit, onSnapshot,
  doc, updateDoc, serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase/client";
import { useOrganization } from "@/lib/context/OrganizationContext";
import type { EventDoc, CameraDoc } from "@visionguard/shared";

export interface EventWithCamera extends EventDoc {
  cameraName: string;
}

interface UseEvents {
  events:      EventWithCamera[];
  loading:     boolean;
  error:       string | null;
  acknowledge: (eventId: string) => Promise<void>;
}

/**
 * Écoute temps réel des événements de l'organisation courante.
 *
 * Points clés pour éviter le bug "les événements apparaissent puis disparaissent" :
 *  - `loading` est un état SÉPARÉ de `events` : on ne vide jamais la liste
 *    pendant un re-render transitoire.
 *  - On attend que l'organisation soit résolue (orgLoading) avant de conclure
 *    quoi que ce soit ; tant qu'il n'y a pas d'org, on reste en chargement au
 *    lieu d'afficher "aucun événement".
 *  - Le listener `onSnapshot` est correctement nettoyé à chaque changement d'org.
 */
export function useEvents(): UseEvents {
  const { currentOrg, loading: orgLoading } = useOrganization();
  const orgId = currentOrg?.id ?? null;

  const [events,   setEvents]   = useState<EventWithCamera[]>([]);
  const [cameras,  setCameras]  = useState<Record<string, string>>({});
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  // Map cameraId -> name (temps réel)
  useEffect(() => {
    if (!orgId) return;
    const unsub = onSnapshot(
      collection(db, "organizations", orgId, "cameras"),
      (snap) => {
        const map: Record<string, string> = {};
        snap.forEach((d) => {
          const cam = d.data() as CameraDoc;
          map[d.id] = cam.name ?? cam.location ?? d.id;
        });
        setCameras(map);
      },
      () => {/* les noms de caméra sont optionnels : on ignore l'erreur */}
    );
    return unsub;
  }, [orgId]);

  // Écoute temps réel des événements
  useEffect(() => {
    // Tant que l'org n'est pas résolue, on ne touche pas à la liste : on
    // reste simplement en "chargement" pour ne rien faire clignoter.
    if (orgLoading) { setLoading(true); return; }

    // Org résolue mais aucune org disponible : liste vide, plus de chargement.
    if (!orgId) { setEvents([]); setLoading(false); return; }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, "organizations", orgId, "events"),
      orderBy("createdAt", "desc"),
      limit(200),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: EventWithCamera[] = snap.docs.map((d) => {
          const data = d.data() as EventDoc;
          return {
            ...data,
            id: d.id,
            cameraName: cameras[data.cameraId] ?? data.cameraId ?? "Caméra inconnue",
          };
        });
        setEvents(list);
        setLoading(false);
      },
      (err) => {
        console.error("[v0] useEvents onSnapshot error:", err);
        setError(err.message);
        setLoading(false);
      },
    );

    return unsub;
    // On volontairement N'inclut PAS `cameras` dans les deps : les noms de
    // caméra sont réappliqués via le map ci-dessous sans re-souscrire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, orgLoading]);

  // Réapplique les noms de caméra quand le map arrive après les events
  useEffect(() => {
    if (Object.keys(cameras).length === 0) return;
    setEvents((prev) =>
      prev.map((e) => ({ ...e, cameraName: cameras[e.cameraId] ?? e.cameraName }))
    );
  }, [cameras]);

  async function acknowledge(eventId: string) {
    if (!orgId) return;
    // Mise à jour optimiste locale
    setEvents((prev) =>
      prev.map((e) => e.id === eventId ? { ...e, acknowledged: true } : e)
    );
    try {
      await updateDoc(doc(db, "organizations", orgId, "events", eventId), {
        acknowledged:   true,
        acknowledgedBy: auth.currentUser?.uid ?? null,
        acknowledgedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("[v0] acknowledge error:", err);
      // Le listener temps réel corrigera l'état si l'écriture a échoué.
    }
  }

  return { events, loading, error, acknowledge };
}
