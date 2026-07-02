import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";

beforeAll(() => {
  process.env.AUTH_SERVICE_URL = "http://auth-service-test:4001";
  process.env.INTERNAL_SERVICE_TOKEN = "test-internal-token";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("lookupUserByEmail", () => {
  it("calls the Auth Service with the internal token and query params", async () => {
    const { lookupUserByEmail } = await import("../src/internal-client.js");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "u1", email: "a@b.com", name: "A", role: "receiver" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupUserByEmail("a@b.com", "receiver");

    expect(result).toEqual({ id: "u1", email: "a@b.com", name: "A", role: "receiver" });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("http://auth-service-test:4001/internal/users/lookup");
    expect(url).toContain("email=a%40b.com");
    expect(url).toContain("role=receiver");
    expect(options.headers["x-internal-token"]).toBe("test-internal-token");
  });

  it("returns null when the Auth Service responds with a non-ok status", async () => {
    const { lookupUserByEmail } = await import("../src/internal-client.js");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    const result = await lookupUserByEmail("nobody@example.com");
    expect(result).toBeNull();
  });
});

describe("lookupUsersByIds", () => {
  it("returns an empty array without calling fetch when given no ids", async () => {
    const { lookupUsersByIds } = await import("../src/internal-client.js");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await lookupUsersByIds([])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls the Auth Service batch endpoint with a comma-joined id list and the internal token", async () => {
    const { lookupUsersByIds } = await import("../src/internal-client.js");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ id: "u1", email: "a@b.com", name: "A", role: "receiver" }]), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupUsersByIds(["u1", "u2"]);

    expect(result).toEqual([{ id: "u1", email: "a@b.com", name: "A", role: "receiver" }]);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("http://auth-service-test:4001/internal/users/by-ids?ids=u1,u2");
    expect(options.headers["x-internal-token"]).toBe("test-internal-token");
  });

  it("returns an empty array when the Auth Service responds with a non-ok status", async () => {
    const { lookupUsersByIds } = await import("../src/internal-client.js");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    expect(await lookupUsersByIds(["u1"])).toEqual([]);
  });
});
