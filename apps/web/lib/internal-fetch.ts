// Security baseline §7: MVP internal service trust is a shared-secret header,
// not mTLS. Every BFF -> internal-service call carries this so services can
// (eventually) reject requests that didn't come through the BFF.
export function internalHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-internal-token": process.env.INTERNAL_SERVICE_TOKEN ?? "",
    ...extra,
  };
}
