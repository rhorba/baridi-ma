export type ShipmentStatus = "created" | "in_transit" | "delivered" | "cancelled";

const VALID_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  created: ["in_transit", "cancelled"],
  in_transit: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export function isValidTransition(from: ShipmentStatus, to: ShipmentStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
