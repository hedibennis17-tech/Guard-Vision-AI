const ITEMS = ["Compte", "Notifications", "Stockage", "Abonnement", "Support"];

export default function SettingsPage() {
  return (
    <div className="px-4 pt-8">
      <h1 className="mb-6 text-xl font-semibold">Paramètres</h1>

      <div className="space-y-2">
        {ITEMS.map((item) => (
          <div
            key={item}
            className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-sm"
          >
            <span>{item}</span>
            <span className="text-slate-400">›</span>
          </div>
        ))}
      </div>
    </div>
  );
}
