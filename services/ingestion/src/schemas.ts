import { z } from "zod";

export const readingPayloadSchema = z.object({
  deviceToken: z.string().min(1),
  temperatureC: z.number(),
  humidityPct: z.number().min(0).max(100).optional(),
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const deviceIdParamSchema = z.object({
  id: z.string().regex(UUID_RE, "Invalid device id"),
});
