const CARDS = [
  { label: "Caméras connectées", value: "—" },
  { label: "Événements aujourd'hui", value: "—" },
  { label: "Alertes", value: "—" },
  { label: "Dernière activité", value: "—" },
];

export default function HomePage() {
  return (
    <div className="px-4 pt-8">
      <h1 className="mb-6 text-xl font-semibold">Accueil</h1>

      <div className="grid grid-cols-2 gap-3">
        {CARDS.map((c) => (
          <div key={c.label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className="mt-2 text-2xl font-semibold">{c.value}</p>
          </div>
        ))}
      </div>

      <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 py-4 text-sm font-medium text-brand">
        + Ajouter une caméra
      </button>
    </div>
  );
}
