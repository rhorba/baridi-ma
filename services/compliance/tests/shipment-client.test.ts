import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";

beforeAll(() => {
  process.env.SHIPMENT_SERVICE_URL = "http://shipment-service-test:4002";
  process.env.INTERNAL_SERVICE_TOKEN = "test-internal-token";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchShipment", () => {
  it("calls the Shipment Service internal lookup endpoint with the internal token", async () => {
    const { fetchShipment } = await import("../src/shipment-client.js");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "s1", receiverId: "r1", status: "delivered" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchShipment("s1");

    expect(result).toEqual({ id: "s1", receiverId: "r1", status: "delivered" });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("http://shipment-service-test:4002/internal/shipments/s1");
    expect(options.headers["x-internal-token"]).toBe("test-internal-token");
  });

  it("returns null when the Shipment Service responds with a non-ok status", async () => {
    const { fetchShipment } = await import("../src/shipment-client.js");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    expect(await fetchShipment("nonexistent")).toBeNull();
  });
});
