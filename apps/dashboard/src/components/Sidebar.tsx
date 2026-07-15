"use client";

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
  { href: "/users",           icon: "👥", label: "Users" },
  { href: "/organizations",   icon: "🏢", label: "Organizations" },
  { href: "/billing",         icon: "💳", label: "Billing" },
  { href: "/settings",        icon: "⚙️",  label: "Settings" },
];

export function Sidebar() {
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
    </aside>
  );
}
