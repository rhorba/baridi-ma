import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import { dbPlugin } from "./db.js";
import { complianceRoutes } from "./routes.js";
import { registerErrorHandler } from "./error-handler.js";

const PORT = Number(process.env.PORT ?? 4005);

const app = Fastify({ logger: true });

async function start() {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET env var is required");
  }

  registerErrorHandler(app);
  await app.register(fastifyJwt, { secret: jwtSecret });
  await app.register(dbPlugin);
  await app.register(complianceRoutes);

  app.get("/health", async () => ({ status: "ok", service: "compliance" }));

  await app.listen({ port: PORT, host: "0.0.0.0" });
}

start().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
