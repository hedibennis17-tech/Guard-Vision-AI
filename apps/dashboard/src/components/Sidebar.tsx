"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/context/AuthContext";

// ── 8 modules avec sous-catégories ────────────────────────────────────────────
const MODULES = [
  { id:"home_security",  icon:"🏠", label:"Home Security",       color:"#0EA5E9" },
  { id:"retail",         icon:"🛒", label:"Retail Intelligence", color:"#10B981" },
  { id:"construction",   icon:"🏗️", label:"Construction Safety", color:"#F59E0B" },
  { id:"industrial",     icon:"🏭", label:"Industrial Safety",   color:"#EF4444" },
  { id:"agriculture",    icon:"🌾", label:"AgriGuard",           color:"#84CC16" },
  { id:"transportation", icon:"🚗", label:"TrafficGuard",        color:"#8B5CF6" },
  { id:"smart_city",     icon:"🌆", label:"Smart City",          color:"#06B6D4" },
  { id:"defense",        icon:"🛡️", label:"Defense Shield",      color:"#374151" },
];

// ── Structure navigation principale ───────────────────────────────────────────
type NavGroup = {
  id:    string;
  icon:  string;
  label: string;
  href?: string;
  children?: { href:string; icon:string; label:string; color?:string }[];
};

const NAV_GROUPS: NavGroup[] = [
  // ── Principal
  { id:"dashboard",   icon:"🏠", label:"Dashboard",      href:"/dashboard"       },
  { id:"cameras",     icon:"📹", label:"Caméras",        href:"/cameras"         },
  { id:"live",        icon:"📺", label:"Live Monitor",   href:"/live-monitoring" },

  // ── IA & Détection
  { id:"ai_group", icon:"🤖", label:"IA & Détection", children:[
    { href:"/ai-detection",   icon:"🎯", label:"AI Détection"  },
    { href:"/events",         icon:"🚨", label:"Events"        },
    { href:"/notifications",  icon:"🔔", label:"Notifications" },
    { href:"/analytics",      icon:"📊", label:"Analytics"     },
    { href:"/reports",        icon:"📄", label:"Rapports"      },
    { href:"/ai-search",      icon:"🧠", label:"AI Assistant"  },
  ]},

  // ── Modules IA — 8 sous-catégories
  { id:"modules_group", icon:"🧩", label:"Modules IA", children:
    MODULES.map(m => ({
      href:   `/modules/${m.id}`,
      icon:   m.icon,
      label:  m.label,
      color:  m.color,
    }))
  },

  // ── Marketplace
  { id:"marketplace", icon:"🏪", label:"Marketplace",   href:"/marketplace"     },

  // ── Administration
  { id:"admin_group", icon:"⚙️", label:"Administration", children:[
    { href:"/users",          icon:"👥", label:"Utilisateurs"   },
    { href:"/organizations",  icon:"🏢", label:"Organisations"  },
    { href:"/billing",        icon:"💳", label:"Facturation"    },
    { href:"/settings",       icon:"⚙️",  label:"Paramètres"    },
    { href:"/diagnostic",     icon:"🔧", label:"Diagnostic"     },
    { href:"/diagnostic/ai",  icon:"🔬", label:"Diagnostic IA"  },
    { href:"/diagnostic/ppe", icon:"⛑️", label:"Entraîner PPE"   },
  ]},
];

// ── Composant principal ────────────────────────────────────────────────────────
export function Sidebar() {
  const { user, profile, signOut, isSuperAdmin } = useAuth();
  const pathname = usePathname();

  // Groupes ouverts par défaut : le groupe actif
  const getDefaultOpen = () => {
    const open: Record<string,boolean> = {};
    NAV_GROUPS.forEach(g => {
      if (g.children) {
        const isActive = g.children.some(c => pathname?.startsWith(c.href));
        if (isActive) open[g.id] = true;
      }
    });
    // Modules toujours ouvert si sur une page module
    if (pathname?.startsWith("/modules")) open["modules_group"] = true;
    return open;
  };

  const [open, setOpen] = useState<Record<string,boolean>>(getDefaultOpen);

  const toggleGroup = (id: string) =>
    setOpen(prev => ({ ...prev, [id]: !prev[id] }));

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname?.startsWith(href));

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-950">

      {/* Logo */}
      <div className="px-4 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-brand flex items-center justify-center text-white font-bold text-sm">
            V
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">Vision Guard</p>
            <p className="text-[10px] text-slate-500 mt-0.5">AI Platform</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {NAV_GROUPS.map(group => {

          // ── Lien simple ────────────────────────────────────────────────────
          if (group.href) {
            const active = isActive(group.href);
            return (
              <Link key={group.id} href={group.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-brand/10 text-brand" : "text-slate-400 hover:bg-slate-900 hover:text-white"
                }`}>
                <span className="w-4 text-center text-base">{group.icon}</span>
                <span>{group.label}</span>
              </Link>
            );
          }

          // ── Groupe avec sous-éléments ──────────────────────────────────────
          const isGroupActive = group.children?.some(c => isActive(c.href)) ?? false;
          const isOpen = open[group.id] ?? false;

          return (
            <div key={group.id}>
              {/* Header du groupe */}
              <button
                onClick={() => toggleGroup(group.id)}
                className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isGroupActive ? "text-brand" : "text-slate-400 hover:text-white hover:bg-slate-900"
                }`}>
                <span className="w-4 text-center text-base">{group.icon}</span>
                <span className="flex-1 text-left">{group.label}</span>
                {group.children && (
                  <span className={`text-xs text-slate-600 transition-transform duration-200 ${isOpen?"rotate-90":""}`}>
                    ›
                  </span>
                )}
              </button>

              {/* Sous-éléments */}
              {isOpen && group.children && (
                <div className="mt-0.5 ml-3 pl-3 border-l border-slate-800 space-y-0.5">
                  {group.children.map(child => {
                    const childActive = isActive(child.href);
                    return (
                      <Link key={child.href} href={child.href}
                        className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                          childActive ? "text-white" : "text-slate-500 hover:text-slate-200 hover:bg-slate-900"
                        }`}
                        style={childActive && child.color
                          ? {background:`${child.color}15`, color:child.color}
                          : {}}>
                        <span className="text-sm">{child.icon}</span>
                        <span className="truncate">{child.label}</span>
                        {childActive && (
                          <span className="ml-auto h-1.5 w-1.5 rounded-full shrink-0"
                            style={{background: child.color ?? "#0EA5E9"}}/>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer utilisateur */}
      {user && (
        <div className="border-t border-slate-800 p-3">
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
              {(profile?.displayName ?? user.email ?? "U")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {profile?.displayName ?? "Admin"}
              </p>
              <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
            </div>
          </div>

          {isSuperAdmin && (
            <div className="mb-2 flex items-center gap-1.5 rounded-lg border border-amber-800/40 bg-amber-900/20 px-2.5 py-1.5">
              <span>👑</span>
              <span className="text-xs font-semibold text-amber-400">Super Admin</span>
            </div>
          )}

          <button onClick={() => signOut()}
            className="w-full rounded-lg border border-slate-800 py-1.5 text-xs text-slate-500 hover:border-red-800 hover:text-red-400 transition-colors">
            Déconnexion
          </button>
        </div>
      )}
    </aside>
  );
}
