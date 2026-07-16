"use client";

import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";

interface NotifItem {
  id: string;
  title: string;
  body: string;
  read: boolean;
  sentChannels: string[];
  severity: "critical" | "warning" | "info";
  createdAt: string;
  eventId?: string;
}

const SEVERITY_STYLES = {
  critical: { border: "border-l-red-500",   badge: "bg-red-500/10 text-red-400 border border-red-800",     dot: "bg-red-500"   },
  warning:  { border: "border-l-amber-500", badge: "bg-amber-500/10 text-amber-400 border border-amber-800", dot: "bg-amber-500" },
  info:     { border: "border-l-slate-600", badge: "bg-slate-800 text-slate-400 border border-slate-700",   dot: "bg-slate-500" },
};

const CHANNEL_ICONS: Record<string, string> = { push: "📱", email: "📧", sms: "💬" };

const DEMO: NotifItem[] = [
  { id:"n1", title:"🚨 Alerte critique", read:false, body:"Feu détecté — Entrepôt.", sentChannels:["push","email"], severity:"critical", createdAt:"il y a 2min",  eventId:"e1" },
  { id:"n2", title:"🚨 Alerte critique", read:false, body:"Intrusion — 7 personnes en 42s — Entrée principale.", sentChannels:["push","email"], severity:"critical", createdAt:"il y a 5min",  eventId:"e2" },
  { id:"n3", title:"⚠️ Alerte",          read:false, body:"Personne détectée — Parking.", sentChannels:["push"], severity:"warning", createdAt:"il y a 12min", eventId:"e3" },
  { id:"n4", title:"⚠️ Alerte",          read:true,  body:"Véhicule détecté — Entrée.", sentChannels:["push","email"], severity:"warning", createdAt:"il y a 1h",   eventId:"e4" },
  { id:"n5", title:"ℹ️ Info",            read:true,  body:"Animal détecté — Cour arrière.", sentChannels:["push"], severity:"info", createdAt:"il y a 2h" },
];

export default function NotificationsPage() {
  const [notifs,    setNotifs]    = useState<NotifItem[]>(DEMO);
  const [activeTab, setActiveTab] = useState<"all"|"unread">("all");
  const [showPrefs, setShowPrefs] = useState(false);
  const [prefs,     setPrefs]     = useState({ push:true, email:true, sms:false, minSeverity:"warning", dndEnabled:false, dndStart:22, dndEnd:7 });

  const unreadCount = notifs.filter((n) => !n.read).length;
  const displayed   = notifs.filter((n) => activeTab === "all" || !n.read);

  const markRead    = (id: string) => setNotifs((p) => p.map((n) => n.id===id ? {...n,read:true} : n));
  const markAllRead = () => setNotifs((p) => p.map((n) => ({...n,read:true})));

  return (
    <div>
      <PageHeader title="Notifications" description="Centre de notifications — Push, Email et préférences." />

      <div className="flex gap-6">
        <div className="flex-1">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
              {(["all","unread"] as const).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${activeTab===tab ? "bg-brand text-white" : "text-slate-400 hover:text-white"}`}>
                  {tab==="all" ? "Toutes" : "Non lues"}
                  {tab==="unread" && unreadCount>0 && (
                    <span className="ml-2 rounded-full bg-red-500 px-1.5 py-0.5 text-xs text-white">{unreadCount}</span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {unreadCount>0 && <button onClick={markAllRead} className="text-xs text-slate-400 hover:text-slate-200">Tout marquer lu</button>}
              <button onClick={() => setShowPrefs(!showPrefs)}
                className={`rounded-lg border px-3 py-1.5 text-xs ${showPrefs ? "border-brand text-brand" : "border-slate-800 text-slate-400"}`}>
                ⚙️ Préférences
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {displayed.map((notif) => {
              const s = SEVERITY_STYLES[notif.severity];
              return (
                <div key={notif.id} onClick={() => markRead(notif.id)}
                  className={`flex cursor-pointer items-start gap-4 rounded-xl border-l-4 border border-slate-800 bg-slate-900 p-4 hover:border-slate-700 ${s.border} ${notif.read ? "opacity-60" : ""}`}>
                  <div className="mt-1.5 shrink-0">
                    <div className={`h-2 w-2 rounded-full ${notif.read ? "bg-slate-800" : s.dot}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.badge}`}>{notif.severity}</span>
                      <span className="text-sm font-medium text-white">{notif.title}</span>
                    </div>
                    <p className="text-sm text-slate-400">{notif.body}</p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-slate-600">
                      <span>{notif.createdAt}</span>
                      <span>· {notif.sentChannels.map((c) => CHANNEL_ICONS[c]).join(" ")}</span>
                      {notif.eventId && (
                        <a href={`/events?event=${notif.eventId}`} className="text-brand hover:underline" onClick={(e) => e.stopPropagation()}>
                          Voir →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {displayed.length===0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-10 text-center text-sm text-slate-600">Aucune notification.</div>
            )}
          </div>
        </div>

        {showPrefs && (
          <div className="w-80 shrink-0 rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h3 className="mb-5 text-sm font-semibold text-white">Préférences</h3>

            <p className="mb-2 text-xs font-medium text-slate-400">Canaux</p>
            <div className="mb-4 space-y-2">
              {[{k:"push",l:"📱 Push"},{k:"email",l:"📧 Email"},{k:"sms",l:"💬 SMS (bientôt)"}].map(({k,l}) => (
                <label key={k} className="flex items-center gap-3 rounded-lg border border-slate-800 p-3 cursor-pointer">
                  <input type="checkbox" checked={prefs[k as keyof typeof prefs] as boolean}
                    onChange={(e) => setPrefs((p) => ({...p,[k]:e.target.checked}))}
                    disabled={k==="sms"} className="accent-brand" />
                  <span className="text-sm text-slate-200">{l}</span>
                </label>
              ))}
            </div>

            <p className="mb-2 text-xs font-medium text-slate-400">Sévérité minimale</p>
            <select value={prefs.minSeverity} onChange={(e) => setPrefs((p) => ({...p,minSeverity:e.target.value}))}
              className="mb-4 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200">
              <option value="info">Toutes (info + warning + critique)</option>
              <option value="warning">Warning et critiques</option>
              <option value="critical">Critiques seulement</option>
            </select>

            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-medium text-slate-400">Ne pas déranger</p>
              <label className="relative inline-flex cursor-pointer items-center">
                <input type="checkbox" checked={prefs.dndEnabled} onChange={(e) => setPrefs((p) => ({...p,dndEnabled:e.target.checked}))} className="peer sr-only" />
                <div className="h-5 w-9 rounded-full bg-slate-700 peer-checked:bg-brand after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-4" />
              </label>
            </div>
            {prefs.dndEnabled && (
              <div className="mb-4 flex items-center gap-2 text-xs text-slate-400">
                <span>De</span>
                <input type="number" min={0} max={23} value={prefs.dndStart} onChange={(e) => setPrefs((p) => ({...p,dndStart:+e.target.value}))} className="w-14 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-center text-white" />
                <span>h à</span>
                <input type="number" min={0} max={23} value={prefs.dndEnd} onChange={(e) => setPrefs((p) => ({...p,dndEnd:+e.target.value}))} className="w-14 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-center text-white" />
                <span>h</span>
              </div>
            )}

            <button className="w-full rounded-lg bg-brand py-2 text-sm font-medium text-white">Sauvegarder</button>
          </div>
        )}
      </div>
    </div>
  );
}
