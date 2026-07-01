import { describe, it, expect } from "vitest";
import { isValidTransition } from "../src/status-transitions.js";

describe("isValidTransition", () => {
  it("allows created -> in_transit", () => {
    expect(isValidTransition("created", "in_transit")).toBe(true);
  });

  it("allows created -> cancelled", () => {
    expect(isValidTransition("created", "cancelled")).toBe(true);
  });

  it("allows in_transit -> delivered", () => {
    expect(isValidTransition("in_transit", "delivered")).toBe(true);
  });

  it("allows in_transit -> cancelled", () => {
    expect(isValidTransition("in_transit", "cancelled")).toBe(true);
  });

  it("rejects created -> delivered (skipping in_transit)", () => {
    expect(isValidTransition("created", "delivered")).toBe(false);
  });

  it("rejects any transition out of delivered", () => {
    expect(isValidTransition("delivered", "in_transit")).toBe(false);
    expect(isValidTransition("delivered", "cancelled")).toBe(false);
  });

  it("rejects any transition out of cancelled", () => {
    expect(isValidTransition("cancelled", "in_transit")).toBe(false);
    expect(isValidTransition("cancelled", "delivered")).toBe(false);
  });
});
