"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../lib/auth-context";
import type { Role } from "@baridi-ma/shared-types";

// Admin is never self-service — see services/auth/src/schemas.ts.
const REGISTERABLE_ROLES: Exclude<Role, "admin">[] = ["shipper", "carrier", "receiver"];

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Exclude<Role, "admin">>("shipper");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await register({ email, password, name, role });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "Registration failed");
      return;
    }
    router.push("/login");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4">
      <h1 className="text-xl font-semibold">Create your Baridi.ma account</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          required
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded border border-slate-300 bg-[var(--color-surface)] px-3 py-2"
        />
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border border-slate-300 bg-[var(--color-surface)] px-3 py-2"
        />
        <input
          type="password"
          required
          minLength={10}
          placeholder="Password (min 10 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border border-slate-300 bg-[var(--color-surface)] px-3 py-2"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Exclude<Role, "admin">)}
          className="rounded border border-slate-300 bg-[var(--color-surface)] px-3 py-2"
        >
          {REGISTERABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </option>
          ))}
        </select>
        {error && (
          <p role="alert" className="text-sm text-[var(--color-error)]">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-[var(--color-primary)] px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Creating account…" : "Register"}
        </button>
      </form>
      <Link href="/login" className="text-sm text-[var(--color-secondary)] underline">
        Already have an account? Log in
      </Link>
    </main>
  );
}
