"use client";

import { useState } from "react";
import {
  INDUSTRIAL_LOCATIONS, CONSTRUCTION_LOCATIONS, ENVIRONMENTAL_LOCATIONS,
  getModuleLocationCatalog,
} from "@/lib/catalog/locationCatalog";

interface ModuleLocationPickerProps {
  moduleId:  string;
  moduleName:string;
  moduleIcon:string;
  moduleColor:string;
  onConfirm: (location: { category:string; name:string; fullName:string }) => void;
  onSkip?:   () => void;
}

export function ModuleLocationPicker({
  moduleId, moduleName, moduleIcon, moduleColor, onConfirm, onSkip,
}: ModuleLocationPickerProps) {
  const catalog  = getModuleLocationCatalog(moduleId);
  const [step,   setStep]   = useState<"category"|"location"|"confirm">("category");
  const [catId,  setCatId]  = useState("");
  const [locName,setLocName]= useState("");
  const [custom, setCustom] = useState("");
  const [search, setSearch] = useState("");

  if (!catalog) return null;

  const selectedCat = catalog.categories.find(c => c.id === catId);
  const finalName   = custom.trim() || locName;
  const fullName    = selectedCat ? `${selectedCat.label.replace(/^.* /,"")} — ${finalName}` : finalName;

  const filteredLocs = selectedCat?.locations.filter(l =>
    !search || l.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">

        {/* Header */}
        <div className="border-b border-slate-800 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl text-2xl"
              style={{background:moduleColor+"20",border:`1px solid ${moduleColor}30`}}>
              {moduleIcon}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">📍 Emplacement caméra</p>
              <p className="text-xs text-slate-500">{moduleName} · {catalog.label}</p>
            </div>
          </div>

          {/* Steps */}
          <div className="flex items-center gap-2">
            {(["category","location","confirm"] as const).map((s,i)=>(
              <div key={s} className="flex items-center gap-1.5">
                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  step===s ? "text-white" : i < ["category","location","confirm"].indexOf(step) ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-500"
                }`} style={step===s?{background:moduleColor}:{}}>
                  {i < ["category","location","confirm"].indexOf(step) ? "✓" : i+1}
                </div>
                <span className={`text-xs hidden sm:inline ${step===s?"text-white":"text-slate-600"}`}>
                  {s==="category"?"Catégorie":s==="location"?"Emplacement":"Confirmer"}
                </span>
                {i<2&&<span className="text-slate-700">›</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-5 max-h-80 overflow-y-auto">

          {/* Étape 1 — Catégorie */}
          {step==="category" && (
            <div>
              <p className="text-xs text-slate-400 mb-3">
                Choisissez la zone où sera installée la caméra
              </p>
              <div className="space-y-1.5">
                {catalog.categories.map(cat=>(
                  <button key={cat.id} onClick={()=>{setCatId(cat.id);setStep("location");}}
                    className="w-full flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-left hover:border-slate-500 transition-colors"
                    style={{}}>
                    <span className="text-sm font-medium text-white">{cat.label}</span>
                    <span className="text-xs text-slate-500">{cat.locations.length} empl. →</span>
                  </button>
                ))}
                {/* Zones environnementales communes */}
                <button onClick={()=>{setCatId("environmental");setStep("location");}}
                  className="w-full flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-left hover:border-slate-500">
                  <span className="text-sm font-medium text-white">🌍 Zones extérieures / Environnement</span>
                  <span className="text-xs text-slate-500">{ENVIRONMENTAL_LOCATIONS.locations.length} empl. →</span>
                </button>
              </div>
            </div>
          )}

          {/* Étape 2 — Emplacement */}
          {step==="location" && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <p className="text-xs text-slate-400 flex-1">
                  {catId==="environmental"
                    ? "🌍 Zones extérieures"
                    : catalog.categories.find(c=>c.id===catId)?.label}
                </p>
                <input value={search} onChange={e=>setSearch(e.target.value)}
                  placeholder="Rechercher..."
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:border-slate-500 focus:outline-none w-32"/>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {(catId==="environmental"
                  ? ENVIRONMENTAL_LOCATIONS.locations
                  : filteredLocs
                ).map(loc=>(
                  <button key={loc} onClick={()=>{setLocName(loc);setStep("confirm");}}
                    className={`rounded-lg border px-3 py-2.5 text-left text-xs font-medium text-white transition-colors hover:text-white ${
                      locName===loc
                        ? "border-2 text-white"
                        : "border-slate-700 bg-slate-950 hover:border-slate-500"
                    }`}
                    style={locName===loc?{borderColor:moduleColor,background:moduleColor+"15",color:"white"}:{}}>
                    {loc}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Étape 3 — Confirmation */}
          {step==="confirm" && (
            <div className="space-y-4">
              {/* Résumé */}
              <div className="rounded-xl border p-4" style={{borderColor:moduleColor+"40",background:moduleColor+"10"}}>
                <p className="text-xs mb-1" style={{color:moduleColor}}>✅ Emplacement sélectionné</p>
                <p className="text-lg font-bold text-white">{locName}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {catId==="environmental"?"Zones extérieures":catalog.categories.find(c=>c.id===catId)?.label}
                </p>
              </div>

              {/* Nom personnalisé optionnel */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">
                  Nom personnalisé <span className="text-slate-600">(optionnel — laissez vide pour garder "{locName}")</span>
                </label>
                <input value={custom} onChange={e=>setCustom(e.target.value)}
                  placeholder={`ex: ${locName} #2, ${locName} Angle Nord-Est...`}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-slate-500 focus:outline-none"/>
              </div>

              {/* Nom final */}
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs">
                <p className="text-slate-500 mb-1">Nom final de la caméra</p>
                <p className="text-white font-medium">{finalName || locName}</p>
                <p className="text-slate-600 mt-0.5">
                  ID: CAM-{(catId.slice(0,3)+locName.slice(0,3)).toUpperCase().replace(/[^A-Z]/g,"")}-01
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 p-4 flex gap-3">
          {step!=="category" && (
            <button onClick={()=>{
              if(step==="confirm"){setStep("location");setCustom("");}
              else{setStep("category");setLocName("");setSearch("");}
            }} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:border-slate-500">
              ← Retour
            </button>
          )}

          {onSkip && step==="category" && (
            <button onClick={onSkip}
              className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-500 hover:text-slate-300">
              Passer
            </button>
          )}

          {step==="confirm" && (
            <button onClick={()=>onConfirm({
              category: catId==="environmental"?"Zones extérieures":(catalog.categories.find(c=>c.id===catId)?.label??""),
              name:      finalName || locName,
              fullName,
            })} className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white transition-colors"
              style={{background:moduleColor}}>
              ✅ Confirmer et démarrer la caméra
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
