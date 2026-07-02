import type { FastifyInstance, FastifyError } from "fastify";

// Security baseline §6: error responses must never leak internal details
// (stack traces, DB errors, upstream fetch failures) to the client.
export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error(error);
    const statusCode = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
    if (statusCode >= 500) {
      return reply.code(statusCode).send({ error: "Internal server error" });
    }
    return reply.code(statusCode).send({ error: error.message });
  });
}
