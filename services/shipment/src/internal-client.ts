import type { Role } from "@baridi-ma/shared-types";

interface LookupResult {
  id: string;
  email: string;
  name: string;
  role: Role;
}

// FK to auth.users is enforced at the app layer (per Database design doc §7) —
// this is that enforcement: resolve an email to a real, correctly-roled user
// before writing it into a shipment record.
export async function lookupUserByEmail(email: string, role?: Role): Promise<LookupResult | null> {
  const authServiceUrl = process.env.AUTH_SERVICE_URL ?? "http://localhost:4001";
  const params = new URLSearchParams({ email });
  if (role) params.set("role", role);

  const res = await fetch(`${authServiceUrl}/internal/users/lookup?${params.toString()}`, {
    headers: { "x-internal-token": process.env.INTERNAL_SERVICE_TOKEN ?? "" },
  });
  if (!res.ok) return null;
  return res.json();
}

// Story 5.2 (admin shipment oversight): resolve shipper/carrier/receiver
// display info in one round trip rather than one lookup per shipment.
export async function lookupUsersByIds(ids: string[]): Promise<LookupResult[]> {
  if (ids.length === 0) return [];
  const authServiceUrl = process.env.AUTH_SERVICE_URL ?? "http://localhost:4001";
  const res = await fetch(`${authServiceUrl}/internal/users/by-ids?ids=${ids.join(",")}`, {
    headers: { "x-internal-token": process.env.INTERNAL_SERVICE_TOKEN ?? "" },
  });
  if (!res.ok) return [];
  return res.json();
}
