export interface ReadingDto {
  time: string;
  temperatureC: number;
  humidityPct: number | null;
}

export interface AlertDto {
  id: string;
  shipmentId: string;
  deviceId: string;
  readingTime: string;
  reason: string;
  value: number;
  threshold: number;
  createdAt: string;
}

const internalHeaders = () => ({ "x-internal-token": process.env.INTERNAL_SERVICE_TOKEN ?? "" });

// Shipment Service already verified the requesting user owns this shipment
// (see routes.ts) — these calls trust that check and don't re-authenticate
// the end user, matching the pattern established for Auth Service lookups.
export async function fetchDeviceReadings(deviceId: string): Promise<ReadingDto[]> {
  const ingestionServiceUrl = process.env.INGESTION_SERVICE_URL ?? "http://localhost:4003";
  const res = await fetch(`${ingestionServiceUrl}/internal/devices/${deviceId}/readings`, {
    headers: internalHeaders(),
  });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchShipmentAlerts(shipmentId: string): Promise<AlertDto[]> {
  const alertingServiceUrl = process.env.ALERTING_SERVICE_URL ?? "http://localhost:4004";
  const params = new URLSearchParams({ shipmentId });
  const res = await fetch(`${alertingServiceUrl}/internal/alerts?${params.toString()}`, {
    headers: internalHeaders(),
  });
  if (!res.ok) return [];
  return res.json();
}
