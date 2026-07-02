"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../lib/auth-context";

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  if (loading) {
    return <main className="p-6">Loading…</main>;
  }
  if (!user) {
    return <main className="p-6">Not logged in.</main>;
  }

  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">Welcome, {user.name}</h1>
      <p className="text-[var(--color-text-muted)]">Role: {user.role}</p>
      <Link
        href="/shipments"
        className="mt-4 inline-block rounded bg-[var(--color-primary)] px-4 py-2 font-medium text-white"
      >
        View Shipments
      </Link>
      {user.role === "admin" && (
        <Link
          href="/admin/users"
          className="mt-4 ml-2 inline-block rounded bg-[var(--color-secondary)] px-4 py-2 font-medium text-white"
        >
          Admin
        </Link>
      )}
      <button
        onClick={handleLogout}
        className="mt-4 ml-2 rounded bg-[var(--color-secondary)] px-4 py-2 font-medium text-white"
      >
        Log out
      </button>
    </main>
  );
}
