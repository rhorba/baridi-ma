import { NextResponse } from "next/server";
import { internalHeaders } from "../../../../lib/internal-fetch";

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL ?? "http://localhost:4001";
// Next.js hardcodes NODE_ENV=production for `next start` regardless of the actual
// deployment environment, so it can't tell us whether we're behind real TLS.
// Local/self-hosted dev has no TLS termination — default secure=true, opt out explicitly.
const cookieSecure = process.env.COOKIE_SECURE !== "false";

export async function POST(request: Request) {
  const body = await request.json();
  const res = await fetch(`${AUTH_SERVICE_URL}/auth/login`, {
    method: "POST",
    headers: internalHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }

  // Access token stays in memory on the client (never localStorage, per Security baseline §3).
  // Refresh token is the only thing persisted, and only as an httpOnly cookie.
  const response = NextResponse.json({ accessToken: data.accessToken, user: data.user });
  response.cookies.set("refreshToken", data.refreshToken, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
