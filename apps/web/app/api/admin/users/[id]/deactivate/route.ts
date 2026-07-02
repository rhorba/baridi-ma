import { NextResponse } from "next/server";
import { requireBearerToken } from "../../../../../../lib/api-auth";

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL ?? "http://localhost:4001";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBearerToken(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const res = await fetch(`${AUTH_SERVICE_URL}/auth/admin/users/${id}/deactivate`, {
    method: "PATCH",
    // No request body — deliberately not using internal-fetch's internalHeaders()
    // helper, which always sets Content-Type: application/json. Fastify's default
    // JSON body parser rejects that combination on a bodyless request (see the
    // compliance-export proxy route for the same fix and full rationale).
    headers: { "x-internal-token": process.env.INTERNAL_SERVICE_TOKEN ?? "", authorization: `Bearer ${auth.token}` },
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
