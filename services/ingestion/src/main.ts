import Fastify from "fastify";
import { dbPlugin } from "./db.js";
import { ingestionRoutes } from "./routes.js";
import { registerErrorHandler } from "./error-handler.js";
import { startMqttSubscriber } from "./mqtt-client.js";

const PORT = Number(process.env.PORT ?? 4003);

const app = Fastify({ logger: true });

async function start() {
  registerErrorHandler(app);
  await app.register(dbPlugin);
  await app.register(ingestionRoutes);

  app.get("/health", async () => ({ status: "ok", service: "ingestion" }));

  await app.listen({ port: PORT, host: "0.0.0.0" });
  startMqttSubscriber(app.pg, app.log);
}

start().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
