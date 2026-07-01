import type { Pool } from "pg";
import { readingNotificationSchema } from "./schemas.js";
import { sendAlertEmail } from "./mailer.js";

export type AlertReason = "temp_high" | "temp_low" | "humidity_high" | "humidity_low";

export interface EvaluateResult {
  alerted: boolean;
  reason?: "invalid_payload" | "within_thresholds" | "debounced";
  alertReason?: AlertReason;
}

// Test Strategy §4 adversarial checklist: don't create a new alert for every
// reading in a burst of an ongoing excursion.
const DEBOUNCE_WINDOW_MINUTES = 5;

function findBreach(
  temperatureC: number,
  humidityPct: number | null,
  tempMinC: number,
  tempMaxC: number,
  humidityMinPct: number | null,
  humidityMaxPct: number | null,
): { reason: AlertReason; value: number; threshold: number } | null {
  if (temperatureC > tempMaxC) return { reason: "temp_high", value: temperatureC, threshold: tempMaxC };
  if (temperatureC < tempMinC) return { reason: "temp_low", value: temperatureC, threshold: tempMinC };
  if (humidityPct !== null && humidityMaxPct !== null && humidityPct > humidityMaxPct) {
    return { reason: "humidity_high", value: humidityPct, threshold: humidityMaxPct };
  }
  if (humidityPct !== null && humidityMinPct !== null && humidityPct < humidityMinPct) {
    return { reason: "humidity_low", value: humidityPct, threshold: humidityMinPct };
  }
  return null;
}

export async function evaluateReading(pool: Pool, rawPayload: unknown): Promise<EvaluateResult> {
  const parsed = readingNotificationSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return { alerted: false, reason: "invalid_payload" };
  }
  const { shipmentId, deviceId, time, temperatureC, humidityPct, tempMinC, tempMaxC, humidityMinPct, humidityMaxPct } =
    parsed.data;

  const breach = findBreach(temperatureC, humidityPct, tempMinC, tempMaxC, humidityMinPct, humidityMaxPct);
  if (!breach) {
    return { alerted: false, reason: "within_thresholds" };
  }

  const recent = await pool.query(
    `SELECT id FROM alerting.alerts
     WHERE shipment_id = $1 AND reason = $2 AND created_at > NOW() - ($3 * INTERVAL '1 minute')
     LIMIT 1`,
    [shipmentId, breach.reason, DEBOUNCE_WINDOW_MINUTES],
  );
  if (recent.rows.length > 0) {
    return { alerted: false, reason: "debounced", alertReason: breach.reason };
  }

  await pool.query(
    `INSERT INTO alerting.alerts (shipment_id, device_id, reading_time, reason, value, threshold)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [shipmentId, deviceId, time, breach.reason, breach.value, breach.threshold],
  );

  await sendAlertEmail(shipmentId, breach.reason, breach.value, breach.threshold);

  return { alerted: true, alertReason: breach.reason };
}
