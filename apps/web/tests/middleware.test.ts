import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

describe("middleware", () => {
  it("redirects to /login when accessing /dashboard without a session", () => {
    const request = new NextRequest("http://localhost/dashboard");
    const response = middleware(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });

  it("allows /dashboard through with a session cookie", () => {
    const request = new NextRequest("http://localhost/dashboard", {
      headers: { cookie: "refreshToken=abc123" },
    });
    const response = middleware(request);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects away from /login when already logged in", () => {
    const request = new NextRequest("http://localhost/login", {
      headers: { cookie: "refreshToken=abc123" },
    });
    const response = middleware(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/dashboard");
  });

  it("allows /login through when logged out", () => {
    const request = new NextRequest("http://localhost/login");
    const response = middleware(request);
    expect(response.headers.get("location")).toBeNull();
  });
});
