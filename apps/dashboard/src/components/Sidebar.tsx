"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/cameras", label: "Cameras" },
  { href: "/live-monitoring", label: "Live Monitoring" },
  { href: "/events", label: "Events" },
  { href: "/analytics", label: "Analytics" },
  { href: "/reports", label: "Reports" },
  { href: "/ai-search", label: "AI Search" },
  { href: "/users", label: "Users" },
  { href: "/billing", label: "Billing" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/settings", label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 border-r border-slate-800 bg-slate-950 p-4">
      <div className="mb-8 px-2">
        <span className="text-lg font-semibold text-white">Vision Guard</span>
        <p className="text-xs text-slate-500">Admin Dashboard</p>
      </div>
      <nav className="space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-brand/10 text-brand"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
