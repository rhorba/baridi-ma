import { NextResponse } from "next/server";
import { internalHeaders } from "../../../../lib/internal-fetch";

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL ?? "http://localhost:4001";

export async function POST(request: Request) {
  const body = await request.json();
  const res = await fetch(`${AUTH_SERVICE_URL}/auth/register`, {
    method: "POST",
    headers: internalHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
