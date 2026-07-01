import { Client, type Pool } from "pg";
import type { FastifyBaseLogger } from "fastify";
import { evaluateReading } from "./evaluate.js";

// SDR-2: Postgres LISTEN/NOTIFY, not a message broker. LISTEN needs its own
// dedicated connection (pooled connections aren't suited for long-lived LISTEN).
export async function startListener(pool: Pool, logger: FastifyBaseLogger): Promise<Client> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query("LISTEN reading_ingested");

  client.on("notification", async (msg) => {
    if (!msg.payload) return;
    let payload: unknown;
    try {
      payload = JSON.parse(msg.payload);
    } catch {
      logger.warn("Discarding malformed NOTIFY payload");
      return;
    }
    try {
      const result = await evaluateReading(pool, payload);
      if (result.alerted) {
        logger.info({ alertReason: result.alertReason }, "Alert created");
      }
    } catch (err) {
      logger.error({ err }, "Failed to evaluate reading for alerts");
    }
  });

  client.on("error", (err) => {
    logger.error({ err }, "LISTEN client error");
  });

  return client;
}
