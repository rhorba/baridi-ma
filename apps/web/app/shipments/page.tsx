"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../lib/auth-context";
import { StatusBadge } from "../../components/status-badge";
import type { AdminShipment } from "@baridi-ma/shared-types";

export default function ShipmentsPage() {
  const { user, loading: authLoading, authFetch } = useAuth();
  // Only populated with shipperEmail/carrierEmail/receiverEmail for role=admin
  // (see GET /shipments in services/shipment/src/routes.ts) — safe to type as
  // AdminShipment since those fields are only ever read below when role===admin.
  const [shipments, setShipments] = useState<AdminShipment[] | null>(null);
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
  }, [authLoading, user, authFetch]);

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
          <Link href="/shipments/new" className="rounded bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white">
            + New Shipment
          </Link>
        )}
      </div>
      <Link href="/dashboard" className="mb-4 inline-block text-sm text-[var(--color-secondary)] underline">
        Back to Dashboard
      </Link>

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
                  {user?.role === "admin" && (
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      Shipper: {s.shipperEmail ?? "—"} · Carrier: {s.carrierEmail ?? "—"} · Receiver:{" "}
                      {s.receiverEmail ?? "—"}
                    </p>
                  )}
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
