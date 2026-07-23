import { NextResponse } from "next/server";

const SERVER = process.env.NEXT_PUBLIC_AI_SERVER_URL ?? "https://guard-vision-ai-production.up.railway.app";

export async function GET() {
  try {
    const r = await fetch(`${SERVER}/diagnostic/report`, {
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    const data = await r.json();
    return NextResponse.json(data);
  } catch(e:any) {
    return NextResponse.json({ error: e.message, server: SERVER }, { status: 500 });
  }
}
