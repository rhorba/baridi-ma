import { describe, it, expect } from "vitest";
import { createShipmentSchema, shipmentIdSchema } from "../src/schemas.js";

const validShipment = {
  productType: "Dairy",
  origin: "Casablanca",
  destination: "Rotterdam",
  receiverEmail: "receiver@example.com",
  tempMinC: 2,
  tempMaxC: 8,
};

describe("createShipmentSchema", () => {
  it("accepts a valid shipment payload", () => {
    expect(createShipmentSchema.safeParse(validShipment).success).toBe(true);
  });

  it("rejects tempMinC greater than tempMaxC", () => {
    const result = createShipmentSchema.safeParse({ ...validShipment, tempMinC: 10, tempMaxC: 5 });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid receiver email", () => {
    const result = createShipmentSchema.safeParse({ ...validShipment, receiverEmail: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects humidity outside 0-100", () => {
    const result = createShipmentSchema.safeParse({ ...validShipment, humidityMinPct: 150 });
    expect(result.success).toBe(false);
  });

  it("rejects an empty product type", () => {
    const result = createShipmentSchema.safeParse({ ...validShipment, productType: "" });
    expect(result.success).toBe(false);
  });
});

describe("shipmentIdSchema", () => {
  it("accepts a valid UUID", () => {
    const result = shipmentIdSchema.safeParse({ id: "123e4567-e89b-12d3-a456-426614174000" });
    expect(result.success).toBe(true);
  });

  it("rejects a non-UUID string", () => {
    const result = shipmentIdSchema.safeParse({ id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });
});
