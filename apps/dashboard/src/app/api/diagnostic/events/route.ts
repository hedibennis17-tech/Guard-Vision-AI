import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    message: "Utilisez la page /diagnostic/events côté client pour tester avec Firebase Auth",
  });
}
