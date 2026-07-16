"use client";

const TREND = [98,124,87,156,142,189,134];
const DAYS  = ["L","M","M","J","V","S","D"];
const maxT  = Math.max(...TREND);

const TYPES = [
  { label:"Personnes", count:523, color:"bg-blue-500",  pct:60 },
  { label:"Véhicules", count:187, color:"bg-purple-500", pct:22 },
  { label:"Animaux",   count:73,  color:"bg-amber-500",  pct:8  },
  { label:"Feu/Fumée", count:18,  color:"bg-red-500",   pct:2  },
];

export default function AnalyticsPage() {
  return (
    <div className="px-4 pt-8 pb-6">
      <h1 className="mb-6 text-xl font-semibold">Analytics</h1>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        {[
          { label:"Détections",  value:"870"  },
          { label:"Événements",  value:"174"  },
          { label:"Critiques",   value:"12"   },
          { label:"Moy./jour",   value:"124"  },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{k.label}</p>
            <p className="mt-1 text-2xl font-semibold">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Graphique barres 7 jours */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-slate-700">7 derniers jours</p>
        <div className="flex items-end gap-1.5 h-24">
          {TREND.map((v, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div className="w-full rounded-t bg-blue-500 transition-all"
                style={{height:`${Math.round((v/maxT)*100)%100 || 8}px`, maxHeight:"96px", minHeight:"4px"}} />
              <span className="text-xs text-slate-400">{DAYS[i]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Répartition par type */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-slate-700">Par type de détection</p>
        <div className="space-y-2.5">
          {TYPES.map((t) => (
            <div key={t.label}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-slate-600">{t.label}</span>
                <span className="font-medium">{t.count}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100">
                <div className={`h-2 rounded-full ${t.color}`} style={{width:`${t.pct}%`}} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
