import type { FastifyRequest, FastifyReply } from "fastify";
import type { Role } from "@baridi-ma/shared-types";

export interface AccessClaims {
  sub: string;
  role: Role;
  type: "access" | "refresh";
}

declare module "fastify" {
  interface FastifyRequest {
    authUser?: AccessClaims;
  }
}

// ADR-1: every service verifies the JWT itself rather than trusting the BFF's
// role check alone (defense in depth — see Security baseline §4 and §7).
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  let claims: AccessClaims;
  try {
    claims = await request.jwtVerify<AccessClaims>();
  } catch {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  if (claims.type !== "access") {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  request.authUser = claims;
}
