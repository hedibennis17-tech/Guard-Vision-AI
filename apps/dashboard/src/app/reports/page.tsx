import { PageHeader } from "@/components/PageHeader";

const FORMATS = ["PDF", "Excel", "CSV"];

export default function ReportsPage() {
  return (
    <div>
      <PageHeader title="Reports" description="Génération et historique des rapports." />

      <div className="mb-6 flex gap-2">
        {FORMATS.map((f) => (
          <button
            key={f}
            className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300 hover:border-brand hover:text-brand"
          >
            Générer {f}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 text-slate-500">
            <tr>
              <th className="px-4 py-3">Période</th>
              <th className="px-4 py-3">Format</th>
              <th className="px-4 py-3">Créé le</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-slate-600">
                Aucun rapport généré — collection Firestore `reports`
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
