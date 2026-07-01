import { NextResponse } from "next/server";
import { requireBearerToken } from "../../../../../lib/api-auth";
import { internalHeaders } from "../../../../../lib/internal-fetch";

const SHIPMENT_SERVICE_URL = process.env.SHIPMENT_SERVICE_URL ?? "http://localhost:4002";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBearerToken(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const res = await fetch(`${SHIPMENT_SERVICE_URL}/shipments/${id}/alerts`, {
    headers: internalHeaders({ authorization: `Bearer ${auth.token}` }),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
