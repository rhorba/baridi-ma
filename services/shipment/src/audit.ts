import type { Pool } from "pg";

export async function writeAuditLog(
  pool: Pool,
  shipmentId: string,
  actorId: string,
  action: string,
  details?: Record<string, unknown>,
) {
  await pool.query(
    "INSERT INTO shipment.audit_log (shipment_id, actor_id, action, details) VALUES ($1, $2, $3, $4)",
    [shipmentId, actorId, action, details ? JSON.stringify(details) : null],
  );
}
