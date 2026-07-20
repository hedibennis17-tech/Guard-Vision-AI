import { NextResponse } from "next/server";

export async function GET() {
  const results: Record<string, any> = {};

  // 1. Variables d'environnement Firebase
  const envVars = {
    NEXT_PUBLIC_FIREBASE_API_KEY:            !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:        !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID:         !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:     !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:!!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID:             !!process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_AI_SERVER_URL:               process.env.NEXT_PUBLIC_AI_SERVER_URL || "❌ MANQUANT",
  };
  results.env_vars = envVars;

  const missingVars = Object.entries(envVars)
    .filter(([k,v]) => v === false)
    .map(([k]) => k);
  results.missing_firebase_vars = missingVars;

  // 2. Test connexion Firebase Admin (server-side)
  try {
    const admin = await import("firebase-admin");
    if (!admin.apps.length) {
      results.firebase_admin = "❌ Non initialisé côté serveur";
    } else {
      const db = admin.firestore();
      await db.collection("_health").doc("ping").set({ ts: Date.now() });
      results.firebase_admin = "✅ Connexion Firestore OK";
    }
  } catch(e:any) {
    results.firebase_admin = `❌ ${e.message}`;
  }

  // 3. Test Railway
  const serverUrl = process.env.NEXT_PUBLIC_AI_SERVER_URL;
  if (serverUrl) {
    try {
      const r = await fetch(`${serverUrl}/health`, { signal: AbortSignal.timeout(5000) });
      results.railway = r.ok ? "✅ En ligne" : `❌ HTTP ${r.status}`;
    } catch(e:any) {
      results.railway = `❌ ${e.message}`;
    }
  } else {
    results.railway = "❌ NEXT_PUBLIC_AI_SERVER_URL manquant";
  }

  // 4. Diagnostic global
  const allGood = missingVars.length === 0 && !results.railway.startsWith("❌");
  results.status = allGood ? "✅ Tout OK" : "❌ Problèmes détectés";
  results.timestamp = new Date().toISOString();

  return NextResponse.json(results, { status: 200 });
}
