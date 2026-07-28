"use client";
import { ALL_MODULE_CONFIGS } from "@/lib/orchestrator/allModuleConfigs";
import { UniversalModulePage } from "@/components/UniversalModulePage";
import TrafficGuardPage from "../trafficguard/page";
import Link from "next/link";

const TRAFFIC_MODULES = new Set(["transportation","trafficguard","traffic"]);

export default function ModulePage({ params }: { params: { moduleId: string } }) {
  // TrafficGuard = module dédié avec détection véhicules + plaques
  if (TRAFFIC_MODULES.has(params.moduleId)) {
    return <TrafficGuardPage />;
  }

  const config = ALL_MODULE_CONFIGS[params.moduleId];
  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <span className="text-6xl">🔍</span>
        <p className="text-lg font-semibold text-white">Module introuvable</p>
        <Link href="/modules" className="rounded-xl bg-brand px-6 py-2.5 text-sm font-medium text-white">
          ← Retour
        </Link>
      </div>
    );
  }
  return <UniversalModulePage config={config} />;
}
