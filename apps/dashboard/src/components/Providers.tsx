"use client";

import { type ReactNode } from "react";
import { OrganizationProvider } from "@/lib/context/OrganizationContext";

/**
 * Providers — wrapper client-side pour tous les contextes React.
 * Séparé du layout (server component) car les providers nécessitent "use client".
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <OrganizationProvider>
      {children}
    </OrganizationProvider>
  );
}
