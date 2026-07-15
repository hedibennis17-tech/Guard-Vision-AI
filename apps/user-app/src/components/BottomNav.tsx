"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/home", label: "Accueil" },
  { href: "/cameras", label: "Caméras" },
  { href: "/events", label: "Événements" },
  { href: "/notifications", label: "Alertes" },
  { href: "/account", label: "Compte" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-md justify-between px-2 py-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 rounded-lg py-2 text-center text-xs font-medium ${
                active ? "text-brand" : "text-slate-400"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
