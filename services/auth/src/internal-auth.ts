import type { FastifyRequest, FastifyReply } from "fastify";

// Security baseline §7: MVP internal service trust is a shared-secret header.
// Guards routes meant only for other services (never the BFF-facing public API).
export async function requireInternalToken(request: FastifyRequest, reply: FastifyReply) {
  const token = request.headers["x-internal-token"];
  const expected = process.env.INTERNAL_SERVICE_TOKEN;
  if (!expected || token !== expected) {
    return reply.code(403).send({ error: "Forbidden" });
  }
}
