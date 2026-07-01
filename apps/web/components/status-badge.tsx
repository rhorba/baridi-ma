import type { ShipmentStatus } from "@baridi-ma/shared-types";

const STYLES: Record<ShipmentStatus, { bg: string; text: string; label: string }> = {
  created: { bg: "bg-slate-100", text: "text-slate-700", label: "Created" },
  in_transit: { bg: "bg-blue-100", text: "text-blue-700", label: "In Transit" },
  delivered: { bg: "bg-green-100", text: "text-[var(--color-success)]", label: "Delivered" },
  cancelled: { bg: "bg-red-100", text: "text-[var(--color-error)]", label: "Cancelled" },
};

export function StatusBadge({ status }: { status: ShipmentStatus }) {
  const style = STYLES[status];
  return (
    <span className={`inline-block rounded px-2 py-1 text-xs font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}
