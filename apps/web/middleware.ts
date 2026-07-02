import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PATHS = ["/dashboard", "/shipments", "/admin"];

// Coarse, cookie-presence-only redirect for page loads. The refresh-token
// cookie is httpOnly so this can't forge access — real authorization happens
// per-request via the in-memory access token against /api routes (see lib/jwt.ts).
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has("refreshToken");

  if (PROTECTED_PATHS.some((p) => pathname.startsWith(p)) && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (pathname === "/login" && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/shipments/:path*", "/admin/:path*", "/login"],
};
