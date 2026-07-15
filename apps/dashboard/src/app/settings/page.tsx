import { PageHeader } from "@/components/PageHeader";

const SECTIONS = ["Compte", "Organisation", "Notifications", "Sécurité", "Intégrations", "API Keys"];

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" description="Paramètres de l'organisation et du compte." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <div key={s} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="font-medium text-white">{s}</p>
            <p className="mt-1 text-sm text-slate-500">Configurer {s.toLowerCase()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
