"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/context/AuthContext";

type Mode = "login" | "register" | "reset";

function LoginForm() {
  const router = useRouter();
  const { user, signIn, signUp, resetPassword, loading, error, clearError } = useAuth();

  const [mode,       setMode]       = useState<Mode>("login");
  const [email,      setEmail]      = useState("hedibennis17@gmail.com");
  const [password,   setPassword]   = useState("");
  const [name,       setName]       = useState("");
  const [resetSent,  setResetSent]  = useState(false);
  const [busy,       setBusy]       = useState(false);
  const [localErr,   setLocalErr]   = useState<string | null>(null);

  useEffect(() => {
    if (user && !loading) router.replace("/dashboard");
  }, [user, loading]);

  const err = localErr || error;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    clearError(); setLocalErr(null); setBusy(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
        router.replace("/dashboard");
      } else if (mode === "register") {
        if (!name.trim()) { setLocalErr("Le nom est requis."); return; }
        await signUp(email, password, name);
        router.replace("/dashboard");
      } else {
        await resetPassword(email);
        setResetSent(true);
      }
    } catch {}
    finally { setBusy(false); }
  }

  const sw = (m: Mode) => { setMode(m); clearError(); setLocalErr(null); setResetSent(false); };

  return (
    <div className="flex min-h-screen bg-slate-950">

      {/* Panel gauche branding */}
      <div className="hidden lg:flex w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden"
        style={{ background:"linear-gradient(135deg,#0f172a 0%,#0d1f3c 50%,#0f172a 100%)" }}>
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage:"linear-gradient(#0EA5E9 1px,transparent 1px),linear-gradient(90deg,#0EA5E9 1px,transparent 1px)", backgroundSize:"40px 40px" }}/>
        <div className="relative z-10 text-center max-w-md">
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-brand/20 border border-brand/30 text-5xl">👁️</div>
          <h1 className="text-4xl font-bold text-white mb-3">Vision Guard AI</h1>
          <p className="text-slate-400 mb-8">Surveillance intelligente propulsée par YOLOv11</p>
          <div className="space-y-3 text-left">
            {[
              { icon:"🎯", title:"YOLOv11 temps réel",   desc:"Détection multi-classes <50ms" },
              { icon:"🧩", title:"8 modules sectoriels",  desc:"Retail, Construction, Défense..." },
              { icon:"🔔", title:"Alertes intelligentes", desc:"Push, Email, clips vidéo" },
              { icon:"📊", title:"Analytics avancés",     desc:"Heatmaps, rapports, trends" },
            ].map(f => (
              <div key={f.title} className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                <span className="text-xl shrink-0">{f.icon}</span>
                <div>
                  <p className="text-sm font-medium text-white">{f.title}</p>
                  <p className="text-xs text-slate-500">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Panel droit formulaire */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">

          {/* Logo mobile */}
          <div className="lg:hidden text-center mb-8">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-3xl">👁️</div>
            <h1 className="text-xl font-bold text-white">Vision Guard AI</h1>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8">
            <h2 className="text-xl font-semibold text-white mb-1">
              {mode === "login" ? "Connexion" : mode === "register" ? "Créer un compte" : "Réinitialiser"}
            </h2>
            <p className="text-xs text-slate-500 mb-6">
              {mode === "login" ? "Accès Dashboard Administrateur" : mode === "register" ? "Rejoindre Vision Guard" : "Lien par email"}
            </p>

            {resetSent && (
              <div className="mb-4 rounded-xl border border-emerald-800 bg-emerald-900/20 p-3 text-sm text-emerald-400 text-center">
                ✅ Email envoyé — vérifiez votre boîte
              </div>
            )}

            {err && (
              <div className="mb-4 rounded-xl border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">
                ❌ {err}
              </div>
            )}

            <form onSubmit={submit} className="space-y-4">
              {mode === "register" && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">Nom complet</label>
                  <input type="text" value={name} onChange={e=>setName(e.target.value)}
                    placeholder="Votre nom" required
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-brand focus:outline-none" />
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Email</label>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                  placeholder="vous@email.com" required autoComplete="email"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-brand focus:outline-none" />
              </div>

              {mode !== "reset" && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-400">Mot de passe</label>
                    {mode === "login" && (
                      <button type="button" onClick={()=>sw("reset")} className="text-xs text-brand hover:underline">
                        Oublié ?
                      </button>
                    )}
                  </div>
                  <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
                    placeholder={mode==="register"?"Min. 6 caractères":"••••••••"}
                    required minLength={6}
                    autoComplete={mode==="login"?"current-password":"new-password"}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-brand focus:outline-none" />
                </div>
              )}

              <button type="submit" disabled={busy || loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white disabled:opacity-60 hover:bg-brand/90 transition-colors">
                {(busy || loading)
                  ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"/>Connexion...</>
                  : mode==="login" ? "Se connecter →" : mode==="register" ? "Créer le compte →" : "Envoyer le lien →"}
              </button>
            </form>

            <div className="mt-5 text-center text-xs text-slate-500">
              {mode==="login" ? (
                <>Pas de compte ?{" "}<button onClick={()=>sw("register")} className="text-brand hover:underline">Créer un compte</button></>
              ) : (
                <button onClick={()=>sw("login")} className="text-brand hover:underline">← Retour à la connexion</button>
              )}
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-slate-700">Vision Guard AI · ai-guard-vision-8ef41</p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
