export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-semibold">Connexion</h1>
      <p className="mb-8 text-sm text-slate-500">Accédez à vos caméras en toute sécurité.</p>

      <form className="space-y-4">
        <input
          type="email"
          placeholder="Adresse e-mail"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
        />
        <input
          type="password"
          placeholder="Mot de passe"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
        />
        <button
          type="submit"
          className="w-full rounded-xl bg-brand py-3 text-sm font-medium text-white"
        >
          Se connecter
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Pas encore de compte ? <span className="text-brand">Créer un compte</span>
      </p>
    </div>
  );
}
