"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "../../../lib/auth-context";
import { StatusBadge } from "../../../components/status-badge";
import { TemperatureChart } from "../../../components/temperature-chart";
import { AlertsList } from "../../../components/alerts-list";
import type { Shipment, ShipmentStatus, SensorReading, ShipmentAlert } from "@baridi-ma/shared-types";

// Mirrors services/shipment/src/status-transitions.ts — UI affordance only,
// the server is the source of truth and rejects anything invalid regardless.
const NEXT_STATUSES: Record<ShipmentStatus, ShipmentStatus[]> = {
  created: ["in_transit", "cancelled"],
  in_transit: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

const TELEMETRY_POLL_MS = 5000;

export default function ShipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, authFetch } = useAuth();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [alerts, setAlerts] = useState<ShipmentAlert[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [carrierEmail, setCarrierEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [revealedDeviceToken, setRevealedDeviceToken] = useState(searchParams.get("deviceToken"));

  const load = useCallback(async () => {
    const res = await authFetch(`/api/shipments/${id}`);
    if (res.status === 404) {
      setNotFound(true);
      return;
    }
    if (!res.ok) {
      setError("Couldn't load this shipment");
      return;
    }
    setShipment(await res.json());
  }, [id, authFetch]);

  const loadTelemetry = useCallback(async () => {
    const [readingsRes, alertsRes] = await Promise.all([
      authFetch(`/api/shipments/${id}/readings`),
      authFetch(`/api/shipments/${id}/alerts`),
    ]);
    if (readingsRes.ok) setReadings(await readingsRes.json());
    if (alertsRes.ok) setAlerts(await alertsRes.json());
  }, [id, authFetch]);

  useEffect(() => {
    if (authLoading || !user) return;
    load();
    loadTelemetry();
    const interval = setInterval(loadTelemetry, TELEMETRY_POLL_MS);
    return () => clearInterval(interval);
  }, [authLoading, user, load, loadTelemetry]);

  if (authLoading) return <main className="p-6">Loading…</main>;
  if (!user) return <main className="p-6">Not logged in.</main>;
  if (notFound) return <main className="p-6">Shipment not found or access denied.</main>;
  if (!shipment) return <main className="p-6">Loading…</main>;

  async function assignCarrier(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await authFetch(`/api/shipments/${id}/assign-carrier`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carrierEmail }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Couldn't assign carrier");
      return;
    }
    setCarrierEmail("");
    await load();
  }

  async function updateStatus(status: ShipmentStatus) {
    setBusy(true);
    setError(null);
    const res = await authFetch(`/api/shipments/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Couldn't update status");
      return;
    }
    await load();
  }

  const canAssignCarrier = user.role === "shipper" && shipment.shipperId === user.id && shipment.status === "created";
  const canUpdateStatus = user.role === "carrier" && shipment.carrierId === user.id;
  const nextStatuses = NEXT_STATUSES[shipment.status];
  const latest = readings[readings.length - 1];

  return (
    <main className="mx-auto max-w-xl p-6">
      <a href="/shipments" className="mb-4 inline-block text-sm text-[var(--color-secondary)] underline">
        ← Shipments
      </a>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{shipment.productType}</h1>
        <StatusBadge status={shipment.status} />
      </div>
      <p className="text-[var(--color-text-muted)]">
        {shipment.origin} → {shipment.destination}
      </p>
      <p className="mt-2 text-sm">
        Thresholds: {shipment.tempMinC}°C – {shipment.tempMaxC}°C
        {shipment.humidityMinPct !== null && shipment.humidityMaxPct !== null
          ? ` / ${shipment.humidityMinPct}% – ${shipment.humidityMaxPct}% RH`
          : ""}
      </p>

      {latest && (
        <p className="mt-2 text-sm font-medium">
          Current: {latest.temperatureC}°C{latest.humidityPct !== null ? ` ${latest.humidityPct}% RH` : ""}
        </p>
      )}

      {revealedDeviceToken && (
        <div className="mt-4 rounded border border-[var(--color-warning)] bg-amber-50 p-3 text-sm">
          <p className="font-medium">Device token (shown once — save it now)</p>
          <p className="mt-1 break-all font-mono text-xs">{revealedDeviceToken}</p>
          <p className="mt-1 text-[var(--color-text-muted)]">
            Use this to configure the sensor or simulator publishing readings for this shipment.
          </p>
          <button
            onClick={() => setRevealedDeviceToken(null)}
            className="mt-2 text-xs text-[var(--color-secondary)] underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-[var(--color-error)]">
          {error}
        </p>
      )}

      {readings.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 font-medium">Temperature history</h2>
          <TemperatureChart readings={readings} tempMinC={shipment.tempMinC} tempMaxC={shipment.tempMaxC} />
        </div>
      )}

      <div className="mt-6">
        <h2 className="mb-2 font-medium">Alerts</h2>
        <AlertsList alerts={alerts} />
      </div>

      {canAssignCarrier && !shipment.carrierId && (
        <form onSubmit={assignCarrier} className="mt-6 flex flex-col gap-2 rounded border border-slate-200 p-4">
          <h2 className="font-medium">Assign a carrier</h2>
          <input
            type="email"
            required
            placeholder="Carrier email"
            value={carrierEmail}
            onChange={(e) => setCarrierEmail(e.target.value)}
            className="rounded border border-slate-300 bg-[var(--color-surface)] px-3 py-2"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Assign
          </button>
        </form>
      )}

      {canUpdateStatus && nextStatuses.length > 0 && (
        <div className="mt-6 flex flex-col gap-2 rounded border border-slate-200 p-4">
          <h2 className="font-medium">Update status</h2>
          <div className="flex gap-2">
            {nextStatuses.map((s) => (
              <button
                key={s}
                onClick={() => updateStatus(s)}
                disabled={busy}
                className="rounded bg-[var(--color-secondary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Mark {s.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
