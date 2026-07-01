import { NextResponse } from "next/server";
import { requireBearerToken } from "../../../lib/api-auth";
import { internalHeaders } from "../../../lib/internal-fetch";

const SHIPMENT_SERVICE_URL = process.env.SHIPMENT_SERVICE_URL ?? "http://localhost:4002";

export async function GET(request: Request) {
  const auth = await requireBearerToken(request);
  if (auth instanceof NextResponse) return auth;

  const res = await fetch(`${SHIPMENT_SERVICE_URL}/shipments`, {
    headers: internalHeaders({ authorization: `Bearer ${auth.token}` }),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function POST(request: Request) {
  const auth = await requireBearerToken(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const res = await fetch(`${SHIPMENT_SERVICE_URL}/shipments`, {
    method: "POST",
    headers: internalHeaders({ authorization: `Bearer ${auth.token}` }),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
