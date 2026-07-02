import { describe, it, expect, vi, afterEach } from "vitest";
import { SignJWT } from "jose";
import { GET as listUsersRoute } from "../app/api/admin/users/route";
import { PATCH as deactivateRoute } from "../app/api/admin/users/[id]/deactivate/route";

const secret = new TextEncoder().encode("test-secret-for-web-unit-tests");

async function makeAccessToken(role = "admin") {
  return new SignJWT({ sub: "admin-1", role, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 900)
    .sign(secret);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function withParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/admin/users", () => {
  it("returns 401 with no Authorization header", async () => {
    const res = await listUsersRoute(new Request("http://localhost/api/admin/users"));
    expect(res.status).toBe(401);
  });

  it("forwards a valid token and returns the Auth Service response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([{ id: "u1", email: "a@b.com" }]));
    vi.stubGlobal("fetch", fetchMock);
    const token = await makeAccessToken();

    const res = await listUsersRoute(
      new Request("http://localhost/api/admin/users", { headers: { authorization: `Bearer ${token}` } }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: "u1", email: "a@b.com" }]);
    expect(fetchMock.mock.calls[0][0]).toContain("/auth/admin/users");
  });

  it("passes through a 403 from the Auth Service (non-admin caller)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: "Admin access required" }, 403));
    vi.stubGlobal("fetch", fetchMock);
    const token = await makeAccessToken("receiver");

    const res = await listUsersRoute(
      new Request("http://localhost/api/admin/users", { headers: { authorization: `Bearer ${token}` } }),
    );
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/admin/users/:id/deactivate", () => {
  it("returns 401 with no Authorization header", async () => {
    const res = await deactivateRoute(
      new Request("http://localhost/api/admin/users/u1/deactivate", { method: "PATCH" }),
      withParams("u1"),
    );
    expect(res.status).toBe(401);
  });

  it("forwards to the Auth Service without sending a Content-Type on the bodyless request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "u1", isActive: false }));
    vi.stubGlobal("fetch", fetchMock);
    const token = await makeAccessToken();

    const res = await deactivateRoute(
      new Request("http://localhost/api/admin/users/u1/deactivate", {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}` },
      }),
      withParams("u1"),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "u1", isActive: false });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/auth/admin/users/u1/deactivate");
    expect(options.method).toBe("PATCH");
    expect(options.headers["Content-Type"]).toBeUndefined();
    expect(options.headers["x-internal-token"]).toBe("test-internal-token");
  });
});
