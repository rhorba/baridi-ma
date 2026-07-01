import { describe, it, expect } from "vitest";
import { initialState, nextReading, type SimulatorConfig } from "../src/simulate.js";

const config: SimulatorConfig = {
  baseTempC: 4,
  baseHumidityPct: 55,
  excursionProbability: 0.05,
  excursionMagnitudeC: 6,
};

describe("initialState", () => {
  it("starts at the configured baseline with no excursion", () => {
    const state = initialState(config);
    expect(state).toEqual({ temperatureC: 4, humidityPct: 55, excursionReadingsLeft: 0 });
  });
});

describe("nextReading", () => {
  it("stays near baseline when the excursion roll never triggers", () => {
    const random = () => 0.9; // always >= excursionProbability, and mid-range for jitter
    let state = initialState(config);
    for (let i = 0; i < 5; i++) {
      state = nextReading(state, config, random);
      expect(state.temperatureC).toBeGreaterThan(3.5);
      expect(state.temperatureC).toBeLessThan(4.5);
      expect(state.excursionReadingsLeft).toBe(0);
    }
  });

  it("starts an excursion when the roll is below the probability threshold", () => {
    const random = () => 0.01; // 0.01 < excursionProbability (0.05), so it always triggers
    const state = nextReading(initialState(config), config, random);
    expect(state.temperatureC).toBeGreaterThan(9); // baseTempC(4) + excursionMagnitudeC(6) minus small jitter
    expect(state.excursionReadingsLeft).toBeGreaterThan(0);
  });

  it("keeps the temperature elevated for the remaining excursion readings, then returns to baseline", () => {
    let state = { temperatureC: 10, humidityPct: 55, excursionReadingsLeft: 1 };
    const highRandom = () => 0.99; // never re-triggers a new excursion

    state = nextReading(state, config, highRandom);
    expect(state.excursionReadingsLeft).toBe(0);
    expect(state.temperatureC).toBeGreaterThan(9); // last excursion reading

    state = nextReading(state, config, highRandom);
    expect(state.temperatureC).toBeLessThan(4.5); // back to baseline
  });

  it("keeps humidity within a small jitter band of the baseline", () => {
    const random = () => 0.5;
    const state = nextReading(initialState(config), config, random);
    expect(state.humidityPct).toBeGreaterThan(50);
    expect(state.humidityPct).toBeLessThan(60);
  });
});
