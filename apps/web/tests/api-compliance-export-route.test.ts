import { describe, it, expect, vi, afterEach } from "vitest";
import { SignJWT } from "jose";
import { POST as complianceExportRoute } from "../app/api/shipments/[id]/compliance-export/route";

const secret = new TextEncoder().encode("test-secret-for-web-unit-tests");

async function makeAccessToken(role = "receiver") {
  return new SignJWT({ sub: "user-1", role, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 900)
    .sign(secret);
}

function withParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/shipments/:id/compliance-export", () => {
  it("returns 401 with no Authorization header", async () => {
    const res = await complianceExportRoute(
      new Request("http://localhost/api/shipments/s1/compliance-export", { method: "POST" }),
      withParams("s1"),
    );
    expect(res.status).toBe(401);
  });

  it("forwards to the Compliance Service and streams the PDF bytes + headers through unchanged", async () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(pdfBytes, {
        status: 201,
        headers: { "content-type": "application/pdf", "x-reading-hash": "deadbeef" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const token = await makeAccessToken();

    const res = await complianceExportRoute(
      new Request("http://localhost/api/shipments/s1/compliance-export", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      }),
      withParams("s1"),
    );

    expect(res.status).toBe(201);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("x-reading-hash")).toBe("deadbeef");
    const body = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(body)).toEqual(Array.from(pdfBytes));
    expect(fetchMock.mock.calls[0][0]).toContain("/compliance/s1/export");
    expect(fetchMock.mock.calls[0][1].headers["x-internal-token"]).toBe("test-internal-token");
  });

  it("passes through a JSON error response from the Compliance Service unchanged", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Export is only available once the shipment has been delivered" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const token = await makeAccessToken();

    const res = await complianceExportRoute(
      new Request("http://localhost/api/shipments/s1/compliance-export", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      }),
      withParams("s1"),
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Export is only available once the shipment has been delivered" });
  });
});
