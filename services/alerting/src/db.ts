import { Pool } from "pg";
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    pg: Pool;
  }
}

export const dbPlugin = fp(async (app: FastifyInstance) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  app.decorate("pg", pool);
  app.addHook("onClose", async () => {
    await pool.end();
  });
});
