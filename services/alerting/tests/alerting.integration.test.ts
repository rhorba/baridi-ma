import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import crypto from "node:crypto";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import { Pool } from "pg";
import fs from "node:fs";
import path from "node:path";
import Fastify, { type FastifyInstance } from "fastify";

vi.mock("../src/mailer.js", () => ({ sendAlertEmail: vi.fn().mockResolvedValue(undefined) }));
import { sendAlertEmail } from "../src/mailer.js";
import { evaluateReading } from "../src/evaluate.js";
import { startListener } from "../src/listener.js";
import { dbPlugin } from "../src/db.js";
import { alertRoutes } from "../src/routes.js";

const INTERNAL_TOKEN = "test-internal-token";
const DEVICE_ID = "11111111-1111-1111-1111-111111111111";

let container: StartedTestContainer;
let pool: Pool;
let app: FastifyInstance;

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    deviceId: DEVICE_ID,
    shipmentId: crypto.randomUUID(),
    time: new Date().toISOString(),
    tempMinC: 2,
    tempMaxC: 8,
    humidityMinPct: 40,
    humidityMaxPct: 70,
    temperatureC: 4,
    humidityPct: 55,
    ...overrides,
  };
}

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
  const migrationSql = fs.readFileSync(path.join(__dirname, "../../../db/migrations/004_alerting_schema.sql"), "utf8");
  await pool.query(migrationSql);

  app = Fastify();
  await app.register(dbPlugin);
  await app.register(alertRoutes);
  await app.ready();
}, 60_000);

afterAll(async () => {
  await pool.end();
  await app.close();
  await container.stop();
});

describe("evaluateReading", () => {
  it("rejects an invalid payload", async () => {
    const result = await evaluateReading(pool, { temperatureC: "not-a-number" });
    expect(result).toEqual({ alerted: false, reason: "invalid_payload" });
  });

  it("does not alert when the reading is within thresholds", async () => {
    const result = await evaluateReading(pool, makePayload({ temperatureC: 4, humidityPct: 55 }));
    expect(result).toEqual({ alerted: false, reason: "within_thresholds" });
  });

  it("alerts on a temperature-high breach and sends an email", async () => {
    vi.mocked(sendAlertEmail).mockClear();
    const result = await evaluateReading(pool, makePayload({ temperatureC: 10 }));
    expect(result.alerted).toBe(true);
    expect(result.alertReason).toBe("temp_high");
    expect(sendAlertEmail).toHaveBeenCalledWith(expect.any(String), "temp_high", 10, 8);
  });

  it("alerts on a temperature-low breach", async () => {
    const result = await evaluateReading(pool, makePayload({ temperatureC: -1 }));
    expect(result.alertReason).toBe("temp_low");
  });

  it("alerts on a humidity-high breach", async () => {
    const result = await evaluateReading(pool, makePayload({ humidityPct: 90 }));
    expect(result.alertReason).toBe("humidity_high");
  });

  it("alerts on a humidity-low breach", async () => {
    const result = await evaluateReading(pool, makePayload({ humidityPct: 10 }));
    expect(result.alertReason).toBe("humidity_low");
  });

  it("does not evaluate humidity when humidityPct is null", async () => {
    const result = await evaluateReading(pool, makePayload({ humidityPct: null, temperatureC: 4 }));
    expect(result).toEqual({ alerted: false, reason: "within_thresholds" });
  });

  it("debounces a repeated breach for the same shipment+reason within the window", async () => {
    const shipmentId = crypto.randomUUID();
    vi.mocked(sendAlertEmail).mockClear();

    const first = await evaluateReading(pool, makePayload({ shipmentId, temperatureC: 10 }));
    expect(first.alerted).toBe(true);

    const second = await evaluateReading(pool, makePayload({ shipmentId, temperatureC: 11 }));
    expect(second).toEqual({ alerted: false, reason: "debounced", alertReason: "temp_high" });
    expect(sendAlertEmail).toHaveBeenCalledTimes(1);

    const rows = await pool.query("SELECT * FROM alerting.alerts WHERE shipment_id = $1", [shipmentId]);
    expect(rows.rows.length).toBe(1);
  });
});

describe("startListener (real LISTEN/NOTIFY)", () => {
  it("creates an alert when a breaching reading is published via pg_notify", async () => {
    const shipmentId = crypto.randomUUID();
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as import("fastify").FastifyBaseLogger;
    const listenerClient = await startListener(pool, logger);

    const payload = JSON.stringify(makePayload({ shipmentId, temperatureC: 12 }));
    await pool.query("SELECT pg_notify('reading_ingested', $1)", [payload]);

    await vi.waitFor(async () => {
      const rows = await pool.query("SELECT * FROM alerting.alerts WHERE shipment_id = $1", [shipmentId]);
      expect(rows.rows.length).toBe(1);
    }, { timeout: 5000 });

    await listenerClient.end();
  });

  it("discards a malformed NOTIFY payload without crashing the listener", async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as import("fastify").FastifyBaseLogger;
    const listenerClient = await startListener(pool, logger);

    await pool.query("SELECT pg_notify('reading_ingested', 'not json')");
    await vi.waitFor(() => expect(logger.warn).toHaveBeenCalled(), { timeout: 5000 });

    // Listener survives the bad message and still processes a good one after.
    const shipmentId = crypto.randomUUID();
    const payload = JSON.stringify(makePayload({ shipmentId, temperatureC: 12 }));
    await pool.query("SELECT pg_notify('reading_ingested', $1)", [payload]);
    await vi.waitFor(async () => {
      const rows = await pool.query("SELECT * FROM alerting.alerts WHERE shipment_id = $1", [shipmentId]);
      expect(rows.rows.length).toBe(1);
    }, { timeout: 5000 });

    await listenerClient.end();
  });

  it("logs client-level errors without crashing", async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as import("fastify").FastifyBaseLogger;
    const listenerClient = await startListener(pool, logger);

    listenerClient.emit("error", new Error("connection reset"));
    expect(logger.error).toHaveBeenCalledWith({ err: expect.any(Error) }, "LISTEN client error");

    await listenerClient.end();
  });
});

describe("GET /internal/alerts", () => {
  it("rejects requests without the internal-service token", async () => {
    const res = await app.inject({ method: "GET", url: "/internal/alerts?shipmentId=11111111-1111-1111-1111-111111111111" });
    expect(res.statusCode).toBe(403);
  });

  it("rejects a malformed shipmentId", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/internal/alerts?shipmentId=not-a-uuid",
      headers: { "x-internal-token": INTERNAL_TOKEN },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns alerts scoped to the given shipment", async () => {
    const shipmentId = crypto.randomUUID();
    await evaluateReading(pool, makePayload({ shipmentId, temperatureC: 10 }));

    const res = await app.inject({
      method: "GET",
      url: `/internal/alerts?shipmentId=${shipmentId}`,
      headers: { "x-internal-token": INTERNAL_TOKEN },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.length).toBe(1);
    expect(body[0].shipmentId).toBe(shipmentId);
    expect(body[0].reason).toBe("temp_high");
  });

  it("returns an empty array for a shipment with no alerts", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/internal/alerts?shipmentId=${crypto.randomUUID()}`,
      headers: { "x-internal-token": INTERNAL_TOKEN },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });
});
