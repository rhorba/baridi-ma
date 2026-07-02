import { z } from "zod";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const shipmentIdSchema = z.object({
  shipmentId: z.string().regex(UUID_RE, "Invalid shipment id"),
});
