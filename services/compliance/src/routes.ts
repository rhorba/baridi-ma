import type { FastifyInstance } from "fastify";
import { requireAuth } from "./jwt-auth.js";
import { requireInternalToken } from "./internal-auth.js";
import { shipmentIdSchema } from "./schemas.js";
import { fetchShipment } from "./shipment-client.js";
import { fetchDeviceReadings } from "./ingestion-client.js";
import { hashReadings } from "./hash.js";
import { generateCompliancePdf } from "./pdf.js";
import { saveExportFile, readExportFile } from "./storage.js";

interface ExportRow {
  id: string;
  shipment_id: string;
  generated_by: string;
  reading_hash: string;
  file_path: string;
  created_at: string;
}

const UNIQUE_VIOLATION = "23505";

export async function complianceRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireInternalToken);

  app.post("/compliance/:shipmentId/export", { preHandler: requireAuth }, async (request, reply) => {
    const claims = request.authUser!;
    if (claims.role !== "receiver" && claims.role !== "admin") {
      return reply.code(403).send({ error: "Only the receiver or an admin can export a compliance certificate" });
    }

    const parsedParams = shipmentIdSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.code(400).send({ error: parsedParams.error.flatten() });
    }
    const { shipmentId } = parsedParams.data;

    const shipment = await fetchShipment(shipmentId);
    // Same 404 regardless of "doesn't exist" vs "not yours" (IDOR — matches
    // Shipment Service's findShipmentForViewer pattern).
    if (!shipment || (claims.role !== "admin" && shipment.receiverId !== claims.sub)) {
      return reply.code(404).send({ error: "Shipment not found" });
    }

    if (shipment.status !== "delivered") {
      return reply.code(400).send({ error: "Export is only available once the shipment has been delivered" });
    }

    const existing = await app.pg.query<ExportRow>("SELECT * FROM compliance.exports WHERE shipment_id = $1", [
      shipmentId,
    ]);
    if (existing.rows[0]) {
      const row = existing.rows[0];
      const bytes = await readExportFile(row.file_path);
      return reply.code(200).header("x-reading-hash", row.reading_hash).type("application/pdf").send(bytes);
    }

    const readings = shipment.assignedDeviceId ? await fetchDeviceReadings(shipment.assignedDeviceId) : [];
    const readingHash = hashReadings(readings);
    const pdfBytes = await generateCompliancePdf(shipment, readings, readingHash);
    const filePath = await saveExportFile(shipmentId, pdfBytes);

    try {
      await app.pg.query(
        "INSERT INTO compliance.exports (shipment_id, generated_by, reading_hash, file_path) VALUES ($1, $2, $3, $4)",
        [shipmentId, claims.sub, readingHash, filePath],
      );
    } catch (err) {
      // Concurrent export requests both passed the SELECT above — the unique
      // constraint on shipment_id is the real idempotency guarantee; on a
      // race, defer to whichever insert won and return its stored file.
      if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
        const winner = await app.pg.query<ExportRow>("SELECT * FROM compliance.exports WHERE shipment_id = $1", [
          shipmentId,
        ]);
        const row = winner.rows[0];
        const bytes = await readExportFile(row.file_path);
        return reply.code(200).header("x-reading-hash", row.reading_hash).type("application/pdf").send(bytes);
      }
      throw err;
    }

    return reply.code(201).header("x-reading-hash", readingHash).type("application/pdf").send(Buffer.from(pdfBytes));
  });
}
