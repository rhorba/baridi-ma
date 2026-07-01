import mqtt, { type MqttClient } from "mqtt";
import type { Pool } from "pg";
import type { FastifyBaseLogger } from "fastify";
import { handleReading } from "./ingest.js";

const TOPIC = "sensors/+/readings";

export function startMqttSubscriber(pool: Pool, logger: FastifyBaseLogger): MqttClient {
  const brokerUrl = process.env.MQTT_BROKER_URL ?? "mqtt://localhost:1883";
  const client = mqtt.connect(brokerUrl);

  client.on("connect", () => {
    client.subscribe(TOPIC, (err) => {
      if (err) logger.error({ err }, "Failed to subscribe to sensor topic");
    });
  });

  client.on("message", async (_topic, payloadBuffer) => {
    let payload: unknown;
    try {
      payload = JSON.parse(payloadBuffer.toString());
    } catch {
      logger.warn("Discarding malformed (non-JSON) MQTT message");
      return;
    }
    const result = await handleReading(pool, payload);
    if (!result.ok) {
      logger.warn({ reason: result.reason }, "Reading not ingested");
    }
  });

  client.on("error", (err) => {
    logger.error({ err }, "MQTT client error");
  });

  return client;
}
