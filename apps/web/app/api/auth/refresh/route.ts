import { NextResponse } from "next/server";
import { getCookie } from "../../../../lib/cookies";
import { internalHeaders } from "../../../../lib/internal-fetch";

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL ?? "http://localhost:4001";

export async function POST(request: Request) {
  const refreshToken = getCookie(request, "refreshToken");
  if (!refreshToken) {
    return NextResponse.json({ error: "No refresh token" }, { status: 401 });
  }

  const res = await fetch(`${AUTH_SERVICE_URL}/auth/refresh`, {
    method: "POST",
    headers: internalHeaders(),
    body: JSON.stringify({ refreshToken }),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
