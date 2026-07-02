import { describe, it, expect } from "vitest";
import { hashReadings } from "../src/hash.js";

describe("hashReadings", () => {
  it("is deterministic for the same reading set", () => {
    const readings = [{ time: "t1", temperatureC: 4, humidityPct: 55 }];
    expect(hashReadings(readings)).toBe(hashReadings(readings));
  });

  it("produces different hashes for different reading sets", () => {
    const a = hashReadings([{ time: "t1", temperatureC: 4, humidityPct: 55 }]);
    const b = hashReadings([{ time: "t1", temperatureC: 5, humidityPct: 55 }]);
    expect(a).not.toBe(b);
  });

  it("hashes an empty reading set to a stable value", () => {
    expect(hashReadings([])).toBe(hashReadings([]));
  });

  it("ignores extraneous object keys — canonicalizes to time/temperatureC/humidityPct", () => {
    const withExtra = hashReadings([{ time: "t1", temperatureC: 4, humidityPct: null, extra: "x" } as never]);
    const withoutExtra = hashReadings([{ time: "t1", temperatureC: 4, humidityPct: null }]);
    expect(withExtra).toBe(withoutExtra);
  });
});
