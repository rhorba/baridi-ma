import type { ShipmentAlert } from "@baridi-ma/shared-types";

const REASON_LABELS: Record<string, string> = {
  temp_high: "Temperature too high",
  temp_low: "Temperature too low",
  humidity_high: "Humidity too high",
  humidity_low: "Humidity too low",
};

export function AlertsList({ alerts }: { alerts: ShipmentAlert[] }) {
  if (alerts.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">No alerts — all readings within range.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {alerts.map((a) => (
        <li key={a.id} className="rounded border border-[var(--color-error)] bg-red-50 p-3 text-sm">
          <p className="font-medium text-[var(--color-error)]">⚠ {REASON_LABELS[a.reason] ?? a.reason}</p>
          <p className="text-[var(--color-text-muted)]">
            {a.value} (threshold {a.threshold}) at {new Date(a.readingTime).toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
  );
}
