"use client";

import { useEffect, useState } from "react";
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useOrganization } from "@/lib/context/OrganizationContext";
import { PageHeader } from "@/components/PageHeader";
import Link from "next/link";

interface NotifItem {
  id:       string;
  title:    string;
  body:     string;
  severity: "critical" | "warning" | "info";
  read:     boolean;
  createdAt: string;
  eventId?: string;
}

const SEV_STYLE: Record<string, string> = {
  critical: "border-l-red-500 bg-red-900/5",
  warning:  "border-l-amber-500 bg-amber-900/5",
  info:     "border-l-slate-600",
};

export default function NotificationsPage() {
  const { currentOrg } = useOrganization();
  const [notifs,  setNotifs]  = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrg?.id) { setLoading(false); return; }

    const q = query(
      collection(db, "organizations", currentOrg.id, "notifications"),
      orderBy("createdAt", "desc"),
      limit(50),
    );

    const unsub = onSnapshot(q, (snap) => {
      setNotifs(snap.docs.map((d) => ({ id:d.id, ...d.data() } as NotifItem)));
      setLoading(false);
    }, () => setLoading(false));

    return unsub;
  }, [currentOrg?.id]);

  async function markRead(id: string) {
    if (!currentOrg?.id) return;
    await updateDoc(doc(db, "organizations", currentOrg.id, "notifications", id), { read:true });
  }

  async function markAllRead() {
    notifs.filter(n => !n.read).forEach(n => markRead(n.id));
  }

  const unread = notifs.filter(n => !n.read).length;

  return (
    <div>
      <PageHeader title="Notifications" description="Alertes en temps réel — Firestore live." />

      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-slate-400">
          {unread > 0 ? <span className="text-amber-400">{unread} non lue(s)</span> : "Tout lu"}
          {" · "}{notifs.length} total
        </span>
        <div className="flex gap-2">
          {unread > 0 && (
            <button onClick={markAllRead} className="text-xs text-slate-400 hover:text-slate-200">
              Tout marquer lu
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <span className="text-sm text-slate-400">Chargement depuis Firestore...</span>
        </div>
      )}

      {!loading && !currentOrg && (
        <div className="rounded-xl border border-amber-800/40 bg-amber-900/10 p-8 text-center">
          <p className="text-amber-400 mb-3">Aucune organisation configurée</p>
          <Link href="/cameras/phone" className="rounded-lg bg-brand px-4 py-2 text-sm">
            → Configurer via Caméra Phone
          </Link>
        </div>
      )}

      {!loading && currentOrg && notifs.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-700 p-12 text-center">
          <p className="text-4xl mb-3">🔔</p>
          <p className="text-slate-400 mb-2">Aucune notification</p>
          <p className="text-xs text-slate-600 mb-4">
            Les notifications apparaissent pour les détections warning et critical.
          </p>
          <Link href="/cameras/phone" className="rounded-lg bg-brand px-5 py-2 text-sm">
            📱 Activer la caméra →
          </Link>
        </div>
      )}

      {!loading && notifs.length > 0 && (
        <div className="space-y-2">
          {notifs.map((n) => (
            <div key={n.id} onClick={() => markRead(n.id)}
              className={`flex cursor-pointer items-start gap-4 rounded-xl border-l-4 border border-slate-800 p-4 transition-colors hover:border-slate-700 ${SEV_STYLE[n.severity] ?? ""} ${n.read ? "opacity-60" : ""}`}>
              <div className="mt-1 shrink-0">
                <div className={`h-2 w-2 rounded-full ${n.read ? "bg-slate-700" : n.severity === "critical" ? "bg-red-500" : n.severity === "warning" ? "bg-amber-500" : "bg-slate-500"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{n.title}</p>
                <p className="text-sm text-slate-400 mt-0.5">{n.body}</p>
                <div className="mt-2 flex items-center gap-3 text-xs text-slate-600">
                  <span>{new Date(n.createdAt).toLocaleString("fr-CA")}</span>
                  {n.eventId && (
                    <Link href="/events" className="text-brand hover:underline" onClick={e=>e.stopPropagation()}>
                      Voir l'event →
                    </Link>
                  )}
                </div>
              </div>
              {!n.read && (
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${
                  n.severity === "critical" ? "border-red-800 text-red-400"
                  : "border-amber-800 text-amber-400"
                }`}>{n.severity}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
