import { NextResponse } from "next/server";
import { requireBearerToken } from "../../../../../lib/api-auth";
import { internalHeaders } from "../../../../../lib/internal-fetch";

const SHIPMENT_SERVICE_URL = process.env.SHIPMENT_SERVICE_URL ?? "http://localhost:4002";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBearerToken(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await request.json();
  const res = await fetch(`${SHIPMENT_SERVICE_URL}/shipments/${id}/status`, {
    method: "PATCH",
    headers: internalHeaders({ authorization: `Bearer ${auth.token}` }),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
