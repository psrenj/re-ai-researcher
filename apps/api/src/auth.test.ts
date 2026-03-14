import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { apiKeyMiddleware } from "./auth.js";

describe("apiKeyMiddleware", () => {
  it("allows health endpoint without key", async () => {
    const app = new Hono();
    app.use("/api/*", apiKeyMiddleware);
    app.get("/api/health", (c) => c.json({ ok: true }));

    const res = await app.request("http://localhost/api/health");
    expect(res.status).toBe(200);
  });

  it("rejects protected endpoint without key", async () => {
    const app = new Hono();
    app.use("/api/*", apiKeyMiddleware);
    app.get("/api/runs", (c) => c.json({ ok: true }));

    const res = await app.request("http://localhost/api/runs");
    expect(res.status).toBe(401);
  });
});
