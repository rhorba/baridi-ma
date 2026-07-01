import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import { Pool } from "pg";
import fs from "node:fs";
import path from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyJwt from "@fastify/jwt";
import { dbPlugin } from "../src/db.js";
import { authRoutes } from "../src/routes.js";

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
