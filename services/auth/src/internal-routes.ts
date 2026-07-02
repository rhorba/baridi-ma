import type { FastifyInstance } from "fastify";
import type { Role } from "@baridi-ma/shared-types";
import { requireInternalToken } from "./internal-auth.js";

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  is_active: boolean;
}

// Called by other services (e.g. Shipment Service resolving a receiver/carrier
// email to a real user id) — never exposed to the browser via the BFF.
export async function internalRoutes(app: FastifyInstance) {
  app.get(
    "/internal/users/lookup",
    { preHandler: requireInternalToken },
    async (request, reply) => {
      const { email, role } = request.query as { email?: string; role?: string };
      if (!email) {
        return reply.code(400).send({ error: "email query param is required" });
      }

      const result = await app.pg.query<UserRow>(
        "SELECT id, email, name, role, is_active FROM auth.users WHERE email = $1",
        [email],
      );
      const user = result.rows[0];
      if (!user || !user.is_active) {
        return reply.code(404).send({ error: "User not found" });
      }
      if (role && user.role !== role) {
        return reply.code(404).send({ error: "User not found" });
      }
      return reply.send({ id: user.id, email: user.email, name: user.name, role: user.role });
    },
  );

  // Batch variant of the lookup above, used by Shipment Service to resolve
  // shipper/carrier/receiver display info for the admin shipment list in one
  // round trip instead of one lookup per id. Display-only (unlike the
  // email lookup, this isn't gating a write), so it doesn't filter is_active —
  // an admin should still see who a deactivated shipper/carrier/receiver was.
  app.get(
    "/internal/users/by-ids",
    { preHandler: requireInternalToken },
    async (request, reply) => {
      const { ids } = request.query as { ids?: string };
      if (!ids) {
        return reply.code(400).send({ error: "ids query param is required" });
      }
      const idList = ids.split(",").filter(Boolean);
      if (idList.length === 0) {
        return reply.code(400).send({ error: "ids query param is required" });
      }

      const result = await app.pg.query<UserRow>(
        "SELECT id, email, name, role, is_active FROM auth.users WHERE id = ANY($1::uuid[])",
        [idList],
      );
      return reply.send(result.rows.map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role })));
    },
  );
}
