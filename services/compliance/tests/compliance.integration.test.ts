import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import { Pool } from "pg";
import fs from "node:fs";
import path from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyJwt from "@fastify/jwt";

vi.mock("../src/shipment-client.js", () => ({ fetchShipment: vi.fn() }));
vi.mock("../src/ingestion-client.js", () => ({ fetchDeviceReadings: vi.fn() }));
// In-memory fake S3 — keeps the idempotency/race tests behaviorally real
// (write-then-read-back across two requests) without a real S3/MinIO
// dependency in the fast test suite, same principle as the HTTP client mocks above.
vi.mock("../src/storage.js", () => {
  const store = new Map<string, Uint8Array>();
  return {
    saveExportFile: vi.fn(async (shipmentId: string, bytes: Uint8Array) => {
      const key = `${shipmentId}.pdf`;
      store.set(key, bytes);
      return key;
    }),
    readExportFile: vi.fn(async (key: string) => Buffer.from(store.get(key)!)),
  };
});
import { fetchShipment } from "../src/shipment-client.js";
import { fetchDeviceReadings } from "../src/ingestion-client.js";
import { saveExportFile, readExportFile } from "../src/storage.js";
import { dbPlugin } from "../src/db.js";
import { complianceRoutes } from "../src/routes.js";

const INTERNAL_TOKEN = "test-internal-token";
const RECEIVER_ID = "33333333-3333-3333-3333-333333333333";
const OTHER_RECEIVER_ID = "77777777-7777-7777-7777-777777777777";
const ADMIN_ID = "44444444-4444-4444-4444-444444444444";
const SHIPPER_ID = "11111111-1111-1111-1111-111111111111";
const SHIPMENT_ID = "88888888-8888-8888-8888-888888888888";
const OTHER_SHIPMENT_ID = "99999999-9999-9999-9999-999999999999";

let container: StartedTestContainer;
let migrationPool: Pool;
let app: FastifyInstance;

function authHeaders(token: string) {
  return { authorization: `Bearer ${token}`, "x-internal-token": INTERNAL_TOKEN };
}

function baseShipment(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: SHIPMENT_ID,
    shipperId: SHIPPER_ID,
    carrierId: "carrier-1",
    receiverId: RECEIVER_ID,
    assignedDeviceId: "device-1",
    productType: "Dairy",
    origin: "Casablanca",
    destination: "Rotterdam",
    tempMinC: 2,
    tempMaxC: 8,
    humidityMinPct: null,
    humidityMaxPct: null,
    status: "delivered",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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
  process.env.JWT_SECRET = "test-secret";
  process.env.INTERNAL_SERVICE_TOKEN = INTERNAL_TOKEN;

  migrationPool = new Pool({ connectionString: process.env.DATABASE_URL });
  for (const file of ["005_compliance_schema.sql", "006_compliance_storage_key.sql"]) {
    const migrationSql = fs.readFileSync(path.join(__dirname, "../../../db/migrations", file), "utf8");
    await migrationPool.query(migrationSql);
  }

  app = Fastify();
  await app.register(fastifyJwt, { secret: process.env.JWT_SECRET });
  await app.register(dbPlugin);
  await app.register(complianceRoutes);
  await app.ready();
}, 60_000);

afterAll(async () => {
  await migrationPool.end();
  await app.close();
  await container.stop();
});

beforeEach(() => {
  vi.mocked(fetchShipment).mockReset();
  vi.mocked(fetchDeviceReadings).mockReset();
  // .mockClear() (not .mockReset()) — the fake-S3 implementation from the
  // vi.mock factory above must survive between tests, only call history resets.
  vi.mocked(saveExportFile).mockClear();
  vi.mocked(readExportFile).mockClear();
});

describe("internal-token guard", () => {
  it("rejects requests without x-internal-token", async () => {
    const token = app.jwt.sign({ sub: RECEIVER_ID, role: "receiver", type: "access" });
    const res = await app.inject({
      method: "POST",
      url: `/compliance/${SHIPMENT_ID}/export`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("auth guard", () => {
  it("rejects requests without a JWT", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/compliance/${SHIPMENT_ID}/export`,
      headers: { "x-internal-token": INTERNAL_TOKEN },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects a refresh token used against the export route", async () => {
    const token = app.jwt.sign({ sub: RECEIVER_ID, role: "receiver", type: "refresh" });
    const res = await app.inject({
      method: "POST",
      url: `/compliance/${SHIPMENT_ID}/export`,
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("POST /compliance/:shipmentId/export", () => {
  it("rejects a role that isn't receiver or admin", async () => {
    const token = app.jwt.sign({ sub: SHIPPER_ID, role: "shipper", type: "access" });
    const res = await app.inject({
      method: "POST",
      url: `/compliance/${SHIPMENT_ID}/export`,
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(403);
    expect(fetchShipment).not.toHaveBeenCalled();
  });

  it("rejects a malformed shipment id", async () => {
    const token = app.jwt.sign({ sub: RECEIVER_ID, role: "receiver", type: "access" });
    const res = await app.inject({
      method: "POST",
      url: "/compliance/not-a-uuid/export",
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 when the shipment doesn't exist", async () => {
    vi.mocked(fetchShipment).mockResolvedValueOnce(null);
    const token = app.jwt.sign({ sub: RECEIVER_ID, role: "receiver", type: "access" });
    const res = await app.inject({
      method: "POST",
      url: `/compliance/${SHIPMENT_ID}/export`,
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 404 (not 403) for a receiver who doesn't own the shipment", async () => {
    vi.mocked(fetchShipment).mockResolvedValueOnce(baseShipment() as never);
    const token = app.jwt.sign({ sub: OTHER_RECEIVER_ID, role: "receiver", type: "access" });
    const res = await app.inject({
      method: "POST",
      url: `/compliance/${SHIPMENT_ID}/export`,
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 when the shipment isn't delivered yet", async () => {
    vi.mocked(fetchShipment).mockResolvedValueOnce(baseShipment({ status: "in_transit" }) as never);
    const token = app.jwt.sign({ sub: RECEIVER_ID, role: "receiver", type: "access" });
    const res = await app.inject({
      method: "POST",
      url: `/compliance/${SHIPMENT_ID}/export`,
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(400);
  });

  it("lets the owning receiver generate a PDF export on first call (201)", async () => {
    vi.mocked(fetchShipment).mockResolvedValueOnce(baseShipment() as never);
    vi.mocked(fetchDeviceReadings).mockResolvedValueOnce([{ time: "t1", temperatureC: 4, humidityPct: 55 }]);
    const token = app.jwt.sign({ sub: RECEIVER_ID, role: "receiver", type: "access" });

    const res = await app.inject({
      method: "POST",
      url: `/compliance/${SHIPMENT_ID}/export`,
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(201);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["x-reading-hash"]).toBeTruthy();
    expect(Buffer.from(res.rawPayload).subarray(0, 5).toString("ascii")).toBe("%PDF-");

    const row = await migrationPool.query("SELECT * FROM compliance.exports WHERE shipment_id = $1", [SHIPMENT_ID]);
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].generated_by).toBe(RECEIVER_ID);
  });

  it("is idempotent — a second call returns the same stored file without re-fetching readings (200)", async () => {
    vi.mocked(fetchShipment).mockResolvedValue(baseShipment() as never);
    const token = app.jwt.sign({ sub: RECEIVER_ID, role: "receiver", type: "access" });

    const res = await app.inject({
      method: "POST",
      url: `/compliance/${SHIPMENT_ID}/export`,
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(200);
    expect(fetchDeviceReadings).not.toHaveBeenCalled();

    const first = await migrationPool.query("SELECT * FROM compliance.exports WHERE shipment_id = $1", [SHIPMENT_ID]);
    expect(first.rows).toHaveLength(1);
    expect(res.headers["x-reading-hash"]).toBe(first.rows[0].reading_hash);
  });

  it("lets an admin export a shipment they don't own", async () => {
    vi.mocked(fetchShipment).mockResolvedValueOnce(baseShipment({ id: OTHER_SHIPMENT_ID }) as never);
    vi.mocked(fetchDeviceReadings).mockResolvedValueOnce([]);
    const token = app.jwt.sign({ sub: ADMIN_ID, role: "admin", type: "access" });

    const res = await app.inject({
      method: "POST",
      url: `/compliance/${OTHER_SHIPMENT_ID}/export`,
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(201);
  });

  it("handles concurrent export requests for the same shipment without erroring (unique-constraint race)", async () => {
    const raceShipmentId = "55555555-5555-5555-5555-555555555555";
    vi.mocked(fetchShipment).mockResolvedValue(baseShipment({ id: raceShipmentId }) as never);
    vi.mocked(fetchDeviceReadings).mockResolvedValue([{ time: "t1", temperatureC: 4, humidityPct: 55 }]);
    const token = app.jwt.sign({ sub: RECEIVER_ID, role: "receiver", type: "access" });

    const [a, b] = await Promise.all([
      app.inject({ method: "POST", url: `/compliance/${raceShipmentId}/export`, headers: authHeaders(token) }),
      app.inject({ method: "POST", url: `/compliance/${raceShipmentId}/export`, headers: authHeaders(token) }),
    ]);

    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 201]);
    expect(a.headers["x-reading-hash"]).toBe(b.headers["x-reading-hash"]);

    const rows = await migrationPool.query("SELECT * FROM compliance.exports WHERE shipment_id = $1", [raceShipmentId]);
    expect(rows.rows).toHaveLength(1);
  });

  it("handles a shipment with no assigned device (empty reading set)", async () => {
    const noDeviceShipmentId = "66666666-6666-6666-6666-666666666666";
    vi.mocked(fetchShipment).mockResolvedValueOnce(
      baseShipment({ id: noDeviceShipmentId, assignedDeviceId: null }) as never,
    );
    const token = app.jwt.sign({ sub: RECEIVER_ID, role: "receiver", type: "access" });

    const res = await app.inject({
      method: "POST",
      url: `/compliance/${noDeviceShipmentId}/export`,
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(201);
    expect(fetchDeviceReadings).not.toHaveBeenCalled();
  });
});
