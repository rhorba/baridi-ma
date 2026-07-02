import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Role } from "@baridi-ma/shared-types";
import { userIdSchema } from "./schemas.js";

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

interface AccessClaims {
  sub: string;
  role: Role;
  type: "access" | "refresh";
}

function toApiUser(u: UserRow) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, isActive: u.is_active, createdAt: u.created_at };
}

// FR-6. Mirrors /auth/me's inline jwtVerify pattern (this service has no
// shared requireAuth helper) plus an admin-role check on top.
async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<AccessClaims | null> {
  let claims: AccessClaims;
  try {
    claims = await request.jwtVerify<AccessClaims>();
  } catch {
    reply.code(401).send({ error: "Unauthorized" });
    return null;
  }
  if (claims.type !== "access") {
    reply.code(401).send({ error: "Unauthorized" });
    return null;
  }
  if (claims.role !== "admin") {
    reply.code(403).send({ error: "Admin access required" });
    return null;
  }
  return claims;
}

export async function adminRoutes(app: FastifyInstance) {
  app.get("/auth/admin/users", async (request, reply) => {
    const claims = await requireAdmin(request, reply);
    if (!claims) return;

    const result = await app.pg.query<UserRow>(
      "SELECT id, email, name, role, is_active, created_at FROM auth.users ORDER BY created_at DESC",
    );
    return reply.send(result.rows.map(toApiUser));
  });

  app.patch("/auth/admin/users/:id/deactivate", async (request, reply) => {
    const claims = await requireAdmin(request, reply);
    if (!claims) return;

    const parsed = userIdSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const { id } = parsed.data;

    // Prevent an admin from locking themselves out — there's no reactivate
    // path (FR-6 is deactivate-only for MVP), so this would be unrecoverable.
    if (id === claims.sub) {
      return reply.code(400).send({ error: "Admins cannot deactivate their own account" });
    }

    const result = await app.pg.query<UserRow>(
      "UPDATE auth.users SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id, email, name, role, is_active, created_at",
      [id],
    );
    const user = result.rows[0];
    if (!user) {
      return reply.code(404).send({ error: "User not found" });
    }
    // Fastify's reply.send(object) JSON-serializes (Content-Type: application/json);
    // it never writes raw HTML, so the Express-specific XSS pattern doesn't apply.
    // The frontend (React) also auto-escapes all rendered output regardless.
    return reply.send(toApiUser(user)); // nosemgrep
  });
}
