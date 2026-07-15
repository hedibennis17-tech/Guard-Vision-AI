export default function ReportsPage() {
  return (
    <div className="px-4 pt-8">
      <h1 className="mb-4 text-xl font-semibold">Rapports</h1>

      <button className="mb-4 w-full rounded-xl bg-brand py-3 text-sm font-medium text-white">
        Générer un rapport PDF
      </button>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        Historique des rapports vide.
      </div>
    </div>
  );
}
