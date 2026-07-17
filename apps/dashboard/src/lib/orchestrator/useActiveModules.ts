"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { MODULE_CONFIGS, type ModuleConfig } from "./moduleConfigs";

export interface ActiveModule {
  id:     string;
  config: ModuleConfig;
  enabledAt: string;
}

/**
 * Hook — charge les modules installés depuis Firestore en temps réel.
 * Utilisé par la page caméra, live monitor et AI detection
 * pour adapter la détection aux modules actifs.
 */
export function useActiveModules(organizationId: string | undefined) {
  const [modules,  setModules]  = useState<ActiveModule[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!organizationId) { setLoading(false); return; }

    const unsub = onSnapshot(
      collection(db, "organizations", organizationId, "modules"),
      (snap) => {
        const active: ActiveModule[] = snap.docs
          .filter(d => d.data()?.enabled)
          .map(d => ({
            id:        d.id,
            config:    MODULE_CONFIGS[d.id],
            enabledAt: d.data()?.enabledAt ?? "",
          }))
          .filter(m => !!m.config); // garder seulement ceux avec une config
        setModules(active);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [organizationId]);

  // Toutes les classes de tous les modules actifs
  const allClasses = modules.flatMap(m => m.config.classes);

  // Classes uniques par cocoClass (priorité au module le plus sévère)
  const classMap: Record<string, { label:string; color:string; severity:string; alertOn:boolean; confidence:number; moduleId:string }> = {};
  allClasses.forEach(cls => {
    if (!classMap[cls.cocoClass] || cls.severity === "critical") {
      classMap[cls.cocoClass] = {
        label:      cls.label,
        color:      cls.color,
        severity:   cls.severity,
        alertOn:    cls.alertOn,
        confidence: cls.confidence,
        moduleId:   modules.find(m => m.config.classes.some(c => c.cocoClass === cls.cocoClass))?.id ?? "",
      };
    }
  });

  return { modules, loading, classMap, allClasses };
}
