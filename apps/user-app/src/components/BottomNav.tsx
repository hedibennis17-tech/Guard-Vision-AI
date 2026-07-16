"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/home",          label: "Accueil",    icon: "🏠" },
  { href: "/cameras",       label: "Caméras",    icon: "📹" },
  { href: "/events",        label: "Événements", icon: "🚨" },
  { href: "/analytics",     label: "Stats",      icon: "📊" },
  { href: "/notifications", label: "Alertes",    icon: "🔔" },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-md justify-around px-2 py-1.5">
        {NAV_ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                active ? "text-blue-600" : "text-slate-400"
              }`}>
              <span className="text-lg leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
