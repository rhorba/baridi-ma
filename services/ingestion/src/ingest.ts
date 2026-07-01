import type { Pool } from "pg";
import { readingPayloadSchema } from "./schemas.js";
import { validateDevice } from "./device-validator.js";

export interface IngestResult {
  ok: boolean;
  reason?: "invalid_payload" | "unknown_device" | "duplicate_reading";
}

// Core ingestion logic, deliberately separate from MQTT wiring (mqtt-client.ts)
// so it's testable without a broker. `now` is injectable for duplicate-reading tests.
export async function handleReading(pool: Pool, rawPayload: unknown, now: Date = new Date()): Promise<IngestResult> {
  const parsed = readingPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return { ok: false, reason: "invalid_payload" };
  }
  const { deviceToken, temperatureC, humidityPct } = parsed.data;

  const device = await validateDevice(deviceToken);
  if (!device) {
    return { ok: false, reason: "unknown_device" };
  }

  // Append-only per Security baseline §2 / Database design §3 (DB grants also
  // block UPDATE/DELETE). ON CONFLICT DO NOTHING makes replays a no-op instead of an error.
  const insertResult = await pool.query(
    `INSERT INTO ingestion.sensor_readings (device_id, time, temperature_c, humidity_pct)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (device_id, time) DO NOTHING
     RETURNING device_id`,
    [device.deviceId, now, temperatureC, humidityPct ?? null],
  );
  if (insertResult.rowCount === 0) {
    return { ok: false, reason: "duplicate_reading" };
  }

  // SDR-2: Postgres LISTEN/NOTIFY instead of a message broker — Alerting
  // Service gets everything it needs (value + thresholds) in one payload.
  const notifyPayload = JSON.stringify({
    deviceId: device.deviceId,
    shipmentId: device.shipmentId,
    time: now.toISOString(),
    temperatureC,
    humidityPct: humidityPct ?? null,
    tempMinC: device.tempMinC,
    tempMaxC: device.tempMaxC,
    humidityMinPct: device.humidityMinPct,
    humidityMaxPct: device.humidityMaxPct,
  });
  await pool.query("SELECT pg_notify('reading_ingested', $1)", [notifyPayload]);

  return { ok: true };
}
