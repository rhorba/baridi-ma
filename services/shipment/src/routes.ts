import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { requireAuth, type AccessClaims } from "./jwt-auth.js";
import { requireInternalToken } from "./internal-auth.js";
import { lookupUserByEmail } from "./internal-client.js";
import { fetchDeviceReadings, fetchShipmentAlerts } from "./telemetry-client.js";
import {
  createShipmentSchema,
  shipmentIdSchema,
  assignCarrierSchema,
  updateStatusSchema,
  deviceTokenQuerySchema,
} from "./schemas.js";
import { writeAuditLog } from "./audit.js";
import { isValidTransition, type ShipmentStatus } from "./status-transitions.js";

interface ShipmentRow {
  id: string;
  shipper_id: string;
  carrier_id: string | null;
  receiver_id: string;
  assigned_device_id: string | null;
  product_type: string;
  origin: string;
  destination: string;
  temp_min_c: string;
  temp_max_c: string;
  humidity_min_pct: string | null;
  humidity_max_pct: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

function toApiShipment(row: ShipmentRow) {
  return {
    id: row.id,
    shipperId: row.shipper_id,
    carrierId: row.carrier_id,
    receiverId: row.receiver_id,
    assignedDeviceId: row.assigned_device_id,
    productType: row.product_type,
    origin: row.origin,
    destination: row.destination,
    tempMinC: Number(row.temp_min_c),
    tempMaxC: Number(row.temp_max_c),
    humidityMinPct: row.humidity_min_pct === null ? null : Number(row.humidity_min_pct),
    humidityMaxPct: row.humidity_max_pct === null ? null : Number(row.humidity_max_pct),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Same query shape (found-and-owned vs not) regardless of *why* it fails, so a
// 404 never leaks whether a shipment id exists (Security baseline §2, IDOR).
async function findShipmentForViewer(app: FastifyInstance, id: string, claims: AccessClaims): Promise<ShipmentRow | null> {
  const result =
    claims.role === "admin"
      ? await app.pg.query<ShipmentRow>("SELECT * FROM shipment.shipments WHERE id = $1", [id])
      : await app.pg.query<ShipmentRow>(
          "SELECT * FROM shipment.shipments WHERE id = $1 AND (shipper_id = $2 OR carrier_id = $2 OR receiver_id = $2)",
          [id, claims.sub],
        );
  return result.rows[0] ?? null;
}

export async function shipmentRoutes(app: FastifyInstance) {
  // Scoped to this plugin's encapsulation context — does not affect /health,
  // which is registered directly on the root app instance in main.ts.
  app.addHook("preHandler", requireInternalToken);

  app.post("/shipments", { preHandler: requireAuth }, async (request, reply) => {
    const claims = request.authUser!;
    if (claims.role !== "shipper") {
      return reply.code(403).send({ error: "Only shippers can create shipments" });
    }

    const parsed = createShipmentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const { productType, origin, destination, receiverEmail, tempMinC, tempMaxC, humidityMinPct, humidityMaxPct } =
      parsed.data;

    const receiver = await lookupUserByEmail(receiverEmail, "receiver");
    if (!receiver) {
      return reply.code(400).send({ error: "No receiver found with that email" });
    }

    // Auto-provision one device per shipment (per architecture data model:
    // Shipment --1:1--> Device). The token is a bearer credential for the
    // physical sensor / simulator and is only ever revealed here, at creation.
    const deviceToken = crypto.randomBytes(24).toString("hex");
    const client = await app.pg.connect();
    try {
      await client.query("BEGIN");
      const deviceResult = await client.query<{ id: string }>(
        "INSERT INTO shipment.devices (device_token, label) VALUES ($1, $2) RETURNING id",
        [deviceToken, productType],
      );
      const deviceId = deviceResult.rows[0].id;

      const shipmentResult = await client.query<ShipmentRow>(
        `INSERT INTO shipment.shipments
           (shipper_id, receiver_id, assigned_device_id, product_type, origin, destination, temp_min_c, temp_max_c, humidity_min_pct, humidity_max_pct)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          claims.sub,
          receiver.id,
          deviceId,
          productType,
          origin,
          destination,
          tempMinC,
          tempMaxC,
          humidityMinPct ?? null,
          humidityMaxPct ?? null,
        ],
      );
      await client.query("COMMIT");
      return reply.code(201).send({ ...toApiShipment(shipmentResult.rows[0]), deviceToken });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });

  app.get("/shipments", { preHandler: requireAuth }, async (request, reply) => {
    const claims = request.authUser!;

    let result;
    if (claims.role === "admin") {
      result = await app.pg.query<ShipmentRow>("SELECT * FROM shipment.shipments ORDER BY created_at DESC");
    } else {
      const column = claims.role === "shipper" ? "shipper_id" : claims.role === "carrier" ? "carrier_id" : "receiver_id";
      result = await app.pg.query<ShipmentRow>(
        `SELECT * FROM shipment.shipments WHERE ${column} = $1 ORDER BY created_at DESC`,
        [claims.sub],
      );
    }
    return reply.send(result.rows.map(toApiShipment));
  });

  app.get("/shipments/:id", { preHandler: requireAuth }, async (request, reply) => {
    const claims = request.authUser!;
    const parsedParams = shipmentIdSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.code(400).send({ error: parsedParams.error.flatten() });
    }
    const { id } = parsedParams.data;

    const shipment = await findShipmentForViewer(app, id, claims);
    if (!shipment) {
      return reply.code(404).send({ error: "Shipment not found" });
    }
    // Fastify's reply.send(object) JSON-serializes (Content-Type: application/json);
    // it never writes raw HTML, so the Express-specific XSS pattern doesn't apply.
    // The frontend (React) also auto-escapes all rendered output regardless.
    return reply.send(toApiShipment(shipment)); // nosemgrep
  });

  app.get("/shipments/:id/readings", { preHandler: requireAuth }, async (request, reply) => {
    const claims = request.authUser!;
    const parsedParams = shipmentIdSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.code(400).send({ error: parsedParams.error.flatten() });
    }
    const { id } = parsedParams.data;

    const shipment = await findShipmentForViewer(app, id, claims);
    if (!shipment) {
      return reply.code(404).send({ error: "Shipment not found" });
    }
    if (!shipment.assigned_device_id) {
      return reply.send([]);
    }
    return reply.send(await fetchDeviceReadings(shipment.assigned_device_id)); // nosemgrep (see rationale above)
  });

  app.get("/shipments/:id/alerts", { preHandler: requireAuth }, async (request, reply) => {
    const claims = request.authUser!;
    const parsedParams = shipmentIdSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.code(400).send({ error: parsedParams.error.flatten() });
    }
    const { id } = parsedParams.data;

    const shipment = await findShipmentForViewer(app, id, claims);
    if (!shipment) {
      return reply.code(404).send({ error: "Shipment not found" });
    }
    return reply.send(await fetchShipmentAlerts(shipment.id)); // nosemgrep (see rationale above)
  });

  app.patch("/shipments/:id/assign-carrier", { preHandler: requireAuth }, async (request, reply) => {
    const claims = request.authUser!;
    if (claims.role !== "shipper" && claims.role !== "admin") {
      return reply.code(403).send({ error: "Only the shipper or an admin can assign a carrier" });
    }
    const parsedParams = shipmentIdSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.code(400).send({ error: parsedParams.error.flatten() });
    }
    const parsedBody = assignCarrierSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.code(400).send({ error: parsedBody.error.flatten() });
    }
    const { id } = parsedParams.data;
    const { carrierEmail } = parsedBody.data;

    const existing =
      claims.role === "admin"
        ? await app.pg.query<ShipmentRow>("SELECT * FROM shipment.shipments WHERE id = $1", [id])
        : await app.pg.query<ShipmentRow>("SELECT * FROM shipment.shipments WHERE id = $1 AND shipper_id = $2", [
            id,
            claims.sub,
          ]);
    const shipment = existing.rows[0];
    if (!shipment) {
      return reply.code(404).send({ error: "Shipment not found" });
    }
    if (shipment.status !== "created") {
      return reply.code(400).send({ error: "Carrier can only be assigned while status is 'created'" });
    }

    const carrier = await lookupUserByEmail(carrierEmail, "carrier");
    if (!carrier) {
      return reply.code(400).send({ error: "No carrier found with that email" });
    }

    const updated = await app.pg.query<ShipmentRow>(
      "UPDATE shipment.shipments SET carrier_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [carrier.id, id],
    );
    await writeAuditLog(app.pg, id, claims.sub, "carrier_assigned", { carrierId: carrier.id });
    return reply.send(toApiShipment(updated.rows[0])); // nosemgrep (see rationale above)
  });

  app.patch("/shipments/:id/status", { preHandler: requireAuth }, async (request, reply) => {
    const claims = request.authUser!;
    if (claims.role !== "carrier" && claims.role !== "admin") {
      return reply.code(403).send({ error: "Only the assigned carrier or an admin can update status" });
    }
    const parsedParams = shipmentIdSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.code(400).send({ error: parsedParams.error.flatten() });
    }
    const parsedBody = updateStatusSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.code(400).send({ error: parsedBody.error.flatten() });
    }
    const { id } = parsedParams.data;
    const { status: newStatus } = parsedBody.data;

    const existing =
      claims.role === "admin"
        ? await app.pg.query<ShipmentRow>("SELECT * FROM shipment.shipments WHERE id = $1", [id])
        : await app.pg.query<ShipmentRow>("SELECT * FROM shipment.shipments WHERE id = $1 AND carrier_id = $2", [
            id,
            claims.sub,
          ]);
    const shipment = existing.rows[0];
    if (!shipment) {
      return reply.code(404).send({ error: "Shipment not found" });
    }

    const currentStatus = shipment.status as ShipmentStatus;
    if (!isValidTransition(currentStatus, newStatus)) {
      return reply.code(400).send({ error: `Cannot transition from ${currentStatus} to ${newStatus}` });
    }

    const updated = await app.pg.query<ShipmentRow>(
      "UPDATE shipment.shipments SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [newStatus, id],
    );
    await writeAuditLog(app.pg, id, claims.sub, "status_changed", { from: currentStatus, to: newStatus });
    return reply.send(toApiShipment(updated.rows[0])); // nosemgrep (see rationale above)
  });

  // Internal-only (no JWT — the Ingestion Service calls this per MQTT message,
  // with no end-user context). The internal-token hook above still applies.
  app.get("/internal/devices/validate", async (request, reply) => {
    const parsed = deviceTokenQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const { token } = parsed.data;

    const result = await app.pg.query<{
      device_id: string;
      shipment_id: string;
      temp_min_c: string;
      temp_max_c: string;
      humidity_min_pct: string | null;
      humidity_max_pct: string | null;
    }>(
      `SELECT d.id AS device_id, s.id AS shipment_id, s.temp_min_c, s.temp_max_c, s.humidity_min_pct, s.humidity_max_pct
       FROM shipment.devices d
       JOIN shipment.shipments s ON s.assigned_device_id = d.id
       WHERE d.device_token = $1 AND d.is_active = true`,
      [token],
    );
    const row = result.rows[0];
    if (!row) {
      return reply.code(404).send({ error: "Unknown or inactive device" });
    }
    return reply.send({
      deviceId: row.device_id,
      shipmentId: row.shipment_id,
      tempMinC: Number(row.temp_min_c),
      tempMaxC: Number(row.temp_max_c),
      humidityMinPct: row.humidity_min_pct === null ? null : Number(row.humidity_min_pct),
      humidityMaxPct: row.humidity_max_pct === null ? null : Number(row.humidity_max_pct),
    });
  });

  // Internal-only (no JWT) — Compliance Service resolves shipment ownership/status/
  // device before generating an export. The internal-token hook above still applies.
  app.get("/internal/shipments/:id", async (request, reply) => {
    const parsedParams = shipmentIdSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.code(400).send({ error: parsedParams.error.flatten() });
    }
    const result = await app.pg.query<ShipmentRow>("SELECT * FROM shipment.shipments WHERE id = $1", [
      parsedParams.data.id,
    ]);
    const shipment = result.rows[0];
    if (!shipment) {
      return reply.code(404).send({ error: "Shipment not found" });
    }
    return reply.send(toApiShipment(shipment)); // nosemgrep (see rationale above)
  });
}
