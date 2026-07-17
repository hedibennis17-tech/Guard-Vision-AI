"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useOrganization } from "@/lib/context/OrganizationContext";
import { useAuth } from "@/lib/context/AuthContext";
import { PageHeader } from "@/components/PageHeader";

interface Member {
  userId:    string;
  email?:    string;
  name?:     string;
  role:      "owner" | "admin" | "manager" | "member" | "viewer";
  status:    "active" | "inactive" | "pending";
  joinedAt:  string;
}

const ROLES = ["owner","admin","manager","member","viewer"] as const;
const ROLE_COLORS: Record<string, string> = {
  owner:   "text-amber-400  border-amber-800  bg-amber-900/20",
  admin:   "text-purple-400 border-purple-800 bg-purple-900/20",
  manager: "text-blue-400   border-blue-800   bg-blue-900/20",
  member:  "text-slate-300  border-slate-700  bg-slate-800",
  viewer:  "text-slate-500  border-slate-700  bg-slate-900",
};

export default function UsersPage() {
  const { currentOrg }     = useOrganization();
  const { profile, isSuperAdmin } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Member | null>(null);

  useEffect(() => {
    if (!currentOrg?.id) { setLoading(false); return; }
    const unsub = onSnapshot(
      collection(db, "organizations", currentOrg.id, "members"),
      async (snap) => {
        const raw = snap.docs.map(d => ({ userId:d.id, ...d.data() } as Member));
        // Enrichir avec les profils users
        const enriched = await Promise.all(raw.map(async m => {
          try {
            const uDoc = await getDoc(doc(db, "users", m.userId));
            const data = uDoc.data();
            return { ...m, email:data?.email, name:data?.displayName };
          } catch { return m; }
        }));
        setMembers(enriched.sort((a,b) => {
          const order = { owner:0, admin:1, manager:2, member:3, viewer:4 };
          return (order[a.role]??5) - (order[b.role]??5);
        }));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [currentOrg?.id]);

  async function changeRole(userId: string, role: string) {
    if (!currentOrg?.id) return;
    await updateDoc(doc(db, "organizations", currentOrg.id, "members", userId), { role });
  }

  const isOwner = members.find(m => m.userId === profile?.uid)?.role === "owner";
  const canManage = isSuperAdmin || isOwner;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <PageHeader
          title="Utilisateurs"
          description={`${members.length} membre${members.length>1?"s":""} · ${currentOrg?.name ?? "Organisation"}`}
        />
        {isSuperAdmin && (
          <span className="rounded-full border border-amber-800 bg-amber-900/20 px-3 py-1.5 text-xs font-medium text-amber-400">
            👑 Super Admin — accès total
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ROLES.map(role => (
          <div key={role} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs text-slate-500 capitalize mb-1">{role}s</p>
            <p className="text-2xl font-bold text-white">
              {members.filter(m=>m.role===role).length}
            </p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent"/>
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-12 text-center">
          <p className="text-3xl mb-3">👥</p>
          <p className="text-slate-400">Aucun membre — configurez votre organisation</p>
        </div>
      ) : (
        <div className="flex gap-5">
          {/* Liste */}
          <div className="flex-1 rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
            <div className="border-b border-slate-800 px-5 py-3 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-300">Membres</span>
              <span className="text-xs text-slate-500">{members.length} total</span>
            </div>
            <div className="divide-y divide-slate-800">
              {members.map(m => (
                <button key={m.userId} onClick={() => setSelected(m)}
                  className={`w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-800/50 transition-colors ${selected?.userId===m.userId?"bg-brand/5":""}`}>
                  {/* Avatar */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/20 border border-brand/30 text-sm font-bold text-brand">
                    {(m.name ?? m.email ?? "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {m.name ?? "Utilisateur"}
                      {m.userId === profile?.uid && (
                        <span className="ml-2 text-xs text-slate-500">(vous)</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{m.email ?? m.userId.slice(0,16)+"..."}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${ROLE_COLORS[m.role]}`}>
                      {m.role === "owner" ? "👑 " : ""}{m.role}
                    </span>
                    <span className={`h-2 w-2 rounded-full ${m.status==="active"?"bg-emerald-500":"bg-slate-600"}`}/>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Détail */}
          {selected && (
            <div className="w-72 shrink-0 rounded-xl border border-slate-800 bg-slate-900 p-5">
              {/* Avatar */}
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/20 border border-brand/30 text-2xl font-bold text-brand">
                  {(selected.name ?? selected.email ?? "?")[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-white">{selected.name ?? "Utilisateur"}</p>
                  <p className="text-xs text-slate-500">{selected.email}</p>
                </div>
              </div>

              {/* Infos */}
              <div className="space-y-2 text-xs mb-5">
                {[
                  ["Rôle",    selected.role],
                  ["Statut",  selected.status],
                  ["Membre depuis", new Date(selected.joinedAt).toLocaleDateString("fr-CA")],
                  ["User ID", selected.userId.slice(0,16)+"..."],
                ].map(([l,v]) => (
                  <div key={l} className="flex justify-between">
                    <span className="text-slate-500">{l}</span>
                    <span className="text-slate-300 capitalize">{v}</span>
                  </div>
                ))}
              </div>

              {/* Changer le rôle */}
              {canManage && selected.userId !== profile?.uid && (
                <div>
                  <p className="text-xs font-medium text-slate-400 mb-2">Changer le rôle</p>
                  <div className="space-y-1">
                    {ROLES.filter(r => r !== "owner" || isSuperAdmin).map(role => (
                      <button key={role} onClick={() => changeRole(selected.userId, role)}
                        className={`w-full rounded-lg border px-3 py-2 text-xs text-left capitalize transition-colors ${
                          selected.role === role
                            ? ROLE_COLORS[role]
                            : "border-slate-700 text-slate-400 hover:border-slate-600"
                        }`}>
                        {role === "owner" ? "👑 " : ""}{role}
                        {selected.role === role && " ✓"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
