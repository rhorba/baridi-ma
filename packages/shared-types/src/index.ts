export type Role = "shipper" | "carrier" | "receiver" | "admin";

export type ShipmentStatus = "created" | "in_transit" | "delivered" | "cancelled";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface JwtClaims {
  sub: string; // user id
  role: Role;
  type: "access" | "refresh";
  iat: number;
  exp: number;
}

export interface Shipment {
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
  status: ShipmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SensorReading {
  time: string;
  temperatureC: number;
  humidityPct: number | null;
}

export type AlertReason = "temp_high" | "temp_low" | "humidity_high" | "humidity_low";

export interface ShipmentAlert {
  id: string;
  shipmentId: string;
  deviceId: string;
  readingTime: string;
  reason: AlertReason;
  value: number;
  threshold: number;
  createdAt: string;
}

// ADR-4: payments are a port/adapter — MVP ships only a stub implementation.
export interface PaymentProvider {
  charge(shipmentId: string, amountMad: number): Promise<{ status: "succeeded" | "failed"; reference: string }>;
  refund(reference: string): Promise<{ status: "succeeded" | "failed" }>;
  getStatus(reference: string): Promise<"pending" | "succeeded" | "failed">;
}
