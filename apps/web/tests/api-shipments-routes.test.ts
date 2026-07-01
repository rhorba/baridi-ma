import { describe, it, expect, vi, afterEach } from "vitest";
import { SignJWT } from "jose";
import { GET as listRoute, POST as createRoute } from "../app/api/shipments/route";
import { GET as detailRoute } from "../app/api/shipments/[id]/route";
import { PATCH as assignCarrierRoute } from "../app/api/shipments/[id]/assign-carrier/route";
import { PATCH as statusRoute } from "../app/api/shipments/[id]/status/route";
import { GET as readingsRoute } from "../app/api/shipments/[id]/readings/route";
import { GET as alertsRoute } from "../app/api/shipments/[id]/alerts/route";

const secret = new TextEncoder().encode("test-secret-for-web-unit-tests");

async function makeAccessToken() {
  return new SignJWT({ sub: "user-1", role: "shipper", type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 900)
    .sign(secret);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function withParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/shipments", () => {
  it("returns 401 with no Authorization header", async () => {
    const res = await listRoute(new Request("http://localhost/api/shipments"));
    expect(res.status).toBe(401);
  });

  it("forwards a valid token and returns the Shipment Service response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([{ id: "s1" }]));
    vi.stubGlobal("fetch", fetchMock);
    const token = await makeAccessToken();

    const res = await listRoute(
      new Request("http://localhost/api/shipments", { headers: { authorization: `Bearer ${token}` } }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: "s1" }]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/shipments"),
      expect.objectContaining({ headers: expect.objectContaining({ "x-internal-token": "test-internal-token" }) }),
    );
  });
});

describe("POST /api/shipments", () => {
  it("returns 401 with no Authorization header", async () => {
    const res = await createRoute(new Request("http://localhost/api/shipments", { method: "POST", body: "{}" }));
    expect(res.status).toBe(401);
  });

  it("forwards the body and returns 201 on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "s1", status: "created" }, 201));
    vi.stubGlobal("fetch", fetchMock);
    const token = await makeAccessToken();

    const res = await createRoute(
      new Request("http://localhost/api/shipments", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({ productType: "Dairy" }),
      }),
    );
    expect(res.status).toBe(201);
    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ productType: "Dairy" });
  });
});

describe("GET /api/shipments/:id", () => {
  it("returns 401 with no Authorization header", async () => {
    const res = await detailRoute(new Request("http://localhost/api/shipments/s1"), withParams("s1"));
    expect(res.status).toBe(401);
  });

  it("forwards to the Shipment Service with the resolved id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "s1" }));
    vi.stubGlobal("fetch", fetchMock);
    const token = await makeAccessToken();

    const res = await detailRoute(
      new Request("http://localhost/api/shipments/s1", { headers: { authorization: `Bearer ${token}` } }),
      withParams("s1"),
    );
    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toContain("/shipments/s1");
  });
});

describe("PATCH /api/shipments/:id/assign-carrier", () => {
  it("returns 401 with no Authorization header", async () => {
    const res = await assignCarrierRoute(
      new Request("http://localhost/api/shipments/s1/assign-carrier", { method: "PATCH", body: "{}" }),
      withParams("s1"),
    );
    expect(res.status).toBe(401);
  });

  it("forwards the body to the Shipment Service", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "s1", carrierId: "c1" }));
    vi.stubGlobal("fetch", fetchMock);
    const token = await makeAccessToken();

    const res = await assignCarrierRoute(
      new Request("http://localhost/api/shipments/s1/assign-carrier", {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({ carrierEmail: "c@example.com" }),
      }),
      withParams("s1"),
    );
    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toContain("/shipments/s1/assign-carrier");
  });
});

describe("PATCH /api/shipments/:id/status", () => {
  it("returns 401 with no Authorization header", async () => {
    const res = await statusRoute(
      new Request("http://localhost/api/shipments/s1/status", { method: "PATCH", body: "{}" }),
      withParams("s1"),
    );
    expect(res.status).toBe(401);
  });

  it("forwards the body to the Shipment Service", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "s1", status: "in_transit" }));
    vi.stubGlobal("fetch", fetchMock);
    const token = await makeAccessToken();

    const res = await statusRoute(
      new Request("http://localhost/api/shipments/s1/status", {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: "in_transit" }),
      }),
      withParams("s1"),
    );
    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toContain("/shipments/s1/status");
  });
});

describe("GET /api/shipments/:id/readings", () => {
  it("returns 401 with no Authorization header", async () => {
    const res = await readingsRoute(new Request("http://localhost/api/shipments/s1/readings"), withParams("s1"));
    expect(res.status).toBe(401);
  });

  it("forwards to the Shipment Service with the resolved id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([{ time: "t1", temperatureC: 4, humidityPct: 55 }]));
    vi.stubGlobal("fetch", fetchMock);
    const token = await makeAccessToken();

    const res = await readingsRoute(
      new Request("http://localhost/api/shipments/s1/readings", { headers: { authorization: `Bearer ${token}` } }),
      withParams("s1"),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ time: "t1", temperatureC: 4, humidityPct: 55 }]);
    expect(fetchMock.mock.calls[0][0]).toContain("/shipments/s1/readings");
  });
});

describe("GET /api/shipments/:id/alerts", () => {
  it("returns 401 with no Authorization header", async () => {
    const res = await alertsRoute(new Request("http://localhost/api/shipments/s1/alerts"), withParams("s1"));
    expect(res.status).toBe(401);
  });

  it("forwards to the Shipment Service with the resolved id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([{ id: "a1", reason: "temp_high" }]));
    vi.stubGlobal("fetch", fetchMock);
    const token = await makeAccessToken();

    const res = await alertsRoute(
      new Request("http://localhost/api/shipments/s1/alerts", { headers: { authorization: `Bearer ${token}` } }),
      withParams("s1"),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: "a1", reason: "temp_high" }]);
    expect(fetchMock.mock.calls[0][0]).toContain("/shipments/s1/alerts");
  });
});
