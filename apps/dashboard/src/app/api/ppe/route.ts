import { NextResponse } from "next/server";

const SERVER = process.env.NEXT_PUBLIC_AI_SERVER_URL ?? "https://guard-vision-ai-production.up.railway.app";

export async function GET() {
  try {
    const r = await fetch(`${SERVER}/ppe/train-status`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const data = await r.json();
    return NextResponse.json(data);
  } catch(e:any) {
    return NextResponse.json({ error: e.message, server: SERVER }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const r = await fetch(`${SERVER}/ppe/start-training`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const data = await r.json();
    return NextResponse.json(data);
  } catch(e:any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
