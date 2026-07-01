import { NextResponse } from "next/server";
import { verifyToken } from "./jwt";

// ADR-1: the BFF validates the JWT itself before forwarding identity to
// internal services — shared by every /api route that proxies to a service.
export async function requireBearerToken(request: Request): Promise<{ token: string } | NextResponse> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const claims = await verifyToken(token);
  if (!claims || claims.type !== "access") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { token };
}
