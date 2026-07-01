export interface DeviceInfo {
  deviceId: string;
  shipmentId: string;
  tempMinC: number;
  tempMaxC: number;
  humidityMinPct: number | null;
  humidityMaxPct: number | null;
}

// FK to shipment.devices is enforced at the app layer, via Shipment Service —
// same pattern as Shipment Service resolving receiver/carrier emails via Auth Service.
export async function validateDevice(token: string): Promise<DeviceInfo | null> {
  const shipmentServiceUrl = process.env.SHIPMENT_SERVICE_URL ?? "http://localhost:4002";
  const res = await fetch(
    `${shipmentServiceUrl}/internal/devices/validate?token=${encodeURIComponent(token)}`,
    { headers: { "x-internal-token": process.env.INTERNAL_SERVICE_TOKEN ?? "" } },
  );
  if (!res.ok) return null;
  return res.json();
}
