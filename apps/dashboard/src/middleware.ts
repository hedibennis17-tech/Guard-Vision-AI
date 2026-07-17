import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes publiques — accessibles sans connexion
const PUBLIC_ROUTES = ["/login", "/register", "/reset-password"];

// Routes API publiques
const PUBLIC_API    = ["/api/diagnostic/camera"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Laisser passer les routes publiques
  if (PUBLIC_ROUTES.some(r => pathname.startsWith(r))) return NextResponse.next();
  if (PUBLIC_API.some(r => pathname.startsWith(r)))    return NextResponse.next();
  if (pathname.startsWith("/_next"))                    return NextResponse.next();
  if (pathname.startsWith("/favicon"))                  return NextResponse.next();

  // Vérifier le cookie de session Firebase
  const session = request.cookies.get("__session")?.value
    ?? request.cookies.get("firebase-auth-token")?.value;

  // Si pas de session → rediriger vers login
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/diagnostic/camera).*)",
  ],
};
