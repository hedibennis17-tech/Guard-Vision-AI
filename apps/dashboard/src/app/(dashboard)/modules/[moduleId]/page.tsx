"use client";
import { ALL_MODULE_CONFIGS } from "@/lib/orchestrator/allModuleConfigs";
import { UniversalModulePage } from "@/components/UniversalModulePage";
import { PPEModulePage } from "@/components/PPEModulePage";
import Link from "next/link";

// Modules avec détection PPE via Railway
const PPE_MODULES = new Set(["construction", "industrial", "defense"]);

export default function ModulePage({ params }: { params: { moduleId: string } }) {
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

  // Modules PPE → page spécialisée avec boxes colorées
  if (PPE_MODULES.has(params.moduleId)) {
    return <PPEModulePage config={config} />;
  }

  return <UniversalModulePage config={config} />;
}
