import { z } from "zod";

export const readingNotificationSchema = z.object({
  deviceId: z.string().uuid(),
  shipmentId: z.string().uuid(),
  time: z.string(),
  temperatureC: z.number(),
  humidityPct: z.number().nullable(),
  tempMinC: z.number(),
  tempMaxC: z.number(),
  humidityMinPct: z.number().nullable(),
  humidityMaxPct: z.number().nullable(),
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const shipmentIdQuerySchema = z.object({
  shipmentId: z.string().regex(UUID_RE, "Invalid shipment id"),
});
