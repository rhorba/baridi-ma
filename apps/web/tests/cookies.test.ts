import { describe, it, expect } from "vitest";
import { getCookie } from "../lib/cookies";

describe("getCookie", () => {
  it("returns undefined when there is no cookie header", () => {
    const request = new Request("http://localhost/api/x");
    expect(getCookie(request, "refreshToken")).toBeUndefined();
  });

  it("extracts a single cookie value", () => {
    const request = new Request("http://localhost/api/x", { headers: { cookie: "refreshToken=abc123" } });
    expect(getCookie(request, "refreshToken")).toBe("abc123");
  });

  it("extracts the right cookie among several", () => {
    const request = new Request("http://localhost/api/x", {
      headers: { cookie: "other=1; refreshToken=abc123; another=2" },
    });
    expect(getCookie(request, "refreshToken")).toBe("abc123");
  });

  it("returns undefined when the named cookie is absent", () => {
    const request = new Request("http://localhost/api/x", { headers: { cookie: "other=1" } });
    expect(getCookie(request, "refreshToken")).toBeUndefined();
  });
});
