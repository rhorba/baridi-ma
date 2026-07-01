import { describe, it, expect } from "vitest";
import { internalHeaders } from "../lib/internal-fetch";

describe("internalHeaders", () => {
  it("includes the internal service token and content type", () => {
    const headers = internalHeaders();
    expect(headers["x-internal-token"]).toBe("test-internal-token");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("merges extra headers without dropping the internal token", () => {
    const headers = internalHeaders({ authorization: "Bearer abc" });
    expect(headers.authorization).toBe("Bearer abc");
    expect(headers["x-internal-token"]).toBe("test-internal-token");
  });
});
