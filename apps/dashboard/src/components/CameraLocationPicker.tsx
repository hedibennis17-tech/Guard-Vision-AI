"use client";

import { useState } from "react";
import {
  LOCATION_CATALOG, buildCameraName, buildCameraId,
  type LocationSector,
} from "@/lib/catalog/locationCatalog";

interface PickerValue {
  sectorId:    string;
  typeId:      string;
  zoneId:      string;
  locationId:  string;
  customName:  string;
  cameraName:  string;
  cameraId:    string;
}

interface CameraLocationPickerProps {
  onConfirm: (value: PickerValue) => void;
  onCancel?: () => void;
}

export function CameraLocationPicker({ onConfirm, onCancel }: CameraLocationPickerProps) {
  const [step,       setStep]       = useState<1|2|3|4|5>(1);
  const [sectorId,   setSectorId]   = useState("");
  const [typeId,     setTypeId]     = useState("");
  const [zoneId,     setZoneId]     = useState("");
  const [locationId, setLocationId] = useState("");
  const [customName, setCustomName] = useState("");
  const [camIndex,   setCamIndex]   = useState(1);

  const sector   = LOCATION_CATALOG.find(s=>s.id===sectorId);
  const type     = sector?.types.find(t=>t.id===typeId);
  const zone     = type?.zones.find(z=>z.id===zoneId);
  const location = zone?.emplacements.find(e=>e.id===locationId);

  const autoName  = buildCameraName(sectorId,typeId,zoneId,locationId,customName);
  const autoCamId = buildCameraId(zoneId,locationId,camIndex);

  // Breadcrumb
  const crumbs = [
    sector?.label,
    type?.label,
    zone?.label,
    location?.label,
  ].filter(Boolean);

  function confirm() {
    onConfirm({
      sectorId, typeId, zoneId, locationId, customName,
      cameraName: autoName,
      cameraId:   autoCamId,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">

        {/* Header */}
        <div className="border-b border-slate-800 px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-semibold text-white">📍 Emplacement de la caméra</h2>
            {onCancel && (
              <button onClick={onCancel} className="text-slate-500 hover:text-white">✕</button>
            )}
          </div>
          {/* Steps */}
          <div className="flex items-center gap-1">
            {["Secteur","Type","Zone","Emplacement","Nom"].map((s,i)=>(
              <div key={s} className="flex items-center gap-1">
                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  step>i+1?"bg-emerald-600 text-white"
                  :step===i+1?"bg-brand text-white"
                  :"bg-slate-800 text-slate-500"}`}>
                  {step>i+1?"✓":i+1}
                </div>
                <span className={`text-xs hidden sm:inline ${step===i+1?"text-white":"text-slate-600"}`}>{s}</span>
                {i<4&&<span className="text-slate-700 text-xs">›</span>}
              </div>
            ))}
          </div>
          {/* Breadcrumb */}
          {crumbs.length>0&&(
            <p className="mt-2 text-xs text-slate-500">{crumbs.join(" › ")}</p>
          )}
        </div>

        <div className="p-5 max-h-96 overflow-y-auto">

          {/* Étape 1 — Secteur */}
          {step===1&&(
            <div>
              <p className="text-xs text-slate-400 mb-3">Choisissez le type de lieu</p>
              <div className="grid grid-cols-2 gap-2">
                {LOCATION_CATALOG.map(s=>(
                  <button key={s.id} onClick={()=>{setSectorId(s.id);setStep(2);}}
                    className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950 p-3 text-left hover:border-brand transition-colors">
                    <span className="text-2xl shrink-0">{s.icon}</span>
                    <span className="text-xs font-medium text-white">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Étape 2 — Type */}
          {step===2&&sector&&(
            <div>
              <p className="text-xs text-slate-400 mb-3">Type de zone dans {sector.label}</p>
              <div className="space-y-2">
                {sector.types.map(t=>(
                  <button key={t.id} onClick={()=>{setTypeId(t.id);setStep(3);}}
                    className="w-full flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-left hover:border-brand">
                    <span className="text-sm text-white">{t.label}</span>
                    <span className="text-slate-500 text-xs">{t.zones.length} zones →</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Étape 3 — Zone */}
          {step===3&&type&&(
            <div>
              <p className="text-xs text-slate-400 mb-3">Zone</p>
              <div className="space-y-2">
                {type.zones.map(z=>(
                  <button key={z.id} onClick={()=>{setZoneId(z.id);setStep(4);}}
                    className="w-full flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-left hover:border-brand">
                    <span className="text-sm text-white">{z.label}</span>
                    <span className="text-slate-500 text-xs">{z.emplacements.length} empl. →</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Étape 4 — Emplacement */}
          {step===4&&zone&&(
            <div>
              <p className="text-xs text-slate-400 mb-3">Emplacement précis</p>
              <div className="grid grid-cols-2 gap-1.5">
                {zone.emplacements.map(e=>(
                  <button key={e.id} onClick={()=>{setLocationId(e.id);setStep(5);}}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-left text-xs text-white hover:border-brand hover:bg-brand/5 transition-colors">
                    {e.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Étape 5 — Nom & confirmation */}
          {step===5&&location&&(
            <div className="space-y-4">
              {/* Nom auto-généré */}
              <div className="rounded-xl border border-emerald-800/40 bg-emerald-900/10 p-4">
                <p className="text-xs text-emerald-400 mb-1">✅ Nom automatique généré</p>
                <p className="text-lg font-bold text-white">{autoName}</p>
                <p className="text-xs text-slate-500 mt-1">ID: <code className="text-brand">{autoCamId}</code></p>
              </div>

              {/* Nom personnalisé (optionnel) */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">
                  Nom personnalisé <span className="text-slate-600">(optionnel)</span>
                </label>
                <input value={customName} onChange={e=>setCustomName(e.target.value)}
                  placeholder={`ex: ${autoName} - Caméra 1`}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-brand focus:outline-none"/>
              </div>

              {/* Numéro si plusieurs caméras au même emplacement */}
              <div className="flex items-center gap-3">
                <label className="text-xs text-slate-400">Numéro caméra</label>
                <div className="flex items-center gap-2">
                  <button onClick={()=>setCamIndex(Math.max(1,camIndex-1))}
                    className="h-7 w-7 rounded-lg border border-slate-700 text-slate-300 hover:border-brand">−</button>
                  <span className="w-8 text-center text-sm text-white">{camIndex}</span>
                  <button onClick={()=>setCamIndex(camIndex+1)}
                    className="h-7 w-7 rounded-lg border border-slate-700 text-slate-300 hover:border-brand">+</button>
                </div>
              </div>

              {/* Résumé */}
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Secteur</span>
                  <span className="text-slate-300">{sector?.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Type</span>
                  <span className="text-slate-300">{type?.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Zone</span>
                  <span className="text-slate-300">{zone?.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Emplacement</span>
                  <span className="text-slate-300">{location?.label}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-slate-400">Nom final</span>
                  <span className="text-white">{autoName}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 px-5 py-4 flex items-center justify-between gap-3">
          <button onClick={()=>{
            if(step===1){onCancel?.();return;}
            const prev = step-1 as 1|2|3|4|5;
            setStep(prev);
            if(prev<5) setLocationId("");
            if(prev<4) setZoneId("");
            if(prev<3) setTypeId("");
            if(prev<2) setSectorId("");
          }} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500">
            ← Retour
          </button>

          {step===5 && (
            <button onClick={confirm}
              className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand/90">
              ✅ Confirmer l'emplacement
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
