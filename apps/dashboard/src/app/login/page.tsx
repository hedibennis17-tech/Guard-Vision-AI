"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";

type Mode = "login" | "register" | "reset";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signUp, resetPassword, loading, error, clearError } = useAuth();
  const [mode,        setMode]        = useState<Mode>("login");
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [displayName, setDisplayName] = useState("");
  const [resetSent,   setResetSent]   = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [localError,  setLocalError]  = useState<string | null>(null);
  const effectiveError = localError || error;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearError(); setLocalError(null); setSubmitting(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
        router.push("/dashboard");
      } else if (mode === "register") {
        if (!displayName.trim()) { setLocalError("Le nom est requis."); setSubmitting(false); return; }
        await signUp(email, password, displayName);
        router.push("/dashboard");
      } else {
        await resetPassword(email);
        setResetSent(true);
      }
    } catch { } finally { setSubmitting(false); }
  }

  const switchMode = (m: Mode) => { setMode(m); clearError(); setLocalError(null); setResetSent(false); };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand">
            <span className="text-2xl">👁️</span>
          </div>
          <h1 className="text-xl font-semibold text-white">Vision Guard</h1>
          <p className="text-sm text-slate-500">Dashboard Administrateur</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8">
          <h2 className="mb-6 text-center text-lg font-semibold text-white">
            {mode === "login" ? "Connexion" : mode === "register" ? "Créer un compte" : "Réinitialiser"}
          </h2>

          {resetSent && (
            <div className="mb-4 rounded-lg border border-emerald-800 bg-emerald-900/20 p-3 text-center text-sm text-emerald-400">
              ✅ Email envoyé ! Vérifiez votre boîte de réception.
            </div>
          )}

          {effectiveError && (
            <div className="mb-4 rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">
              {effectiveError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Nom complet</label>
                <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Jean Dupont" required
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-brand focus:outline-none" />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@email.com" required autoComplete="email"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-brand focus:outline-none" />
            </div>
            {mode !== "reset" && (
              <div>
                <div className="mb-1 flex justify-between">
                  <label className="text-xs font-medium text-slate-400">Mot de passe</label>
                  {mode === "login" && (
                    <button type="button" onClick={() => switchMode("reset")} className="text-xs text-brand hover:underline">Oublié ?</button>
                  )}
                </div>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "register" ? "Min. 6 caractères" : "••••••••"} required minLength={6}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-brand focus:outline-none" />
              </div>
            )}
            <button type="submit" disabled={submitting || loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand py-2.5 text-sm font-medium text-white disabled:opacity-60">
              {(submitting || loading) && <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
              {mode === "login" ? "Se connecter" : mode === "register" ? "Créer le compte" : "Envoyer le lien"}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-500">
            {mode === "login" ? (<>Pas de compte ?{" "}<button onClick={() => switchMode("register")} className="text-brand hover:underline">Créer un compte</button></>)
             : mode === "register" ? (<>Déjà un compte ?{" "}<button onClick={() => switchMode("login")} className="text-brand hover:underline">Se connecter</button></>)
             : (<button onClick={() => switchMode("login")} className="text-brand hover:underline">← Retour</button>)}
          </div>
        </div>
      </div>
    </div>
  );
}
