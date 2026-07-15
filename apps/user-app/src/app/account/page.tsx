const ITEMS = ["Profil", "Sécurité", "Appareils connectés", "Aide & Support"];

export default function AccountPage() {
  return (
    <div className="px-4 pt-8">
      <h1 className="mb-6 text-xl font-semibold">Compte</h1>

      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="h-14 w-14 rounded-full bg-slate-200" />
        <div>
          <p className="text-sm font-medium">Utilisateur</p>
          <p className="text-xs text-slate-500">utilisateur@email.com</p>
        </div>
      </div>

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
