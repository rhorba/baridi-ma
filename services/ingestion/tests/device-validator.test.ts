import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";

beforeAll(() => {
  process.env.SHIPMENT_SERVICE_URL = "http://shipment-service-test:4002";
  process.env.INTERNAL_SERVICE_TOKEN = "test-internal-token";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("validateDevice", () => {
  it("calls the Shipment Service with the internal token and device token query param", async () => {
    const { validateDevice } = await import("../src/device-validator.js");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ deviceId: "d1", shipmentId: "s1", tempMinC: 2, tempMaxC: 8, humidityMinPct: null, humidityMaxPct: null }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await validateDevice("token-abc");

    expect(result?.deviceId).toBe("d1");
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("http://shipment-service-test:4002/internal/devices/validate");
    expect(url).toContain("token=token-abc");
    expect(options.headers["x-internal-token"]).toBe("test-internal-token");
  });

  it("returns null when the Shipment Service responds with a non-ok status", async () => {
    const { validateDevice } = await import("../src/device-validator.js");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    expect(await validateDevice("unknown-token")).toBeNull();
  });
});
