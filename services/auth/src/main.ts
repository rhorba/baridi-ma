import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import { dbPlugin } from "./db.js";
import { authRoutes } from "./routes.js";
import { internalRoutes } from "./internal-routes.js";
import { adminRoutes } from "./admin-routes.js";
import { registerErrorHandler } from "./error-handler.js";

const PORT = Number(process.env.PORT ?? 4001);

const app = Fastify({ logger: true });

async function start() {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET env var is required");
  }

  registerErrorHandler(app);
  await app.register(fastifyJwt, { secret: jwtSecret });
  await app.register(dbPlugin);
  await app.register(authRoutes);
  await app.register(internalRoutes);
  await app.register(adminRoutes);

  app.get("/health", async () => ({ status: "ok", service: "auth" }));

  await app.listen({ port: PORT, host: "0.0.0.0" });
}

start().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
