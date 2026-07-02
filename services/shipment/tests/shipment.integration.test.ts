import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import { Pool } from "pg";
import fs from "node:fs";
import path from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyJwt from "@fastify/jwt";

vi.mock("../src/internal-client.js", () => ({ lookupUserByEmail: vi.fn() }));
vi.mock("../src/telemetry-client.js", () => ({ fetchDeviceReadings: vi.fn(), fetchShipmentAlerts: vi.fn() }));
import { lookupUserByEmail } from "../src/internal-client.js";
import { fetchDeviceReadings, fetchShipmentAlerts } from "../src/telemetry-client.js";
import { dbPlugin } from "../src/db.js";
import { shipmentRoutes } from "../src/routes.js";

const INTERNAL_TOKEN = "test-internal-token";
const SHIPPER_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_SHIPPER_ID = "22222222-2222-2222-2222-222222222222";
const RECEIVER_ID = "33333333-3333-3333-3333-333333333333";
const ADMIN_ID = "44444444-4444-4444-4444-444444444444";
const CARRIER_ID = "55555555-5555-5555-5555-555555555555";
const OTHER_CARRIER_ID = "66666666-6666-6666-6666-666666666666";

let container: StartedTestContainer;
let migrationPool: Pool;
let app: FastifyInstance;

function authHeaders(token: string) {
  return { authorization: `Bearer ${token}`, "x-internal-token": INTERNAL_TOKEN };
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
  const migrationSql = fs.readFileSync(
    path.join(__dirname, "../../../db/migrations/002_shipment_schema.sql"),
    "utf8",
  );
  await migrationPool.query(migrationSql);

  app = Fastify();
  await app.register(fastifyJwt, { secret: process.env.JWT_SECRET });
  await app.register(dbPlugin);
  await app.register(shipmentRoutes);
  await app.ready();
}, 60_000);

afterAll(async () => {
  await migrationPool.end();
  await app.close();
  await container.stop();
});

describe("internal-token guard", () => {
  it("rejects requests without x-internal-token", async () => {
    const token = app.jwt.sign({ sub: SHIPPER_ID, role: "shipper", type: "access" });
    const res = await app.inject({
      method: "GET",
      url: "/shipments",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("auth guard", () => {
  it("rejects requests without a JWT", async () => {
    const res = await app.inject({ method: "GET", url: "/shipments", headers: { "x-internal-token": INTERNAL_TOKEN } });
    expect(res.statusCode).toBe(401);
  });
});

describe("POST /shipments", () => {
  it("lets a shipper create a shipment when the receiver email resolves", async () => {
    vi.mocked(lookupUserByEmail).mockResolvedValueOnce({
      id: RECEIVER_ID,
      email: "receiver@example.com",
      name: "Receiver",
      role: "receiver",
    });
    const token = app.jwt.sign({ sub: SHIPPER_ID, role: "shipper", type: "access" });

    const res = await app.inject({
      method: "POST",
      url: "/shipments",
      headers: authHeaders(token),
      payload: {
        productType: "Dairy",
        origin: "Casablanca",
        destination: "Rotterdam",
        receiverEmail: "receiver@example.com",
        tempMinC: 2,
        tempMaxC: 8,
        humidityMinPct: 40,
        humidityMaxPct: 70,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.shipperId).toBe(SHIPPER_ID);
    expect(body.humidityMinPct).toBe(40);
    expect(body.humidityMaxPct).toBe(70);
    expect(body.receiverId).toBe(RECEIVER_ID);
    expect(body.status).toBe("created");
    // Device is auto-provisioned atomically with the shipment (Sprint 3).
    expect(body.assignedDeviceId).toBeTruthy();
    expect(typeof body.deviceToken).toBe("string");
    expect(body.deviceToken.length).toBeGreaterThan(20);
  });

  it("rejects creation when the receiver email doesn't resolve", async () => {
    vi.mocked(lookupUserByEmail).mockResolvedValueOnce(null);
    const token = app.jwt.sign({ sub: SHIPPER_ID, role: "shipper", type: "access" });

    const res = await app.inject({
      method: "POST",
      url: "/shipments",
      headers: authHeaders(token),
      payload: {
        productType: "Dairy",
        origin: "Casablanca",
        destination: "Rotterdam",
        receiverEmail: "nobody@example.com",
        tempMinC: 2,
        tempMaxC: 8,
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects non-shippers from creating a shipment", async () => {
    const token = app.jwt.sign({ sub: OTHER_SHIPPER_ID, role: "carrier", type: "access" });
    const res = await app.inject({
      method: "POST",
      url: "/shipments",
      headers: authHeaders(token),
      payload: {
        productType: "Dairy",
        origin: "Casablanca",
        destination: "Rotterdam",
        receiverEmail: "receiver@example.com",
        tempMinC: 2,
        tempMaxC: 8,
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it("rejects a malformed payload", async () => {
    const token = app.jwt.sign({ sub: SHIPPER_ID, role: "shipper", type: "access" });
    const res = await app.inject({
      method: "POST",
      url: "/shipments",
      headers: authHeaders(token),
      payload: { productType: "Dairy" },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /shipments and /shipments/:id (ownership scoping)", () => {
  let shipmentId: string;

  it("creates a shipment owned by SHIPPER_ID for scoping tests", async () => {
    vi.mocked(lookupUserByEmail).mockResolvedValueOnce({
      id: RECEIVER_ID,
      email: "receiver@example.com",
      name: "Receiver",
      role: "receiver",
    });
    const token = app.jwt.sign({ sub: SHIPPER_ID, role: "shipper", type: "access" });
    const res = await app.inject({
      method: "POST",
      url: "/shipments",
      headers: authHeaders(token),
      payload: {
        productType: "Pharma",
        origin: "Rabat",
        destination: "Paris",
        receiverEmail: "receiver@example.com",
        tempMinC: 2,
        tempMaxC: 8,
      },
    });
    shipmentId = res.json().id;
    expect(res.statusCode).toBe(201);
  });

  it("lets the owning shipper list their shipment", async () => {
    const token = app.jwt.sign({ sub: SHIPPER_ID, role: "shipper", type: "access" });
    const res = await app.inject({ method: "GET", url: "/shipments", headers: authHeaders(token) });
    expect(res.statusCode).toBe(200);
    expect(res.json().some((s: { id: string }) => s.id === shipmentId)).toBe(true);
  });

  it("does not show the shipment to a different shipper", async () => {
    const token = app.jwt.sign({ sub: OTHER_SHIPPER_ID, role: "shipper", type: "access" });
    const res = await app.inject({ method: "GET", url: "/shipments", headers: authHeaders(token) });
    expect(res.statusCode).toBe(200);
    expect(res.json().some((s: { id: string }) => s.id === shipmentId)).toBe(false);
  });

  it("lets the owning shipper fetch the shipment by id", async () => {
    const token = app.jwt.sign({ sub: SHIPPER_ID, role: "shipper", type: "access" });
    const res = await app.inject({ method: "GET", url: `/shipments/${shipmentId}`, headers: authHeaders(token) });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(shipmentId);
  });

  it("lets the assigned receiver fetch the shipment by id", async () => {
    const token = app.jwt.sign({ sub: RECEIVER_ID, role: "receiver", type: "access" });
    const res = await app.inject({ method: "GET", url: `/shipments/${shipmentId}`, headers: authHeaders(token) });
    expect(res.statusCode).toBe(200);
  });

  it("returns 404 (not 403) for a non-owning user — avoids leaking existence", async () => {
    const token = app.jwt.sign({ sub: OTHER_SHIPPER_ID, role: "shipper", type: "access" });
    const res = await app.inject({ method: "GET", url: `/shipments/${shipmentId}`, headers: authHeaders(token) });
    expect(res.statusCode).toBe(404);
  });

  it("lets an admin fetch any shipment", async () => {
    const token = app.jwt.sign({ sub: ADMIN_ID, role: "admin", type: "access" });
    const res = await app.inject({ method: "GET", url: `/shipments/${shipmentId}`, headers: authHeaders(token) });
    expect(res.statusCode).toBe(200);
  });

  it("returns 404 for a well-formed but non-existent id", async () => {
    const token = app.jwt.sign({ sub: SHIPPER_ID, role: "shipper", type: "access" });
    const res = await app.inject({
      method: "GET",
      url: "/shipments/00000000-0000-0000-0000-000000000000",
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 for a malformed id", async () => {
    const token = app.jwt.sign({ sub: SHIPPER_ID, role: "shipper", type: "access" });
    const res = await app.inject({ method: "GET", url: "/shipments/not-a-uuid", headers: authHeaders(token) });
    expect(res.statusCode).toBe(400);
  });

  it("lets an admin list all shipments, including ones they don't own", async () => {
    const token = app.jwt.sign({ sub: ADMIN_ID, role: "admin", type: "access" });
    const res = await app.inject({ method: "GET", url: "/shipments", headers: authHeaders(token) });
    expect(res.statusCode).toBe(200);
    expect(res.json().some((s: { id: string }) => s.id === shipmentId)).toBe(true);
  });
});

describe("token type enforcement", () => {
  it("rejects a refresh token used against a protected route", async () => {
    const refreshToken = app.jwt.sign({ sub: SHIPPER_ID, role: "shipper", type: "refresh" });
    const res = await app.inject({ method: "GET", url: "/shipments", headers: authHeaders(refreshToken) });
    expect(res.statusCode).toBe(401);
  });
});

describe("PATCH /shipments/:id/assign-carrier", () => {
  async function createShipment() {
    vi.mocked(lookupUserByEmail).mockResolvedValueOnce({
      id: RECEIVER_ID,
      email: "receiver@example.com",
      name: "Receiver",
      role: "receiver",
    });
    const token = app.jwt.sign({ sub: SHIPPER_ID, role: "shipper", type: "access" });
    const res = await app.inject({
      method: "POST",
      url: "/shipments",
      headers: authHeaders(token),
      payload: {
        productType: "Dairy",
        origin: "Casablanca",
        destination: "Rotterdam",
        receiverEmail: "receiver@example.com",
        tempMinC: 2,
        tempMaxC: 8,
      },
    });
    return res.json().id as string;
  }

  it("lets the owning shipper assign a carrier", async () => {
    const id = await createShipment();
    vi.mocked(lookupUserByEmail).mockResolvedValueOnce({
      id: CARRIER_ID,
      email: "carrier@example.com",
      name: "Carrier",
      role: "carrier",
    });
    const token = app.jwt.sign({ sub: SHIPPER_ID, role: "shipper", type: "access" });

    const res = await app.inject({
      method: "PATCH",
      url: `/shipments/${id}/assign-carrier`,
      headers: authHeaders(token),
      payload: { carrierEmail: "carrier@example.com" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().carrierId).toBe(CARRIER_ID);

    const audit = await migrationPool.query("SELECT action, details FROM shipment.audit_log WHERE shipment_id = $1", [id]);
    expect(audit.rows.some((r) => r.action === "carrier_assigned")).toBe(true);
  });

  it("rejects a non-owning shipper (404, not 403 — avoids leaking existence)", async () => {
    const id = await createShipment();
    const token = app.jwt.sign({ sub: OTHER_SHIPPER_ID, role: "shipper", type: "access" });
    const res = await app.inject({
      method: "PATCH",
      url: `/shipments/${id}/assign-carrier`,
      headers: authHeaders(token),
      payload: { carrierEmail: "carrier@example.com" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("rejects a role that isn't shipper or admin", async () => {
    const id = await createShipment();
    const token = app.jwt.sign({ sub: RECEIVER_ID, role: "receiver", type: "access" });
    const res = await app.inject({
      method: "PATCH",
      url: `/shipments/${id}/assign-carrier`,
      headers: authHeaders(token),
      payload: { carrierEmail: "carrier@example.com" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("rejects when the carrier email doesn't resolve", async () => {
    const id = await createShipment();
    vi.mocked(lookupUserByEmail).mockResolvedValueOnce(null);
    const token = app.jwt.sign({ sub: SHIPPER_ID, role: "shipper", type: "access" });
    const res = await app.inject({
      method: "PATCH",
      url: `/shipments/${id}/assign-carrier`,
      headers: authHeaders(token),
      payload: { carrierEmail: "nobody@example.com" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a malformed body", async () => {
    const id = await createShipment();
    const token = app.jwt.sign({ sub: SHIPPER_ID, role: "shipper", type: "access" });
    const res = await app.inject({
      method: "PATCH",
      url: `/shipments/${id}/assign-carrier`,
      headers: authHeaders(token),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a malformed shipment id", async () => {
    const token = app.jwt.sign({ sub: SHIPPER_ID, role: "shipper", type: "access" });
    const res = await app.inject({
      method: "PATCH",
      url: "/shipments/not-a-uuid/assign-carrier",
      headers: authHeaders(token),
      payload: { carrierEmail: "carrier@example.com" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("lets an admin assign a carrier to a shipment they don't own", async () => {
    const id = await createShipment();
    vi.mocked(lookupUserByEmail).mockResolvedValueOnce({
      id: CARRIER_ID,
      email: "carrier@example.com",
      name: "Carrier",
      role: "carrier",
    });
    const token = app.jwt.sign({ sub: ADMIN_ID, role: "admin", type: "access" });
    const res = await app.inject({
      method: "PATCH",
      url: `/shipments/${id}/assign-carrier`,
      headers: authHeaders(token),
      payload: { carrierEmail: "carrier@example.com" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("rejects reassignment once the shipment is no longer in 'created' status", async () => {
    const id = await createShipment();
    vi.mocked(lookupUserByEmail).mockResolvedValueOnce({
      id: CARRIER_ID,
      email: "carrier@example.com",
      name: "Carrier",
      role: "carrier",
    });
    const shipperToken = app.jwt.sign({ sub: SHIPPER_ID, role: "shipper", type: "access" });
    await app.inject({
      method: "PATCH",
      url: `/shipments/${id}/assign-carrier`,
      headers: authHeaders(shipperToken),
      payload: { carrierEmail: "carrier@example.com" },
    });
    const carrierToken = app.jwt.sign({ sub: CARRIER_ID, role: "carrier", type: "access" });
    await app.inject({
      method: "PATCH",
      url: `/shipments/${id}/status`,
      headers: authHeaders(carrierToken),
      payload: { status: "in_transit" },
    });

    // No lookupUserByEmail mock queued here: the route rejects on the status
    // check before it ever calls the lookup, so nothing should be consumed.
    const res = await app.inject({
      method: "PATCH",
      url: `/shipments/${id}/assign-carrier`,
      headers: authHeaders(shipperToken),
      payload: { carrierEmail: "other-carrier@example.com" },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("PATCH /shipments/:id/status", () => {
  async function createAssignedShipment() {
    vi.mocked(lookupUserByEmail).mockResolvedValueOnce({
      id: RECEIVER_ID,
      email: "receiver@example.com",
      name: "Receiver",
      role: "receiver",
    });
    const shipperToken = app.jwt.sign({ sub: SHIPPER_ID, role: "shipper", type: "access" });
    const createRes = await app.inject({
      method: "POST",
      url: "/shipments",
      headers: authHeaders(shipperToken),
      payload: {
        productType: "Dairy",
        origin: "Casablanca",
        destination: "Rotterdam",
        receiverEmail: "receiver@example.com",
        tempMinC: 2,
        tempMaxC: 8,
      },
    });
    const id = createRes.json().id as string;

    vi.mocked(lookupUserByEmail).mockResolvedValueOnce({
      id: CARRIER_ID,
      email: "carrier@example.com",
      name: "Carrier",
      role: "carrier",
    });
    await app.inject({
      method: "PATCH",
      url: `/shipments/${id}/assign-carrier`,
      headers: authHeaders(shipperToken),
      payload: { carrierEmail: "carrier@example.com" },
    });
    return id;
  }

  it("lets the assigned carrier move created -> in_transit", async () => {
    const id = await createAssignedShipment();
    const token = app.jwt.sign({ sub: CARRIER_ID, role: "carrier", type: "access" });
    const res = await app.inject({
      method: "PATCH",
      url: `/shipments/${id}/status`,
      headers: authHeaders(token),
      payload: { status: "in_transit" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("in_transit");

    const audit = await migrationPool.query("SELECT action, details FROM shipment.audit_log WHERE shipment_id = $1", [id]);
    expect(audit.rows.some((r) => r.action === "status_changed")).toBe(true);
  });

  it("rejects an invalid transition (created -> delivered)", async () => {
    const id = await createAssignedShipment();
    const token = app.jwt.sign({ sub: CARRIER_ID, role: "carrier", type: "access" });
    const res = await app.inject({
      method: "PATCH",
      url: `/shipments/${id}/status`,
      headers: authHeaders(token),
      payload: { status: "delivered" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a transition from a terminal state", async () => {
    const id = await createAssignedShipment();
    const token = app.jwt.sign({ sub: CARRIER_ID, role: "carrier", type: "access" });
    await app.inject({
      method: "PATCH",
      url: `/shipments/${id}/status`,
      headers: authHeaders(token),
      payload: { status: "cancelled" },
    });
    const res = await app.inject({
      method: "PATCH",
      url: `/shipments/${id}/status`,
      headers: authHeaders(token),
      payload: { status: "in_transit" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a carrier who isn't assigned to this shipment (404)", async () => {
    const id = await createAssignedShipment();
    const token = app.jwt.sign({ sub: OTHER_CARRIER_ID, role: "carrier", type: "access" });
    const res = await app.inject({
      method: "PATCH",
      url: `/shipments/${id}/status`,
      headers: authHeaders(token),
      payload: { status: "in_transit" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("rejects a role that isn't carrier or admin", async () => {
    const id = await createAssignedShipment();
    const token = app.jwt.sign({ sub: SHIPPER_ID, role: "shipper", type: "access" });
    const res = await app.inject({
      method: "PATCH",
      url: `/shipments/${id}/status`,
      headers: authHeaders(token),
      payload: { status: "in_transit" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("lets an admin update status regardless of assignment", async () => {
    const id = await createAssignedShipment();
    const token = app.jwt.sign({ sub: ADMIN_ID, role: "admin", type: "access" });
    const res = await app.inject({
      method: "PATCH",
      url: `/shipments/${id}/status`,
      headers: authHeaders(token),
      payload: { status: "in_transit" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("rejects a malformed status value", async () => {
    const id = await createAssignedShipment();
    const token = app.jwt.sign({ sub: CARRIER_ID, role: "carrier", type: "access" });
    const res = await app.inject({
      method: "PATCH",
      url: `/shipments/${id}/status`,
      headers: authHeaders(token),
      payload: { status: "teleported" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a malformed shipment id", async () => {
    const token = app.jwt.sign({ sub: CARRIER_ID, role: "carrier", type: "access" });
    const res = await app.inject({
      method: "PATCH",
      url: "/shipments/not-a-uuid/status",
      headers: authHeaders(token),
      payload: { status: "in_transit" },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /internal/devices/validate", () => {
  async function createShipmentAndGetDeviceToken() {
    vi.mocked(lookupUserByEmail).mockResolvedValueOnce({
      id: RECEIVER_ID,
      email: "receiver@example.com",
      name: "Receiver",
      role: "receiver",
    });
    const token = app.jwt.sign({ sub: SHIPPER_ID, role: "shipper", type: "access" });
    const res = await app.inject({
      method: "POST",
      url: "/shipments",
      headers: authHeaders(token),
      payload: {
        productType: "Dairy",
        origin: "Casablanca",
        destination: "Rotterdam",
        receiverEmail: "receiver@example.com",
        tempMinC: 2,
        tempMaxC: 8,
      },
    });
    return res.json();
  }

  it("rejects requests without the internal-service token", async () => {
    const res = await app.inject({ method: "GET", url: "/internal/devices/validate?token=whatever" });
    expect(res.statusCode).toBe(403);
  });

  it("returns device + shipment threshold info for a valid token", async () => {
    const shipment = await createShipmentAndGetDeviceToken();
    const res = await app.inject({
      method: "GET",
      url: `/internal/devices/validate?token=${shipment.deviceToken}`,
      headers: { "x-internal-token": INTERNAL_TOKEN },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.deviceId).toBe(shipment.assignedDeviceId);
    expect(body.shipmentId).toBe(shipment.id);
    expect(body.tempMinC).toBe(2);
    expect(body.tempMaxC).toBe(8);
  });

  it("returns 404 for an unknown device token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/internal/devices/validate?token=not-a-real-token",
      headers: { "x-internal-token": INTERNAL_TOKEN },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 when the token query param is missing", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/internal/devices/validate",
      headers: { "x-internal-token": INTERNAL_TOKEN },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /internal/shipments/:id", () => {
  async function createShipment() {
    vi.mocked(lookupUserByEmail).mockResolvedValueOnce({
      id: RECEIVER_ID,
      email: "receiver@example.com",
      name: "Receiver",
      role: "receiver",
    });
    const token = app.jwt.sign({ sub: SHIPPER_ID, role: "shipper", type: "access" });
    const res = await app.inject({
      method: "POST",
      url: "/shipments",
      headers: authHeaders(token),
      payload: {
        productType: "Dairy",
        origin: "Casablanca",
        destination: "Rotterdam",
        receiverEmail: "receiver@example.com",
        tempMinC: 2,
        tempMaxC: 8,
      },
    });
    return res.json();
  }

  it("rejects requests without the internal-service token", async () => {
    const shipment = await createShipment();
    const res = await app.inject({ method: "GET", url: `/internal/shipments/${shipment.id}` });
    expect(res.statusCode).toBe(403);
  });

  it("returns full shipment details for a valid internal token (no JWT required)", async () => {
    const shipment = await createShipment();
    const res = await app.inject({
      method: "GET",
      url: `/internal/shipments/${shipment.id}`,
      headers: { "x-internal-token": INTERNAL_TOKEN },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(shipment.id);
    expect(body.receiverId).toBe(RECEIVER_ID);
    expect(body.assignedDeviceId).toBe(shipment.assignedDeviceId);
    expect(body.status).toBe("created");
  });

  it("returns 404 for a well-formed but non-existent id", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/internal/shipments/00000000-0000-0000-0000-000000000000",
      headers: { "x-internal-token": INTERNAL_TOKEN },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 for a malformed id", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/internal/shipments/not-a-uuid",
      headers: { "x-internal-token": INTERNAL_TOKEN },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /shipments/:id/readings and /shipments/:id/alerts", () => {
  beforeEach(() => {
    vi.mocked(fetchDeviceReadings).mockClear();
    vi.mocked(fetchShipmentAlerts).mockClear();
  });

  async function createShipment() {
    vi.mocked(lookupUserByEmail).mockResolvedValueOnce({
      id: RECEIVER_ID,
      email: "receiver@example.com",
      name: "Receiver",
      role: "receiver",
    });
    const token = app.jwt.sign({ sub: SHIPPER_ID, role: "shipper", type: "access" });
    const res = await app.inject({
      method: "POST",
      url: "/shipments",
      headers: authHeaders(token),
      payload: {
        productType: "Dairy",
        origin: "Casablanca",
        destination: "Rotterdam",
        receiverEmail: "receiver@example.com",
        tempMinC: 2,
        tempMaxC: 8,
      },
    });
    return res.json();
  }

  it("lets the owning shipper fetch readings, proxied from Ingestion Service", async () => {
    const shipment = await createShipment();
    vi.mocked(fetchDeviceReadings).mockResolvedValueOnce([{ time: "t1", temperatureC: 4, humidityPct: 55 }]);
    const token = app.jwt.sign({ sub: SHIPPER_ID, role: "shipper", type: "access" });

    const res = await app.inject({ method: "GET", url: `/shipments/${shipment.id}/readings`, headers: authHeaders(token) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([{ time: "t1", temperatureC: 4, humidityPct: 55 }]);
    expect(fetchDeviceReadings).toHaveBeenCalledWith(shipment.assignedDeviceId);
  });

  it("returns 404 for readings on a shipment the user doesn't own", async () => {
    const shipment = await createShipment();
    const token = app.jwt.sign({ sub: OTHER_SHIPPER_ID, role: "shipper", type: "access" });

    const res = await app.inject({ method: "GET", url: `/shipments/${shipment.id}/readings`, headers: authHeaders(token) });
    expect(res.statusCode).toBe(404);
    expect(fetchDeviceReadings).not.toHaveBeenCalled();
  });

  it("lets the owning shipper fetch alerts, proxied from Alerting Service", async () => {
    const shipment = await createShipment();
    vi.mocked(fetchShipmentAlerts).mockResolvedValueOnce([{ id: "a1", reason: "temp_high" } as never]);
    const token = app.jwt.sign({ sub: SHIPPER_ID, role: "shipper", type: "access" });

    const res = await app.inject({ method: "GET", url: `/shipments/${shipment.id}/alerts`, headers: authHeaders(token) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([{ id: "a1", reason: "temp_high" }]);
    expect(fetchShipmentAlerts).toHaveBeenCalledWith(shipment.id);
  });

  it("returns 404 for alerts on a shipment the user doesn't own", async () => {
    const shipment = await createShipment();
    const token = app.jwt.sign({ sub: OTHER_SHIPPER_ID, role: "shipper", type: "access" });

    const res = await app.inject({ method: "GET", url: `/shipments/${shipment.id}/alerts`, headers: authHeaders(token) });
    expect(res.statusCode).toBe(404);
    expect(fetchShipmentAlerts).not.toHaveBeenCalled();
  });

  it("rejects a malformed shipment id for readings", async () => {
    const token = app.jwt.sign({ sub: SHIPPER_ID, role: "shipper", type: "access" });
    const res = await app.inject({ method: "GET", url: "/shipments/not-a-uuid/readings", headers: authHeaders(token) });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a malformed shipment id for alerts", async () => {
    const token = app.jwt.sign({ sub: SHIPPER_ID, role: "shipper", type: "access" });
    const res = await app.inject({ method: "GET", url: "/shipments/not-a-uuid/alerts", headers: authHeaders(token) });
    expect(res.statusCode).toBe(400);
  });
});
