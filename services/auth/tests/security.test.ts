import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../src/security.js";

describe("password hashing", () => {
  it("hashes and verifies a correct password", async () => {
    const hash = await hashPassword("correcthorsebattery");
    expect(await verifyPassword("correcthorsebattery", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correcthorsebattery");
    expect(await verifyPassword("wrongpassword", hash)).toBe(false);
  });

  it("never stores the password in plaintext", async () => {
    const hash = await hashPassword("correcthorsebattery");
    expect(hash).not.toBe("correcthorsebattery");
  });
});
