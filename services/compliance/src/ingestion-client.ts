export interface ReadingDto {
  time: string;
  temperatureC: number;
  humidityPct: number | null;
}

export async function fetchDeviceReadings(deviceId: string): Promise<ReadingDto[]> {
  const ingestionServiceUrl = process.env.INGESTION_SERVICE_URL ?? "http://localhost:4003";
  const res = await fetch(`${ingestionServiceUrl}/internal/devices/${deviceId}/readings`, {
    headers: { "x-internal-token": process.env.INTERNAL_SERVICE_TOKEN ?? "" },
  });
  if (!res.ok) return [];
  return res.json();
}
