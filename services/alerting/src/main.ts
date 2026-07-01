import Fastify from "fastify";
import { dbPlugin } from "./db.js";
import { alertRoutes } from "./routes.js";
import { registerErrorHandler } from "./error-handler.js";
import { startListener } from "./listener.js";

const PORT = Number(process.env.PORT ?? 4004);

const app = Fastify({ logger: true });

async function start() {
  registerErrorHandler(app);
  await app.register(dbPlugin);
  await app.register(alertRoutes);

  app.get("/health", async () => ({ status: "ok", service: "alerting" }));

  await app.listen({ port: PORT, host: "0.0.0.0" });
  await startListener(app.pg, app.log);
}

start().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
