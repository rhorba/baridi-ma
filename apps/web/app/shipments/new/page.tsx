"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../lib/auth-context";

export default function NewShipmentPage() {
  const { user, loading: authLoading, authFetch } = useAuth();
  const router = useRouter();
  const [productType, setProductType] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [receiverEmail, setReceiverEmail] = useState("");
  const [tempMinC, setTempMinC] = useState("2");
  const [tempMaxC, setTempMaxC] = useState("8");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (authLoading) {
    return <main className="p-6">Loading…</main>;
  }
  if (!user) {
    return <main className="p-6">Not logged in.</main>;
  }
  if (user.role !== "shipper") {
    return <main className="p-6">Only shippers can create shipments.</main>;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await authFetch("/api/shipments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productType,
        origin,
        destination,
        receiverEmail,
        tempMinC: Number(tempMinC),
        tempMaxC: Number(tempMaxC),
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Couldn't create shipment");
      return;
    }
    // deviceToken is only ever returned here, at creation — carry it to the
    // detail page for a one-time reveal banner (see ShipmentDetailPage).
    router.push(`/shipments/${data.id}?deviceToken=${encodeURIComponent(data.deviceToken)}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-4">
      <h1 className="text-xl font-semibold">New Shipment</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          required
          placeholder="Product type (e.g. Dairy)"
          value={productType}
          onChange={(e) => setProductType(e.target.value)}
          className="rounded border border-slate-300 bg-[var(--color-surface)] px-3 py-2"
        />
        <input
          type="text"
          required
          placeholder="Origin"
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          className="rounded border border-slate-300 bg-[var(--color-surface)] px-3 py-2"
        />
        <input
          type="text"
          required
          placeholder="Destination"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          className="rounded border border-slate-300 bg-[var(--color-surface)] px-3 py-2"
        />
        <input
          type="email"
          required
          placeholder="Receiver email"
          value={receiverEmail}
          onChange={(e) => setReceiverEmail(e.target.value)}
          className="rounded border border-slate-300 bg-[var(--color-surface)] px-3 py-2"
        />
        <div className="flex gap-3">
          <input
            type="number"
            required
            step="0.1"
            placeholder="Min °C"
            value={tempMinC}
            onChange={(e) => setTempMinC(e.target.value)}
            className="w-1/2 rounded border border-slate-300 bg-[var(--color-surface)] px-3 py-2"
          />
          <input
            type="number"
            required
            step="0.1"
            placeholder="Max °C"
            value={tempMaxC}
            onChange={(e) => setTempMaxC(e.target.value)}
            className="w-1/2 rounded border border-slate-300 bg-[var(--color-surface)] px-3 py-2"
          />
        </div>
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
          {submitting ? "Creating…" : "Create Shipment"}
        </button>
      </form>
      <a href="/shipments" className="text-sm text-[var(--color-secondary)] underline">
        Cancel
      </a>
    </main>
  );
}
