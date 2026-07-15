import { PageHeader } from "@/components/PageHeader";

export default function UsersPage() {
  return (
    <div>
      <PageHeader title="Users" description="Invitations, permissions, famille et employés." />

      <div className="mb-6 flex gap-2">
        <button className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">
          Inviter un utilisateur
        </button>
        <button className="rounded-lg border border-slate-800 px-4 py-2 text-sm text-slate-300">
          Gérer les permissions
        </button>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 text-slate-500">
            <tr>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Rôle</th>
              <th className="px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-slate-600">
                Aucun utilisateur — collection Firestore `users`
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
