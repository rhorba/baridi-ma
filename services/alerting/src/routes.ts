import type { FastifyInstance } from "fastify";
import { requireInternalToken } from "./internal-auth.js";
import { shipmentIdQuerySchema } from "./schemas.js";

interface AlertRow {
  id: string;
  shipment_id: string;
  device_id: string;
  reading_time: string;
  reason: string;
  value: string;
  threshold: string;
  created_at: string;
}

function toApiAlert(row: AlertRow) {
  return {
    id: row.id,
    shipmentId: row.shipment_id,
    deviceId: row.device_id,
    readingTime: row.reading_time,
    reason: row.reason,
    value: Number(row.value),
    threshold: Number(row.threshold),
    createdAt: row.created_at,
  };
}

// Internal-only, same pattern as Ingestion Service's readings endpoint: the
// Shipment Service verifies shipment ownership, then proxies here.
export async function alertRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireInternalToken);

  app.get("/internal/alerts", async (request, reply) => {
    const parsed = shipmentIdQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const { shipmentId } = parsed.data;

    const result = await app.pg.query<AlertRow>(
      "SELECT * FROM alerting.alerts WHERE shipment_id = $1 ORDER BY created_at DESC",
      [shipmentId],
    );
    // Fastify's reply.send(object) JSON-serializes; it never writes raw HTML,
    // so the Express-specific XSS pattern doesn't apply (see shipment-service routes.ts).
    return reply.send(result.rows.map(toApiAlert)); // nosemgrep
  });
}
