import { NextResponse } from "next/server";

/**
 * GET /api/diagnostic/camera
 * Teste les composants du module Camera depuis le serveur.
 * Retourne le statut de chaque check avec le message d'erreur exact.
 */
export async function GET() {
  const checks: Record<string, { ok: boolean; detail: string; fix?: string }> = {};

  // 1. Variables d'environnement Firebase
  const requiredEnv = [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
  ];
  const missingEnv = requiredEnv.filter((k) => !process.env[k]);
  checks.firebase_env = {
    ok:     missingEnv.length === 0,
    detail: missingEnv.length === 0
      ? `Toutes les variables Firebase sont présentes (project: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID})`
      : `Variables manquantes : ${missingEnv.join(", ")}`,
    fix: missingEnv.length > 0
      ? "Ajoutez les variables dans Vercel → Settings → Environment Variables (copiez depuis .env.example)"
      : undefined,
  };

  // 2. Reachability Firestore (HTTP REST sans auth)
  try {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "ai-guard-vision-8ef41";
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/plans?pageSize=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });

    if (res.status === 200) {
      checks.firestore_reachable = { ok:true, detail:"Firestore joignable et lisible (règles test mode)" };
    } else if (res.status === 403) {
      checks.firestore_reachable = {
        ok:    false,
        detail: "Firestore répond 403 — règles bloquent les lectures non authentifiées.",
        fix:   "Normal si en mode Production. Les écritures authentifiées fonctionneront si les règles autorisent request.auth != null.",
      };
    } else {
      const body = await res.text();
      checks.firestore_reachable = { ok:false, detail:`HTTP ${res.status}: ${body.slice(0,200)}` };
    }
  } catch (err: any) {
    checks.firestore_reachable = {
      ok:false, detail:`Firestore inaccessible: ${err.message}`,
      fix:"Vérifiez que Firestore est activé dans Firebase Console.",
    };
  }

  // 3. Reachability Firebase Auth
  try {
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "";
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
      { method:"POST", headers:{"Content-Type":"application/json"}, body:"{}",
        signal: AbortSignal.timeout(5000) }
    );
    const data = await res.json();
    if (data.error?.message === "OPERATION_NOT_ALLOWED") {
      checks.firebase_auth = {
        ok:false, detail:"Email/Password non activé dans Firebase Auth.",
        fix:"Firebase Console → Authentication → Sign-in method → Email/Password → Enable",
      };
    } else if (data.error?.message === "EMAIL_EXISTS" || data.idToken || data.error?.message?.includes("MISSING")) {
      checks.firebase_auth = { ok:true, detail:"Firebase Auth joignable et Email/Password activé." };
    } else {
      checks.firebase_auth = { ok:true, detail:`Firebase Auth répond (${JSON.stringify(data.error ?? "ok")})` };
    }
  } catch (err: any) {
    checks.firebase_auth = { ok:false, detail:`Firebase Auth inaccessible: ${err.message}` };
  }

  // 4. Firebase Storage bucket
  try {
    const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "ai-guard-vision-8ef41.firebasestorage.app";
    const res = await fetch(
      `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?maxResults=1`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.status === 200 || res.status === 403) {
      checks.firebase_storage = {
        ok:     true,
        detail: `Storage bucket "${bucket}" existe. Statut: ${res.status === 403 ? "règles bloquent (normal)" : "accessible"}`,
      };
    } else {
      checks.firebase_storage = {
        ok:false, detail:`Storage: HTTP ${res.status}`,
        fix:"Activez Firebase Storage dans la Console.",
      };
    }
  } catch (err: any) {
    checks.firebase_storage = { ok:false, detail:`Storage inaccessible: ${err.message}` };
  }

  const allOk = Object.values(checks).every((c) => c.ok);

  return NextResponse.json({
    module:    "camera",
    timestamp: new Date().toISOString(),
    allOk,
    checks,
    summary: allOk
      ? "✅ Module Camera — tous les services Firebase sont opérationnels."
      : "❌ Des problèmes ont été détectés — voir les checks pour les fixes.",
  });
}
