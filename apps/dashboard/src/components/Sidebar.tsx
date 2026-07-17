"use client";
import { useAuth } from "@/lib/context/AuthContext";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard",       icon: "🏠", label: "Dashboard" },
  { href: "/cameras",         icon: "📹", label: "Cameras" },
  { href: "/live-monitoring", icon: "📺", label: "Live Monitor" },
  { href: "/ai-detection",    icon: "🤖", label: "AI Detection" },
  { href: "/events",          icon: "🚨", label: "Events" },
  { href: "/notifications",   icon: "🔔", label: "Notifications" },
  { href: "/analytics",       icon: "📊", label: "Analytics" },
  { href: "/reports",         icon: "📄", label: "Reports" },
  { href: "/ai-search",       icon: "🧠", label: "AI Assistant" },
  { href: "/marketplace",     icon: "🧩", label: "Marketplace" },
  { href: "/modules",          icon: "⚙️",  label: "Modules" },
  { href: "/users",           icon: "👥", label: "Users" },
  { href: "/organizations",   icon: "🏢", label: "Organizations" },
  { href: "/billing",         icon: "💳", label: "Billing" },
  { href: "/settings",        icon: "⚙️",  label: "Settings" },
];

export function Sidebar() {
  const { user, profile, signOut, isSuperAdmin } = useAuth();

  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-950">
      <div className="px-5 py-6">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-brand" />
          <span className="text-sm font-semibold tracking-wide text-white">Vision Guard</span>
        </div>
        <p className="mt-1 pl-9 text-[11px] text-slate-500">AI Platform</p>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-6">
        {NAV_ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-brand/10 text-brand"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              }`}
            >
              <span className="w-4 text-center">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    
      {/* Footer utilisateur */}
      {user && (
        <div className="border-t border-slate-800 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
              {(profile?.displayName ?? user.email ?? "U")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{profile?.displayName ?? "Utilisateur"}</p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>
          </div>
          {isSuperAdmin && (
            <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-amber-900/20 border border-amber-800/40 px-2 py-1">
              <span className="text-sm">👑</span>
              <span className="text-xs font-medium text-amber-400">Super Admin</span>
            </div>
          )}
          <button onClick={() => signOut()}
            className="w-full rounded-lg border border-slate-700 py-1.5 text-xs text-slate-400 hover:border-red-800 hover:text-red-400 transition-colors">
            Déconnexion
          </button>
        </div>
      )}
</aside>
  );
}
