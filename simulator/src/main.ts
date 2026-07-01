import mqtt from "mqtt";
import { initialState, nextReading, type SimulatorConfig } from "./simulate.js";

const deviceToken = process.env.SIMULATOR_DEVICE_TOKEN;
if (!deviceToken) {
  throw new Error("SIMULATOR_DEVICE_TOKEN env var is required");
}

const config: SimulatorConfig = {
  baseTempC: Number(process.env.SIMULATOR_BASE_TEMP_C ?? 4),
  baseHumidityPct: Number(process.env.SIMULATOR_BASE_HUMIDITY_PCT ?? 55),
  excursionProbability: Number(process.env.SIMULATOR_EXCURSION_PROBABILITY ?? 0.05),
  excursionMagnitudeC: Number(process.env.SIMULATOR_EXCURSION_MAGNITUDE_C ?? 6),
};
const intervalMs = Number(process.env.SIMULATOR_INTERVAL_MS ?? 5000);
const brokerUrl = process.env.MQTT_BROKER_URL ?? "mqtt://localhost:1883";
const topic = `sensors/${deviceToken}/readings`;

const client = mqtt.connect(brokerUrl);
let state = initialState(config);

client.on("connect", () => {
  console.log(`[simulator] connected to ${brokerUrl}, publishing to ${topic} every ${intervalMs}ms`);
  setInterval(() => {
    state = nextReading(state, config);
    const payload = JSON.stringify({
      deviceToken,
      temperatureC: state.temperatureC,
      humidityPct: state.humidityPct,
    });
    client.publish(topic, payload);
    console.log(`[simulator] published ${payload}`);
  }, intervalMs);
});

client.on("error", (err) => {
  console.error("[simulator] MQTT error:", err);
});
