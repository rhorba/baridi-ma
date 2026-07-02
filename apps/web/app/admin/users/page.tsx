"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "../../../lib/auth-context";
import type { AdminUserSummary } from "@baridi-ma/shared-types";

export default function AdminUsersPage() {
  const { user, loading: authLoading, authFetch } = useAuth();
  const [users, setUsers] = useState<AdminUserSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await authFetch("/api/admin/users");
    if (!res.ok) {
      setError(res.status === 403 ? "Admin access required" : "Couldn't load users");
      return;
    }
    setUsers(await res.json());
  }, [authFetch]);

  useEffect(() => {
    if (authLoading || !user) return;
    load();
  }, [authLoading, user, load]);

  async function deactivate(id: string) {
    setBusyId(id);
    setError(null);
    const res = await authFetch(`/api/admin/users/${id}/deactivate`, { method: "PATCH" });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Couldn't deactivate user");
      return;
    }
    await load();
  }

  if (authLoading) return <main className="p-6">Loading…</main>;
  if (!user) return <main className="p-6">Not logged in.</main>;

  return (
    <main className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Users</h1>
      <Link href="/dashboard" className="mb-4 inline-block text-sm text-[var(--color-secondary)] underline">
        Back to Dashboard
      </Link>

      {error && (
        <p role="alert" className="mt-2 text-sm text-[var(--color-error)]">
          {error}
        </p>
      )}

      {users && (
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[var(--color-text-muted)]">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Role</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-100">
                <td className="py-2 pr-4">{u.name}</td>
                <td className="py-2 pr-4">{u.email}</td>
                <td className="py-2 pr-4 capitalize">{u.role}</td>
                <td className="py-2 pr-4">{u.isActive ? "Active" : "Deactivated"}</td>
                <td className="py-2 pr-4">
                  {u.isActive && u.id !== user.id && (
                    <button
                      onClick={() => deactivate(u.id)}
                      disabled={busyId === u.id}
                      className="rounded bg-[var(--color-secondary)] px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                    >
                      Deactivate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
