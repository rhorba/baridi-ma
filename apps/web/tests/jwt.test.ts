import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import { verifyToken } from "../lib/jwt";

const secret = new TextEncoder().encode("test-secret-for-web-unit-tests");

async function makeToken(claims: Record<string, unknown>, expSeconds?: number) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expSeconds ?? Math.floor(Date.now() / 1000) + 900)
    .sign(secret);
}

describe("verifyToken", () => {
  it("verifies a validly signed access token", async () => {
    const token = await makeToken({ sub: "user-1", role: "shipper", type: "access" });
    const claims = await verifyToken(token);
    expect(claims?.sub).toBe("user-1");
    expect(claims?.role).toBe("shipper");
    expect(claims?.type).toBe("access");
  });

  it("rejects a token signed with the wrong secret", async () => {
    const wrongSecret = new TextEncoder().encode("wrong-secret");
    const token = await new SignJWT({ sub: "user-1", role: "shipper", type: "access" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + 900)
      .sign(wrongSecret);
    const claims = await verifyToken(token);
    expect(claims).toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await makeToken({ sub: "user-1", role: "shipper", type: "access" }, Math.floor(Date.now() / 1000) - 10);
    const claims = await verifyToken(token);
    expect(claims).toBeNull();
  });

  it("rejects a malformed token", async () => {
    const claims = await verifyToken("not-a-valid-jwt");
    expect(claims).toBeNull();
  });
});
