import { NextResponse } from "next/server";

export async function GET() {
  const results: Record<string, any> = {};

  // Variables Firebase
  results.firebase_env = {
    API_KEY:       !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    AUTH_DOMAIN:   !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    PROJECT_ID:    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "❌ MANQUANT",
    STORAGE:       !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    SENDER_ID:     !!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    APP_ID:        !!process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const missing = Object.entries(results.firebase_env)
    .filter(([,v]) => v === false)
    .map(([k]) => k);

  results.missing = missing;
  results.firebase_ok = missing.length === 0;

  // Railway
  const serverUrl = process.env.NEXT_PUBLIC_AI_SERVER_URL;
  results.railway_url = serverUrl || "❌ MANQUANT";
  if (serverUrl) {
    try {
      const r = await fetch(`${serverUrl}/health`, { signal: AbortSignal.timeout(5000), cache: "no-store" });
      const d = await r.json();
      results.railway = `✅ En ligne — v${d.version}`;
    } catch(e:any) {
      results.railway = `❌ ${e.message}`;
    }
  } else {
    results.railway = "❌ URL manquante dans Vercel env vars";
  }

  results.status = missing.length === 0 ? "✅ Config OK" : `❌ ${missing.length} variables manquantes`;
  results.timestamp = new Date().toISOString();

  return NextResponse.json(results);
}
