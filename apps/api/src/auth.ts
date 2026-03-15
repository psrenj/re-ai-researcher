import { timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";
import { config } from "./config.js";

function secureEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export const apiKeyMiddleware: MiddlewareHandler = async (c, next) => {
  if (c.req.path === "/api/health") {
    await next();
    return;
  }

  const supplied = c.req.header("x-api-key") ?? "";
  if (!supplied || !secureEquals(supplied, config.API_KEY)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
};
