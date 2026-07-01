import { describe, it, expect } from "vitest";
import { registerSchema, loginSchema } from "../src/schemas.js";

describe("registerSchema", () => {
  it("accepts a valid registration payload", () => {
    const result = registerSchema.safeParse({
      email: "amina@example.com",
      password: "correcthorsebattery",
      name: "Amina",
      role: "shipper",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a password shorter than 10 characters", () => {
    const result = registerSchema.safeParse({
      email: "amina@example.com",
      password: "short1",
      name: "Amina",
      role: "shipper",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a common password", () => {
    const result = registerSchema.safeParse({
      email: "amina@example.com",
      password: "password123",
      name: "Amina",
      role: "shipper",
    });
    expect(result.success).toBe(false);
  });

  it("rejects role=admin from public registration", () => {
    const result = registerSchema.safeParse({
      email: "amina@example.com",
      password: "correcthorsebattery",
      name: "Amina",
      role: "admin",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = registerSchema.safeParse({
      email: "not-an-email",
      password: "correcthorsebattery",
      name: "Amina",
      role: "shipper",
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts a valid login payload", () => {
    const result = loginSchema.safeParse({ email: "amina@example.com", password: "anything" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "x" });
    expect(result.success).toBe(false);
  });
});
