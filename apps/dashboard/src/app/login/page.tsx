"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/context/AuthContext";

type Mode = "login" | "register" | "reset";

export default function LoginPage() {
  const router      = useRouter();
  const params      = useSearchParams();
  const redirectTo  = params.get("from") ?? "/dashboard";

  const { user, signIn, signUp, resetPassword, loading, error, clearError, isSuperAdmin, profile } = useAuth();

  const [mode,        setMode]        = useState<Mode>("login");
  const [email,       setEmail]       = useState("hedibennis17@gmail.com");
  const [password,    setPassword]    = useState("");
  const [displayName, setDisplayName] = useState("");
  const [resetSent,   setResetSent]   = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [localError,  setLocalError]  = useState<string | null>(null);

  // Rediriger si déjà connecté
  useEffect(() => {
    if (user && !loading) router.replace(redirectTo);
  }, [user, loading]);

  const effectiveError = localError || error;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearError(); setLocalError(null); setSubmitting(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
        router.replace(redirectTo);
      } else if (mode === "register") {
        if (!displayName.trim()) { setLocalError("Le nom est requis."); return; }
        await signUp(email, password, displayName);
        router.replace("/dashboard");
      } else {
        await resetPassword(email);
        setResetSent(true);
      }
    } catch {} finally { setSubmitting(false); }
  }

  const switchMode = (m: Mode) => { setMode(m); clearError(); setLocalError(null); setResetSent(false); };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-950">
      {/* Panel gauche — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden"
        style={{ background:"linear-gradient(135deg, #0f172a 0%, #0d1f3c 50%, #0f172a 100%)" }}>
        {/* Grille décorative */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage:"linear-gradient(#0EA5E9 1px, transparent 1px), linear-gradient(90deg, #0EA5E9 1px, transparent 1px)", backgroundSize:"40px 40px" }} />

        <div className="relative z-10 text-center max-w-md">
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-brand/20 border border-brand/30 text-5xl">
            👁️
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Vision Guard AI</h1>
          <p className="text-slate-400 text-lg mb-8">
            Plateforme de surveillance intelligente propulsée par YOLOv11
          </p>

          {/* Features */}
          <div className="space-y-3 text-left">
            {[
              { icon:"🎯", label:"YOLOv11 temps réel",      desc:"Détection multi-classes en <50ms" },
              { icon:"🧩", label:"Modules sectoriels",       desc:"Retail, Construction, Défense..." },
              { icon:"🔔", label:"Alertes intelligentes",    desc:"Push, Email, SMS selon sévérité" },
              { icon:"📊", label:"Analytics avancés",        desc:"Heatmaps, tendances, rapports PDF" },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                <span className="text-2xl shrink-0">{f.icon}</span>
                <div>
                  <p className="text-sm font-medium text-white">{f.label}</p>
                  <p className="text-xs text-slate-500">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Panel droit — formulaire */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Logo mobile */}
          <div className="lg:hidden text-center mb-8">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-3xl">
              👁️
            </div>
            <h1 className="text-xl font-bold text-white">Vision Guard AI</h1>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8">
            <h2 className="mb-1 text-xl font-semibold text-white">
              {mode === "login"    ? "Connexion"
               : mode === "register" ? "Créer un compte"
               : "Réinitialiser"}
            </h2>
            <p className="mb-6 text-xs text-slate-500">
              {mode === "login"
                ? "Accès au Dashboard Administrateur"
                : mode === "register" ? "Rejoindre Vision Guard"
                : "Réception d'un lien par email"}
            </p>

            {resetSent && (
              <div className="mb-4 rounded-xl border border-emerald-800 bg-emerald-900/20 p-3 text-center text-sm text-emerald-400">
                ✅ Email envoyé — vérifiez votre boîte
              </div>
            )}

            {effectiveError && (
              <div className="mb-4 rounded-xl border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">
                ❌ {effectiveError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "register" && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">Nom complet</label>
                  <input type="text" value={displayName} onChange={e=>setDisplayName(e.target.value)}
                    placeholder="Votre nom" required
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-brand focus:outline-none" />
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Adresse email</label>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                  placeholder="vous@email.com" required autoComplete="email"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-brand focus:outline-none" />
              </div>

              {mode !== "reset" && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-400">Mot de passe</label>
                    {mode === "login" && (
                      <button type="button" onClick={()=>switchMode("reset")}
                        className="text-xs text-brand hover:underline">
                        Oublié ?
                      </button>
                    )}
                  </div>
                  <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
                    placeholder={mode==="register"?"Min. 6 caractères":"••••••••"} required minLength={6}
                    autoComplete={mode==="login"?"current-password":"new-password"}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-brand focus:outline-none" />
                </div>
              )}

              <button type="submit" disabled={submitting || loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white disabled:opacity-60 hover:bg-brand/90 transition-colors">
                {(submitting || loading)
                  ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"/>Connexion...</>
                  : mode==="login" ? "Se connecter →"
                  : mode==="register" ? "Créer le compte →"
                  : "Envoyer le lien →"}
              </button>
            </form>

            <div className="mt-6 text-center text-xs text-slate-500">
              {mode === "login" ? (
                <>Pas de compte ?{" "}
                  <button onClick={()=>switchMode("register")} className="text-brand hover:underline">Créer un compte</button>
                </>
              ) : (
                <button onClick={()=>switchMode("login")} className="text-brand hover:underline">← Retour à la connexion</button>
              )}
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-slate-700">
            Vision Guard AI Platform · ai-guard-vision-8ef41
          </p>
        </div>
      </div>
    </div>
  );
}
