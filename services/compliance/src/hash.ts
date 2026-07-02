import crypto from "node:crypto";
import type { ReadingDto } from "./ingestion-client.js";

// Tamper-evidence hash (architecture doc §Data protection): a fixed field
// order and JSON.stringify (not object insertion order) keep the hash
// deterministic regardless of how the readings array was assembled upstream.
export function hashReadings(readings: ReadingDto[]): string {
  const canonical = readings.map((r) => ({ time: r.time, temperatureC: r.temperatureC, humidityPct: r.humidityPct }));
  return crypto.createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
