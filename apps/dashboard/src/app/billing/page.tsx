import { PageHeader } from "@/components/PageHeader";

export default function BillingPage() {
  return (
    <div>
      <PageHeader title="Billing" description="Abonnement, factures, paiement et caméras utilisées." />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-400">Plan actuel</p>
          <p className="mt-2 text-xl font-semibold text-white">—</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-400">Caméras utilisées</p>
          <p className="mt-2 text-xl font-semibold text-white">0 / —</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-400">Prochaine facture</p>
          <p className="mt-2 text-xl font-semibold text-white">—</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 text-slate-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Montant</th>
              <th className="px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={3} className="px-4 py-8 text-center text-slate-600">
                Aucune facture — collection Firestore `subscriptions`
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
