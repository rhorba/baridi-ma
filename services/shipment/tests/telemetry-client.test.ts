import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";

beforeAll(() => {
  process.env.INGESTION_SERVICE_URL = "http://ingestion-service-test:4003";
  process.env.ALERTING_SERVICE_URL = "http://alerting-service-test:4004";
  process.env.INTERNAL_SERVICE_TOKEN = "test-internal-token";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("fetchDeviceReadings", () => {
  it("calls the Ingestion Service internal readings endpoint", async () => {
    const { fetchDeviceReadings } = await import("../src/telemetry-client.js");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([{ time: "t", temperatureC: 4, humidityPct: 55 }]));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchDeviceReadings("device-1");

    expect(result).toEqual([{ time: "t", temperatureC: 4, humidityPct: 55 }]);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("http://ingestion-service-test:4003/internal/devices/device-1/readings");
    expect(options.headers["x-internal-token"]).toBe("test-internal-token");
  });

  it("returns an empty array when the Ingestion Service responds with a non-ok status", async () => {
    const { fetchDeviceReadings } = await import("../src/telemetry-client.js");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    expect(await fetchDeviceReadings("device-1")).toEqual([]);
  });
});

describe("fetchShipmentAlerts", () => {
  it("calls the Alerting Service internal alerts endpoint", async () => {
    const { fetchShipmentAlerts } = await import("../src/telemetry-client.js");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([{ id: "a1", reason: "temp_high" }]));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchShipmentAlerts("shipment-1");

    expect(result).toEqual([{ id: "a1", reason: "temp_high" }]);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("http://alerting-service-test:4004/internal/alerts");
    expect(url).toContain("shipmentId=shipment-1");
  });

  it("returns an empty array when the Alerting Service responds with a non-ok status", async () => {
    const { fetchShipmentAlerts } = await import("../src/telemetry-client.js");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    expect(await fetchShipmentAlerts("shipment-1")).toEqual([]);
  });
});
