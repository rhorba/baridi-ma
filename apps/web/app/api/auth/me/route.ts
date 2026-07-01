import { NextResponse } from "next/server";
import { verifyToken } from "../../../../lib/jwt";
import { internalHeaders } from "../../../../lib/internal-fetch";

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL ?? "http://localhost:4001";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ADR-1: the BFF validates the JWT itself before forwarding identity to internal services.
  const claims = await verifyToken(token);
  if (!claims || claims.type !== "access") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const res = await fetch(`${AUTH_SERVICE_URL}/auth/me`, {
    headers: internalHeaders({ authorization: authHeader! }),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
