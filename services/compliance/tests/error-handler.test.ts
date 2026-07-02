import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { registerErrorHandler } from "../src/error-handler.js";

function buildApp() {
  const app = Fastify();
  registerErrorHandler(app);
  app.get("/boom-500", async () => {
    throw new Error("upstream fetch failed: connect ECONNREFUSED");
  });
  app.get("/boom-400", async () => {
    const err = Object.assign(new Error("Bad request"), { statusCode: 400 });
    throw err;
  });
  return app;
}

describe("registerErrorHandler", () => {
  it("masks internal error details on 5xx", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/boom-500" });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "Internal server error" });
    expect(res.body).not.toContain("ECONNREFUSED");
  });

  it("passes through the message on 4xx", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/boom-400" });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "Bad request" });
  });
});
