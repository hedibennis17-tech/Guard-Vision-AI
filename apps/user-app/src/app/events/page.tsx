export default function EventsPage() {
  return (
    <div className="px-4 pt-8">
      <h1 className="mb-4 text-xl font-semibold">Événements</h1>

      <input
        type="text"
        placeholder="Rechercher..."
        className="mb-4 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
      />

      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-lg bg-slate-200" />
        ))}
      </div>
    </div>
  );
}
