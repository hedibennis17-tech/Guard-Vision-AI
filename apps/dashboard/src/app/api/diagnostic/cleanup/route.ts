import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({
    message: "Nettoyage via Firebase Console",
    url: "https://console.firebase.google.com/project/ai-guard-vision-8ef41/firestore/data",
  });
}
