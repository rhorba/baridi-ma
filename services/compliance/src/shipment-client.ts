export interface ShipmentDto {
  id: string;
  shipperId: string;
  carrierId: string | null;
  receiverId: string;
  assignedDeviceId: string | null;
  productType: string;
  origin: string;
  destination: string;
  tempMinC: number;
  tempMaxC: number;
  humidityMinPct: number | null;
  humidityMaxPct: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// Compliance Service re-verifies ownership/status itself (ADR-1, defense in
// depth) rather than trusting the caller — it only borrows the shipment's
// data, not any access decision already made elsewhere.
export async function fetchShipment(shipmentId: string): Promise<ShipmentDto | null> {
  const shipmentServiceUrl = process.env.SHIPMENT_SERVICE_URL ?? "http://localhost:4002";
  const res = await fetch(`${shipmentServiceUrl}/internal/shipments/${shipmentId}`, {
    headers: { "x-internal-token": process.env.INTERNAL_SERVICE_TOKEN ?? "" },
  });
  if (!res.ok) return null;
  return res.json();
}
