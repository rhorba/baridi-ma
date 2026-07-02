import { describe, it, expect } from "vitest";
import { generateCompliancePdf } from "../src/pdf.js";
import type { ShipmentDto } from "../src/shipment-client.js";

const shipment: ShipmentDto = {
  id: "11111111-1111-1111-1111-111111111111",
  shipperId: "shipper-1",
  carrierId: "carrier-1",
  receiverId: "receiver-1",
  assignedDeviceId: "device-1",
  productType: "Dairy",
  origin: "Casablanca",
  destination: "Rotterdam",
  tempMinC: 2,
  tempMaxC: 8,
  humidityMinPct: null,
  humidityMaxPct: null,
  status: "delivered",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("generateCompliancePdf", () => {
  it("produces a valid PDF byte stream", async () => {
    const bytes = await generateCompliancePdf(shipment, [{ time: "t1", temperatureC: 4, humidityPct: 55 }], "deadbeef");
    const header = Buffer.from(bytes.slice(0, 5)).toString("ascii");
    expect(header).toBe("%PDF-");
  });

  it("handles an empty reading set", async () => {
    const bytes = await generateCompliancePdf(shipment, [], "emptyhash");
    expect(bytes.length).toBeGreaterThan(0);
  });
});
