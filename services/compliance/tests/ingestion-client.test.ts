import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";

beforeAll(() => {
  process.env.INGESTION_SERVICE_URL = "http://ingestion-service-test:4003";
  process.env.INTERNAL_SERVICE_TOKEN = "test-internal-token";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchDeviceReadings", () => {
  it("calls the Ingestion Service internal readings endpoint with the internal token", async () => {
    const { fetchDeviceReadings } = await import("../src/ingestion-client.js");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ time: "t", temperatureC: 4, humidityPct: 55 }]), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchDeviceReadings("device-1");

    expect(result).toEqual([{ time: "t", temperatureC: 4, humidityPct: 55 }]);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("http://ingestion-service-test:4003/internal/devices/device-1/readings");
    expect(options.headers["x-internal-token"]).toBe("test-internal-token");
  });

  it("returns an empty array when the Ingestion Service responds with a non-ok status", async () => {
    const { fetchDeviceReadings } = await import("../src/ingestion-client.js");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    expect(await fetchDeviceReadings("device-1")).toEqual([]);
  });
});
