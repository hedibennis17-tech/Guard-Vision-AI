export default function LivePage() {
  return (
    <div className="flex min-h-screen flex-col bg-black">
      <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
        Flux vidéo en direct
      </div>
      <div className="flex justify-around bg-black/80 py-4 text-xs text-white">
        <button>⏸ Pause</button>
        <button>📷 Capture</button>
        <button>⏺ Enregistrer</button>
        <button>🔊 Audio</button>
        <button>⚙️ Qualité</button>
      </div>
    </div>
  );
}
