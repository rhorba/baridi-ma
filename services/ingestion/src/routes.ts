import type { FastifyInstance } from "fastify";
import { requireInternalToken } from "./internal-auth.js";
import { deviceIdParamSchema } from "./schemas.js";

interface ReadingRow {
  time: string;
  temperature_c: string;
  humidity_pct: string | null;
}

// Internal-only (per architecture doc: "Used by Compliance" — and now the
// Shipment Service, which proxies it after verifying shipment ownership).
export async function ingestionRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireInternalToken);

  app.get("/internal/devices/:id/readings", async (request, reply) => {
    const parsed = deviceIdParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const { id } = parsed.data;

    const result = await app.pg.query<ReadingRow>(
      "SELECT time, temperature_c, humidity_pct FROM ingestion.sensor_readings WHERE device_id = $1 ORDER BY time ASC",
      [id],
    );
    const apiReadings = result.rows.map((r) => ({
      time: r.time,
      temperatureC: Number(r.temperature_c),
      humidityPct: r.humidity_pct === null ? null : Number(r.humidity_pct),
    }));
    // Fastify's reply.send(object) JSON-serializes; it never writes raw HTML,
    // so the Express-specific XSS pattern doesn't apply (see shipment-service routes.ts).
    return reply.send(apiReadings); // nosemgrep
  });
}
