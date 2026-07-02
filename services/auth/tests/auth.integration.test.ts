import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import { Pool } from "pg";
import fs from "node:fs";
import path from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyJwt from "@fastify/jwt";
import { dbPlugin } from "../src/db.js";
import { authRoutes } from "../src/routes.js";
import { internalRoutes } from "../src/internal-routes.js";
import { adminRoutes } from "../src/admin-routes.js";

let container: StartedTestContainer;
let migrationPool: Pool;
let app: FastifyInstance;

beforeAll(async () => {
  container = await new GenericContainer("timescale/timescaledb:2.17.2-pg16")
    .withEnvironment({ POSTGRES_USER: "baridi", POSTGRES_PASSWORD: "baridi", POSTGRES_DB: "baridi_ma" })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage("database system is ready to accept connections", 2))
    .start();

  const port = container.getMappedPort(5432);
  const host = container.getHost();
  process.env.DATABASE_URL = `postgresql://baridi:baridi@${host}:${port}/baridi_ma`;
  process.env.JWT_SECRET = "test-secret";
  process.env.INTERNAL_SERVICE_TOKEN = "test-internal-token";

  migrationPool = new Pool({ connectionString: process.env.DATABASE_URL });
  const migrationSql = fs.readFileSync(
    path.join(__dirname, "../../../db/migrations/001_auth_schema.sql"),
    "utf8",
  );
  await migrationPool.query(migrationSql);

  app = Fastify();
  await app.register(fastifyJwt, { secret: process.env.JWT_SECRET });
  await app.register(dbPlugin);
  await app.register(authRoutes);
  await app.register(internalRoutes);
  await app.register(adminRoutes);
  await app.ready();
}, 60_000);

afterAll(async () => {
  await migrationPool.end();
  await app.close();
  await container.stop();
});

describe("auth flow", () => {
  it("registers, logs in, and fetches /auth/me", async () => {
    const registerRes = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "amina@example.com", password: "correcthorsebattery", name: "Amina", role: "shipper" },
    });
    expect(registerRes.statusCode).toBe(201);

    const loginRes = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "amina@example.com", password: "correcthorsebattery" },
    });
    expect(loginRes.statusCode).toBe(200);
    const { accessToken, refreshToken } = loginRes.json();
    expect(accessToken).toBeDefined();
    expect(refreshToken).toBeDefined();

    const meRes = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(meRes.statusCode).toBe(200);
    expect(meRes.json().email).toBe("amina@example.com");
  });

  it("rejects a malformed registration payload", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "not-an-email", password: "short", name: "", role: "shipper" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a malformed login payload", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "not-an-email" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a malformed refresh payload", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects duplicate email registration", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "amina@example.com", password: "correcthorsebattery", name: "Amina 2", role: "carrier" },
    });
    expect(res.statusCode).toBe(409);
  });

  it("rejects login with a wrong password", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "amina@example.com", password: "wrongpassword" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects /auth/me without a token", async () => {
    const res = await app.inject({ method: "GET", url: "/auth/me" });
    expect(res.statusCode).toBe(401);
  });

  it("exchanges a refresh token for a new access token", async () => {
    const loginRes = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "amina@example.com", password: "correcthorsebattery" },
    });
    const { refreshToken } = loginRes.json();

    const refreshRes = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken },
    });
    expect(refreshRes.statusCode).toBe(200);
    expect(refreshRes.json().accessToken).toBeDefined();
  });

  it("rejects an access token used where a refresh token is required", async () => {
    const loginRes = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "amina@example.com", password: "correcthorsebattery" },
    });
    const { accessToken } = loginRes.json();

    const refreshRes = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken: accessToken },
    });
    expect(refreshRes.statusCode).toBe(401);
  });

  it("rejects a garbage refresh token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken: "not-a-real-jwt" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects a refresh token used at /auth/me", async () => {
    const loginRes = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "amina@example.com", password: "correcthorsebattery" },
    });
    const { refreshToken } = loginRes.json();

    const res = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: `Bearer ${refreshToken}` },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects a validly signed access token for a user that no longer exists", async () => {
    const forgedToken = app.jwt.sign({ sub: "00000000-0000-0000-0000-000000000000", role: "shipper", type: "access" });
    const res = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: `Bearer ${forgedToken}` },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /internal/users/lookup", () => {
  it("rejects requests without a valid internal-service token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/internal/users/lookup?email=amina@example.com",
    });
    expect(res.statusCode).toBe(403);
  });

  it("rejects requests with the wrong internal-service token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/internal/users/lookup?email=amina@example.com",
      headers: { "x-internal-token": "wrong-token" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("finds a registered user by email with the correct internal token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/internal/users/lookup?email=amina@example.com",
      headers: { "x-internal-token": "test-internal-token" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().role).toBe("shipper");
  });

  it("returns 404 for an email that doesn't exist", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/internal/users/lookup?email=nobody@example.com",
      headers: { "x-internal-token": "test-internal-token" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 404 when the role filter doesn't match (doesn't leak that the email exists)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/internal/users/lookup?email=amina@example.com&role=receiver",
      headers: { "x-internal-token": "test-internal-token" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 when email is missing", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/internal/users/lookup",
      headers: { "x-internal-token": "test-internal-token" },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /internal/users/by-ids", () => {
  it("rejects requests without a valid internal-service token", async () => {
    const res = await app.inject({ method: "GET", url: "/internal/users/by-ids?ids=x" });
    expect(res.statusCode).toBe(403);
  });

  it("returns 400 when ids is missing", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/internal/users/by-ids",
      headers: { "x-internal-token": "test-internal-token" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("resolves multiple ids in one call", async () => {
    const registerRes = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "byids@example.com", password: "correcthorsebattery", name: "By Ids", role: "carrier" },
    });
    const userId = registerRes.json().id;

    const res = await app.inject({
      method: "GET",
      url: `/internal/users/by-ids?ids=${userId},00000000-0000-0000-0000-000000000000`,
      headers: { "x-internal-token": "test-internal-token" },
    });
    expect(res.statusCode).toBe(200);
    const users = res.json();
    expect(users).toHaveLength(1);
    expect(users[0]).toEqual({ id: userId, email: "byids@example.com", name: "By Ids", role: "carrier" });
  });

  it("returns an empty array when no ids match", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/internal/users/by-ids?ids=00000000-0000-0000-0000-000000000000",
      headers: { "x-internal-token": "test-internal-token" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });
});

describe("admin routes (FR-6)", () => {
  let adminId: string;
  let adminAccessToken: string;
  let targetUserId: string;

  beforeAll(async () => {
    // Public registration excludes "admin" by design — seed one directly, the
    // way a real deployment would (no self-service admin signup).
    const adminResult = await migrationPool.query<{ id: string }>(
      "INSERT INTO auth.users (email, password_hash, name, role) VALUES ($1, 'x', 'Admin', 'admin') RETURNING id",
      ["admin@example.com"],
    );
    adminId = adminResult.rows[0].id;
    adminAccessToken = app.jwt.sign({ sub: adminId, role: "admin", type: "access" });

    const targetRes = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "target@example.com", password: "correcthorsebattery", name: "Target", role: "receiver" },
    });
    targetUserId = targetRes.json().id;
  });

  describe("GET /auth/admin/users", () => {
    it("rejects requests without a token", async () => {
      const res = await app.inject({ method: "GET", url: "/auth/admin/users" });
      expect(res.statusCode).toBe(401);
    });

    it("rejects a non-admin token", async () => {
      const token = app.jwt.sign({ sub: targetUserId, role: "receiver", type: "access" });
      const res = await app.inject({ method: "GET", url: "/auth/admin/users", headers: { authorization: `Bearer ${token}` } });
      expect(res.statusCode).toBe(403);
    });

    it("lists all users for an admin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/auth/admin/users",
        headers: { authorization: `Bearer ${adminAccessToken}` },
      });
      expect(res.statusCode).toBe(200);
      const users = res.json();
      expect(users.some((u: { id: string }) => u.id === targetUserId)).toBe(true);
      const target = users.find((u: { id: string }) => u.id === targetUserId);
      expect(target.isActive).toBe(true);
      expect(target.email).toBe("target@example.com");
    });
  });

  describe("PATCH /auth/admin/users/:id/deactivate", () => {
    it("rejects requests without a token", async () => {
      const res = await app.inject({ method: "PATCH", url: `/auth/admin/users/${targetUserId}/deactivate` });
      expect(res.statusCode).toBe(401);
    });

    it("rejects a non-admin token", async () => {
      const token = app.jwt.sign({ sub: targetUserId, role: "receiver", type: "access" });
      const res = await app.inject({
        method: "PATCH",
        url: `/auth/admin/users/${targetUserId}/deactivate`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it("rejects a malformed user id", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/auth/admin/users/not-a-uuid/deactivate",
        headers: { authorization: `Bearer ${adminAccessToken}` },
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects an admin deactivating their own account", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/auth/admin/users/${adminId}/deactivate`,
        headers: { authorization: `Bearer ${adminAccessToken}` },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 404 for a well-formed but non-existent user id", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/auth/admin/users/00000000-0000-0000-0000-000000000000/deactivate",
        headers: { authorization: `Bearer ${adminAccessToken}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it("deactivates a user, who can then no longer log in or refresh", async () => {
      const loginRes = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: "target@example.com", password: "correcthorsebattery" },
      });
      expect(loginRes.statusCode).toBe(200);
      const { refreshToken } = loginRes.json();

      const deactivateRes = await app.inject({
        method: "PATCH",
        url: `/auth/admin/users/${targetUserId}/deactivate`,
        headers: { authorization: `Bearer ${adminAccessToken}` },
      });
      expect(deactivateRes.statusCode).toBe(200);
      expect(deactivateRes.json().isActive).toBe(false);

      const loginAfterRes = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: "target@example.com", password: "correcthorsebattery" },
      });
      expect(loginAfterRes.statusCode).toBe(401);

      // The refresh token was issued before deactivation and is still
      // cryptographically valid — this is exactly the gap the is_active
      // check in /auth/refresh closes.
      const refreshRes = await app.inject({ method: "POST", url: "/auth/refresh", payload: { refreshToken } });
      expect(refreshRes.statusCode).toBe(401);
    });
  });
});
