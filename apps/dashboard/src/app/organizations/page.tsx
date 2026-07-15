import { PageHeader } from "@/components/PageHeader";

export default function OrganizationsPage() {
  return (
    <div>
      <PageHeader
        title="Organizations"
        description="Gestion multi-tenant : organisations, sites et membres."
      />

      <button className="mb-6 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">
        Créer une organisation
      </button>

      <div className="rounded-xl border border-slate-800 bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 text-slate-500">
            <tr>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Caméras</th>
              <th className="px-4 py-3">Sites</th>
              <th className="px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-slate-600">
                Aucune organisation — collection Firestore `organizations`
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
