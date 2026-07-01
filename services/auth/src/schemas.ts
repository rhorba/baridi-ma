import { z } from "zod";

// Security baseline §3: min 10 chars, checked against a common-password blocklist.
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "12345678", "123456789",
  "qwerty123", "letmein123", "admin1234", "welcome123", "iloveyou1",
  "changeme1", "baridi1234", "morocco123",
]);

// Admin is never self-service — public registration would be a privilege-escalation hole.
const REGISTERABLE_ROLES = ["shipper", "carrier", "receiver"] as const;

export const registerSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(10, "Password must be at least 10 characters")
    .refine((p) => !COMMON_PASSWORDS.has(p.toLowerCase()), "Password is too common"),
  name: z.string().min(1),
  phone: z.string().optional(),
  role: z.enum(REGISTERABLE_ROLES),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const refreshSchema = z.object({
  refreshToken: z.string(),
});
