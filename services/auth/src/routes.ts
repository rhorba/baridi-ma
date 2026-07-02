import type { FastifyInstance } from "fastify";
import type { Role } from "@baridi-ma/shared-types";
import { hashPassword, verifyPassword } from "./security.js";
import { registerSchema, loginSchema, refreshSchema } from "./schemas.js";

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: Role;
  is_active: boolean;
}

interface AccessClaims {
  sub: string;
  role: Role;
  type: "access" | "refresh";
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const { email, password, name, phone, role } = parsed.data;

    const existing = await app.pg.query("SELECT id FROM auth.users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return reply.code(409).send({ error: "Email already registered" });
    }

    const passwordHash = await hashPassword(password);
    const result = await app.pg.query<UserRow>(
      `INSERT INTO auth.users (email, password_hash, name, phone, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, role, is_active`,
      [email, passwordHash, name, phone ?? null, role],
    );
    const user = result.rows[0];
    return reply.code(201).send({ id: user.id, email: user.email, name: user.name, role: user.role });
  });

  app.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const { email, password } = parsed.data;

    const result = await app.pg.query<UserRow>(
      "SELECT id, email, password_hash, name, role, is_active FROM auth.users WHERE email = $1",
      [email],
    );
    const user = result.rows[0];
    if (!user || !user.is_active || !(await verifyPassword(password, user.password_hash))) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    const accessToken = app.jwt.sign({ sub: user.id, role: user.role, type: "access" }, { expiresIn: "15m" });
    const refreshToken = app.jwt.sign({ sub: user.id, role: user.role, type: "refresh" }, { expiresIn: "7d" });

    return reply.send({
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  });

  app.post("/auth/refresh", async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    try {
      const decoded = app.jwt.verify<AccessClaims>(parsed.data.refreshToken);
      if (decoded.type !== "refresh") {
        return reply.code(401).send({ error: "Invalid token type" });
      }
      // Deactivation must take effect immediately, not just at next login — a
      // still-valid refresh token (7-day TTL) would otherwise keep minting
      // fresh access tokens for a deactivated user.
      const result = await app.pg.query<Pick<UserRow, "is_active">>("SELECT is_active FROM auth.users WHERE id = $1", [
        decoded.sub,
      ]);
      if (!result.rows[0]?.is_active) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      const accessToken = app.jwt.sign({ sub: decoded.sub, role: decoded.role, type: "access" }, { expiresIn: "15m" });
      return reply.send({ accessToken });
    } catch {
      return reply.code(401).send({ error: "Invalid or expired refresh token" });
    }
  });

  app.get("/auth/me", async (request, reply) => {
    let claims: AccessClaims;
    try {
      claims = await request.jwtVerify<AccessClaims>();
    } catch {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    if (claims.type !== "access") {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const result = await app.pg.query<UserRow>(
      "SELECT id, email, name, role, is_active FROM auth.users WHERE id = $1",
      [claims.sub],
    );
    const user = result.rows[0];
    if (!user || !user.is_active) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    return reply.send({ id: user.id, email: user.email, name: user.name, role: user.role });
  });
}
