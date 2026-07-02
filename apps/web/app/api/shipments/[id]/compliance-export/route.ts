import { NextResponse } from "next/server";
import { requireBearerToken } from "../../../../../lib/api-auth";
import { internalHeaders } from "../../../../../lib/internal-fetch";

const COMPLIANCE_SERVICE_URL = process.env.COMPLIANCE_SERVICE_URL ?? "http://localhost:4005";

// Unlike the other shipment proxies, a successful response here is a PDF, not
// JSON — pass the upstream body/content-type through unchanged rather than
// re-serializing (error responses are still JSON and pass through the same way).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBearerToken(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const res = await fetch(`${COMPLIANCE_SERVICE_URL}/compliance/${id}/export`, {
    method: "POST",
    headers: internalHeaders({ authorization: `Bearer ${auth.token}` }),
  });
  const body = await res.arrayBuffer();
  const headers = new Headers();
  const contentType = res.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  const readingHash = res.headers.get("x-reading-hash");
  if (readingHash) headers.set("X-Reading-Hash", readingHash);
  return new NextResponse(body, { status: res.status, headers });
}
