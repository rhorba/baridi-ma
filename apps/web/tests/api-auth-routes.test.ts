import { describe, it, expect, vi, afterEach } from "vitest";
import { SignJWT } from "jose";
import { POST as registerRoute } from "../app/api/auth/register/route";
import { POST as loginRoute } from "../app/api/auth/login/route";
import { POST as refreshRoute } from "../app/api/auth/refresh/route";
import { POST as logoutRoute } from "../app/api/auth/logout/route";
import { GET as meRoute } from "../app/api/auth/me/route";

const secret = new TextEncoder().encode("test-secret-for-web-unit-tests");

async function makeAccessToken() {
  return new SignJWT({ sub: "user-1", role: "shipper", type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 900)
    .sign(secret);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/auth/register", () => {
  it("proxies the request body to the Auth Service and forwards the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "u1", email: "a@b.com" }, 201));
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("http://localhost/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.com", password: "correcthorsebattery", name: "A", role: "shipper" }),
    });
    const response = await registerRoute(request);

    expect(response.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/register"),
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("POST /api/auth/login", () => {
  it("sets an httpOnly refresh-token cookie and returns only the access token to the client", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ accessToken: "access-xyz", refreshToken: "refresh-xyz", user: { id: "u1" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.com", password: "x" }),
    });
    const response = await loginRoute(request);
    const body = await response.json();

    expect(body.accessToken).toBe("access-xyz");
    expect(body.refreshToken).toBeUndefined();

    const cookie = response.cookies.get("refreshToken");
    expect(cookie?.value).toBe("refresh-xyz");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("strict");
  });

  it("does not set a cookie when the Auth Service rejects the login", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: "Invalid credentials" }, 401));
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.com", password: "wrong" }),
    });
    const response = await loginRoute(request);

    expect(response.status).toBe(401);
    expect(response.cookies.get("refreshToken")).toBeUndefined();
  });
});

describe("POST /api/auth/refresh", () => {
  it("returns 401 when there is no refresh-token cookie", async () => {
    const request = new Request("http://localhost/api/auth/refresh", { method: "POST" });
    const response = await refreshRoute(request);
    expect(response.status).toBe(401);
  });

  it("exchanges the cookie's refresh token via the Auth Service", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ accessToken: "new-access" }));
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("http://localhost/api/auth/refresh", {
      method: "POST",
      headers: { cookie: "refreshToken=refresh-xyz" },
    });
    const response = await refreshRoute(request);
    const body = await response.json();

    expect(body.accessToken).toBe("new-access");
    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.parse(options.body).refreshToken).toBe("refresh-xyz");
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the refresh-token cookie", async () => {
    const response = await logoutRoute();
    const cookie = response.cookies.get("refreshToken");
    expect(cookie?.value).toBe("");
  });
});

describe("GET /api/auth/me", () => {
  it("returns 401 with no Authorization header", async () => {
    const request = new Request("http://localhost/api/auth/me");
    const response = await meRoute(request);
    expect(response.status).toBe(401);
  });

  it("returns 401 for a token that fails BFF-side verification", async () => {
    const request = new Request("http://localhost/api/auth/me", {
      headers: { authorization: "Bearer not-a-real-token" },
    });
    const response = await meRoute(request);
    expect(response.status).toBe(401);
  });

  it("forwards a validly signed token to the Auth Service", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "u1", email: "a@b.com" }));
    vi.stubGlobal("fetch", fetchMock);

    const token = await makeAccessToken();
    const request = new Request("http://localhost/api/auth/me", {
      headers: { authorization: `Bearer ${token}` },
    });
    const response = await meRoute(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.id).toBe("u1");
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.authorization).toBe(`Bearer ${token}`);
  });
});
