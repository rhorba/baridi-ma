import { jwtVerify } from "jose";
import type { Role } from "@baridi-ma/shared-types";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export interface AccessClaims {
  sub: string;
  role: Role;
  type: "access" | "refresh";
}

export async function verifyToken(token: string): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as AccessClaims;
  } catch {
    return null;
  }
}
