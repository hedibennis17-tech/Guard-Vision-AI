import type { Metadata } from "next";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "Vision Guard",
  description: "Surveillance intelligente pour votre maison",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <div className="mx-auto min-h-screen max-w-md pb-20">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
