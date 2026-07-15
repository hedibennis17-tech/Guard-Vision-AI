const CAMERAS = [
  { name: "Salon", status: "En ligne", battery: "—" },
  { name: "Garage", status: "En ligne", battery: "—" },
  { name: "Entrée", status: "En ligne", battery: "—" },
  { name: "Cour arrière", status: "En ligne", battery: "—" },
];

export default function CamerasPage() {
  return (
    <div className="px-4 pt-8">
      <h1 className="mb-6 text-xl font-semibold">Caméras</h1>

      <div className="space-y-3">
        {CAMERAS.map((cam) => (
          <div
            key={cam.name}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3"
          >
            <div className="h-14 w-20 shrink-0 rounded-lg bg-slate-200" />
            <div className="flex-1">
              <p className="text-sm font-medium">{cam.name}</p>
              <p className="text-xs text-slate-500">{cam.status}</p>
            </div>
            <span className="text-xs text-slate-400">🔋 {cam.battery}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
