import type { FastifyInstance } from "fastify";
import { requireAuth, type AccessClaims } from "./jwt-auth.js";
import { requireInternalToken } from "./internal-auth.js";
import { lookupUserByEmail } from "./internal-client.js";
import { createShipmentSchema, shipmentIdSchema, assignCarrierSchema, updateStatusSchema } from "./schemas.js";
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

    const result = await app.pg.query<ShipmentRow>(
      `INSERT INTO shipment.shipments
         (shipper_id, receiver_id, product_type, origin, destination, temp_min_c, temp_max_c, humidity_min_pct, humidity_max_pct)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [claims.sub, receiver.id, productType, origin, destination, tempMinC, tempMaxC, humidityMinPct ?? null, humidityMaxPct ?? null],
    );
    return reply.code(201).send(toApiShipment(result.rows[0]));
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

    // Same query shape (found-and-owned vs not) regardless of *why* it fails,
    // so a 404 never leaks whether a shipment id exists (Security baseline §2, IDOR).
    const result =
      claims.role === "admin"
        ? await app.pg.query<ShipmentRow>("SELECT * FROM shipment.shipments WHERE id = $1", [id])
        : await app.pg.query<ShipmentRow>(
            "SELECT * FROM shipment.shipments WHERE id = $1 AND (shipper_id = $2 OR carrier_id = $2 OR receiver_id = $2)",
            [id, claims.sub],
          );

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: "Shipment not found" });
    }
    // Fastify's reply.send(object) JSON-serializes (Content-Type: application/json);
    // it never writes raw HTML, so the Express-specific XSS pattern doesn't apply.
    // The frontend (React) also auto-escapes all rendered output regardless.
    return reply.send(toApiShipment(result.rows[0])); // nosemgrep
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
}
