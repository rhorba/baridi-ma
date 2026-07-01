"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth-context";
import { StatusBadge } from "../../components/status-badge";
import type { Shipment } from "@baridi-ma/shared-types";

export default function ShipmentsPage() {
  const { user, loading: authLoading, authFetch } = useAuth();
  const [shipments, setShipments] = useState<Shipment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      const res = await authFetch("/api/shipments");
      if (!res.ok) {
        setError("Couldn't load shipments, retry");
        return;
      }
      setShipments(await res.json());
    })();
  }, [authLoading, user]);

  if (authLoading) {
    return <main className="p-6">Loading…</main>;
  }
  if (!user) {
    return <main className="p-6">Not logged in.</main>;
  }

  return (
    <main className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Shipments</h1>
        {user?.role === "shipper" && (
          <a href="/shipments/new" className="rounded bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white">
            + New Shipment
          </a>
        )}
      </div>
      <a href="/dashboard" className="mb-4 inline-block text-sm text-[var(--color-secondary)] underline">
        Back to Dashboard
      </a>

      {error && <p className="text-[var(--color-error)]">{error}</p>}

      {shipments && shipments.length === 0 && (
        <p className="text-[var(--color-text-muted)]">
          No shipments yet{user?.role === "shipper" ? " — create your first shipment" : ""}.
        </p>
      )}

      {shipments && shipments.length > 0 && (
        <ul className="flex flex-col gap-2">
          {shipments.map((s) => (
            <li key={s.id}>
              <a
                href={`/shipments/${s.id}`}
                className="flex items-center justify-between rounded border border-slate-200 bg-[var(--color-surface)] p-3 hover:border-[var(--color-primary)]"
              >
                <div>
                  <p className="font-medium">{s.productType}</p>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {s.origin} → {s.destination}
                  </p>
                </div>
                <StatusBadge status={s.status} />
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
