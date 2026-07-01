import { describe, it, expect } from "vitest";
import { GET } from "../app/api/health/route";

describe("GET /api/health", () => {
  it("returns ok status for the web service", async () => {
    const response = GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ok", service: "web" });
  });
});
