import { PageHeader } from "@/components/PageHeader";

const ACTIONS = ["Ajouter", "Supprimer", "Tester", "Connecteurs", "Firmware", "Santé"];

export default function CamerasPage() {
  return (
    <div>
      <PageHeader
        title="Cameras"
        description="Gestion des caméras, connecteurs et santé du parc."
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {ACTIONS.map((action) => (
          <button
            key={action}
            className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300 hover:border-brand hover:text-brand"
          >
            {action}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 text-slate-500">
            <tr>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Marque / Connecteur</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Batterie</th>
              <th className="px-4 py-3">Groupe</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-slate-600">
                Aucune caméra connectée — collection Firestore `cameras`
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
