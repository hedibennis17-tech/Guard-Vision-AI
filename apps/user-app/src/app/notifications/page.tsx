"use client";

import { useState } from "react";

const DEMO = [
  { id:"n1", title:"🚨 Feu détecté",          body:"Entrepôt — Vérifiez immédiatement.",         severity:"critical" as const, time:"2min",  read:false },
  { id:"n2", title:"🚨 Intrusion probable",    body:"7 personnes — Entrée principale.",           severity:"critical" as const, time:"5min",  read:false },
  { id:"n3", title:"⚠️ Personne détectée",     body:"Parking — 2 détections.",                   severity:"warning"  as const, time:"12min", read:false },
  { id:"n4", title:"⚠️ Véhicule détecté",      body:"Entrée véhicules.",                          severity:"warning"  as const, time:"1h",    read:true  },
  { id:"n5", title:"ℹ️ Mouvement détecté",     body:"Cour arrière — Animal probable.",           severity:"info"     as const, time:"2h",    read:true  },
];

const BG = { critical:"bg-red-50 border-red-200",   warning:"bg-amber-50 border-amber-200", info:"bg-white border-slate-200" };
const DOT = { critical:"bg-red-500",                 warning:"bg-amber-500",                  info:"bg-slate-400" };

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState(DEMO);
  const unread = notifs.filter((n) => !n.read).length;

  return (
    <div className="px-4 pt-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Notifications</h1>
        {unread > 0 && (
          <button
            onClick={() => setNotifs((p) => p.map((n) => ({...n,read:true})))}
            className="text-xs text-blue-600"
          >
            Tout marquer lu
          </button>
        )}
      </div>

      <div className="space-y-2">
        {notifs.map((n) => (
          <div
            key={n.id}
            onClick={() => setNotifs((p) => p.map((x) => x.id===n.id ? {...x,read:true} : x))}
            className={`flex items-start gap-3 rounded-2xl border p-4 ${n.read ? "opacity-60" : ""} ${BG[n.severity]}`}
          >
            <div className="mt-1.5 shrink-0">
              <div className={`h-2 w-2 rounded-full ${n.read ? "bg-slate-300" : DOT[n.severity]}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{n.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">{n.body}</p>
              <p className="text-xs text-slate-400 mt-1">il y a {n.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
