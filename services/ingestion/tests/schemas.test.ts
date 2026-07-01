import { describe, it, expect } from "vitest";
import { readingPayloadSchema, deviceIdParamSchema } from "../src/schemas.js";

describe("readingPayloadSchema", () => {
  it("accepts a valid reading with humidity", () => {
    const result = readingPayloadSchema.safeParse({ deviceToken: "abc123", temperatureC: 4.2, humidityPct: 55 });
    expect(result.success).toBe(true);
  });

  it("accepts a valid reading without humidity", () => {
    const result = readingPayloadSchema.safeParse({ deviceToken: "abc123", temperatureC: 4.2 });
    expect(result.success).toBe(true);
  });

  it("rejects a missing deviceToken", () => {
    const result = readingPayloadSchema.safeParse({ temperatureC: 4.2 });
    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric temperature", () => {
    const result = readingPayloadSchema.safeParse({ deviceToken: "abc123", temperatureC: "cold" });
    expect(result.success).toBe(false);
  });

  it("rejects humidity outside 0-100", () => {
    const result = readingPayloadSchema.safeParse({ deviceToken: "abc123", temperatureC: 4.2, humidityPct: 150 });
    expect(result.success).toBe(false);
  });
});

describe("deviceIdParamSchema", () => {
  it("accepts a valid UUID", () => {
    expect(deviceIdParamSchema.safeParse({ id: "123e4567-e89b-12d3-a456-426614174000" }).success).toBe(true);
  });

  it("rejects a non-UUID string", () => {
    expect(deviceIdParamSchema.safeParse({ id: "not-a-uuid" }).success).toBe(false);
  });
});
