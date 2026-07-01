import { z } from "zod";

export const createShipmentSchema = z
  .object({
    productType: z.string().min(1),
    origin: z.string().min(1),
    destination: z.string().min(1),
    receiverEmail: z.string().email(),
    tempMinC: z.number(),
    tempMaxC: z.number(),
    humidityMinPct: z.number().min(0).max(100).optional(),
    humidityMaxPct: z.number().min(0).max(100).optional(),
  })
  .refine((data) => data.tempMinC <= data.tempMaxC, {
    message: "tempMinC must be <= tempMaxC",
    path: ["tempMinC"],
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const shipmentIdSchema = z.object({
  id: z.string().regex(UUID_RE, "Invalid shipment id"),
});

export const assignCarrierSchema = z.object({
  carrierEmail: z.string().email(),
});

export const updateStatusSchema = z.object({
  status: z.enum(["in_transit", "delivered", "cancelled"]),
});
