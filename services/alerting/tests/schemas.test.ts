import { describe, it, expect } from "vitest";
import { readingNotificationSchema, shipmentIdQuerySchema } from "../src/schemas.js";

const validPayload = {
  deviceId: "123e4567-e89b-12d3-a456-426614174000",
  shipmentId: "223e4567-e89b-12d3-a456-426614174000",
  time: new Date().toISOString(),
  temperatureC: 4.2,
  humidityPct: 55,
  tempMinC: 2,
  tempMaxC: 8,
  humidityMinPct: 40,
  humidityMaxPct: 70,
};

describe("readingNotificationSchema", () => {
  it("accepts a valid notification payload", () => {
    expect(readingNotificationSchema.safeParse(validPayload).success).toBe(true);
  });

  it("accepts null humidity fields", () => {
    const result = readingNotificationSchema.safeParse({
      ...validPayload,
      humidityPct: null,
      humidityMinPct: null,
      humidityMaxPct: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-UUID deviceId", () => {
    expect(readingNotificationSchema.safeParse({ ...validPayload, deviceId: "not-a-uuid" }).success).toBe(false);
  });

  it("rejects a missing temperatureC", () => {
    const { temperatureC: _drop, ...rest } = validPayload;
    expect(readingNotificationSchema.safeParse(rest).success).toBe(false);
  });
});

describe("shipmentIdQuerySchema", () => {
  it("accepts a valid UUID", () => {
    expect(shipmentIdQuerySchema.safeParse({ shipmentId: "123e4567-e89b-12d3-a456-426614174000" }).success).toBe(true);
  });

  it("rejects a non-UUID string", () => {
    expect(shipmentIdQuerySchema.safeParse({ shipmentId: "nope" }).success).toBe(false);
  });
});
