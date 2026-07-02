import { NextResponse } from "next/server";
import { requireBearerToken } from "../../../../lib/api-auth";
import { internalHeaders } from "../../../../lib/internal-fetch";

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL ?? "http://localhost:4001";

export async function GET(request: Request) {
  const auth = await requireBearerToken(request);
  if (auth instanceof NextResponse) return auth;

  const res = await fetch(`${AUTH_SERVICE_URL}/auth/admin/users`, {
    headers: internalHeaders({ authorization: `Bearer ${auth.token}` }),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
