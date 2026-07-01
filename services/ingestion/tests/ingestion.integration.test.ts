import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import { Pool, Client } from "pg";
import fs from "node:fs";
import path from "node:path";
import Fastify, { type FastifyInstance } from "fastify";

vi.mock("../src/device-validator.js", () => ({ validateDevice: vi.fn() }));
import { validateDevice } from "../src/device-validator.js";
import { handleReading } from "../src/ingest.js";
import { dbPlugin } from "../src/db.js";
import { ingestionRoutes } from "../src/routes.js";

const INTERNAL_TOKEN = "test-internal-token";
const DEVICE_ID = "11111111-1111-1111-1111-111111111111";
const SHIPMENT_ID = "22222222-2222-2222-2222-222222222222";

const DEVICE_INFO = {
  deviceId: DEVICE_ID,
  shipmentId: SHIPMENT_ID,
  tempMinC: 2,
  tempMaxC: 8,
  humidityMinPct: null,
  humidityMaxPct: null,
};

let container: StartedTestContainer;
let pool: Pool;
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
  process.env.INTERNAL_SERVICE_TOKEN = INTERNAL_TOKEN;

  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const migrationSql = fs.readFileSync(path.join(__dirname, "../../../db/migrations/003_ingestion_schema.sql"), "utf8");
  await pool.query(migrationSql);

  app = Fastify();
  await app.register(dbPlugin);
  await app.register(ingestionRoutes);
  await app.ready();
}, 60_000);

afterAll(async () => {
  await pool.end();
  await app.close();
  await container.stop();
});

describe("handleReading", () => {
  it("rejects an invalid payload without touching the database", async () => {
    const result = await handleReading(pool, { temperatureC: "not-a-number" });
    expect(result).toEqual({ ok: false, reason: "invalid_payload" });
  });

  it("rejects a reading from an unknown device", async () => {
    vi.mocked(validateDevice).mockResolvedValueOnce(null);
    const result = await handleReading(pool, { deviceToken: "bogus", temperatureC: 4.2 });
    expect(result).toEqual({ ok: false, reason: "unknown_device" });
  });

  it("inserts a valid reading and fires a NOTIFY with value + thresholds", async () => {
    vi.mocked(validateDevice).mockResolvedValueOnce(DEVICE_INFO);

    const listener = new Client({ connectionString: process.env.DATABASE_URL });
    await listener.connect();
    await listener.query("LISTEN reading_ingested");
    const notification = new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("no notification received")), 5000);
      listener.once("notification", (msg) => {
        clearTimeout(timer);
        resolve(JSON.parse(msg.payload!));
      });
    });

    const now = new Date();
    const result = await handleReading(pool, { deviceToken: "valid-token", temperatureC: 4.5, humidityPct: 60 }, now);
    expect(result).toEqual({ ok: true });

    const payload = await notification;
    expect(payload.deviceId).toBe(DEVICE_ID);
    expect(payload.shipmentId).toBe(SHIPMENT_ID);
    expect(payload.temperatureC).toBe(4.5);
    expect(payload.tempMinC).toBe(2);
    expect(payload.tempMaxC).toBe(8);
    await listener.end();

    const rows = await pool.query("SELECT * FROM ingestion.sensor_readings WHERE device_id = $1", [DEVICE_ID]);
    expect(rows.rows.length).toBeGreaterThan(0);
  });

  it("treats a replayed reading (same device + exact timestamp) as a no-op duplicate", async () => {
    const now = new Date();
    vi.mocked(validateDevice).mockResolvedValueOnce(DEVICE_INFO);
    const first = await handleReading(pool, { deviceToken: "valid-token", temperatureC: 5.0 }, now);
    expect(first.ok).toBe(true);

    vi.mocked(validateDevice).mockResolvedValueOnce(DEVICE_INFO);
    const second = await handleReading(pool, { deviceToken: "valid-token", temperatureC: 5.0 }, now);
    expect(second).toEqual({ ok: false, reason: "duplicate_reading" });
  });
});

describe("GET /internal/devices/:id/readings", () => {
  it("rejects requests without the internal-service token", async () => {
    const res = await app.inject({ method: "GET", url: `/internal/devices/${DEVICE_ID}/readings` });
    expect(res.statusCode).toBe(403);
  });

  it("returns readings for a device in chronological order", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/internal/devices/${DEVICE_ID}/readings`,
      headers: { "x-internal-token": INTERNAL_TOKEN },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.length).toBeGreaterThan(0);
    expect(typeof body[0].temperatureC).toBe("number");
    const times = body.map((r: { time: string }) => new Date(r.time).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("returns an empty array for a device with no readings", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/internal/devices/99999999-9999-9999-9999-999999999999/readings",
      headers: { "x-internal-token": INTERNAL_TOKEN },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("rejects a malformed device id", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/internal/devices/not-a-uuid/readings",
      headers: { "x-internal-token": INTERNAL_TOKEN },
    });
    expect(res.statusCode).toBe(400);
  });
});
