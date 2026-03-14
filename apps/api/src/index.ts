import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import type { LlmTraceStatus, RunMode, StateAbbreviation } from "@re-ai/shared";
import { config, SUPPORTED_STATES } from "./config.js";
import { initDb } from "./db.js";
import { createOpenAiProvider } from "./openaiProvider.js";
import {
  createRun,
  getRun,
  getRunIssues,
  listLlmTraces,
  getRunReport,
  getRunStageEvents,
  listRuns,
  mapRunToSummary
} from "./repository.js";
import { processRun } from "./pipeline.js";
import { apiKeyMiddleware } from "./auth.js";
import { fetchBaselineOffers } from "./xano.js";

initDb();
const provider = createOpenAiProvider();

function normalizeCasinoKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

const app = new Hono();
app.use("/api/*", apiKeyMiddleware);

app.get("/api/health", (c) =>
  c.json({ ok: true, service: "re-ai-api", time: new Date().toISOString() })
);

app.get("/api/runs", (c) => {
  const items = listRuns(30);
  return c.json({ items });
});

app.get("/api/baseline/stats", async (c) => {
  const baseline = await fetchBaselineOffers();
  const states = ["NJ", "MI", "PA", "WV"] as const;
  const byState = states.map((state) => {
    const stateRows = baseline.filter((item) => item.state === state);
    return {
      state,
      trackedCasinos: new Set(stateRows.map((item) => item.casinoName.toLowerCase().trim())).size,
      offerRows: stateRows.length
    };
  });
  return c.json({
    totalTrackedCasinos: new Set(
      baseline.map((item) => `${item.state}::${item.casinoName.toLowerCase().trim()}`)
    ).size,
    totalOfferRows: baseline.length,
    byState
  });
});

app.get("/api/baseline/casinos", async (c) => {
  const baseline = await fetchBaselineOffers();
  const byCasino = new Map<
    string,
    { state: StateAbbreviation; casinoName: string; offerCount: number; bestKnownBonus: number; headlineOffer: string }
  >();

  for (const item of baseline) {
    const key = `${item.state}::${normalizeCasinoKey(item.casinoName)}`;
    const current = byCasino.get(key);
    if (!current) {
      byCasino.set(key, {
        state: item.state,
        casinoName: item.casinoName,
        offerCount: 1,
        bestKnownBonus: item.expectedBonus,
        headlineOffer: item.offerName
      });
      continue;
    }
    current.offerCount += 1;
    if (item.expectedBonus > current.bestKnownBonus) {
      current.bestKnownBonus = item.expectedBonus;
      current.headlineOffer = item.offerName;
    }
  }

  const items = Array.from(byCasino.values()).sort((a, b) => {
    if (a.state !== b.state) return a.state.localeCompare(b.state);
    return a.casinoName.localeCompare(b.casinoName);
  });

  return c.json({ items });
});

app.get("/api/baseline/offers", async (c) => {
  const baseline = await fetchBaselineOffers();
  const stateQuery = (c.req.query("state") ?? "").toUpperCase();
  const casinoQuery = (c.req.query("casino") ?? "").trim().toLowerCase();

  const filtered = baseline.filter((item) => {
    if (stateQuery && item.state !== stateQuery) return false;
    if (casinoQuery && item.casinoName.toLowerCase().trim() !== casinoQuery) return false;
    return true;
  });

  const items = filtered.sort((a, b) => {
    if (a.state !== b.state) return a.state.localeCompare(b.state);
    if (a.casinoName !== b.casinoName) return a.casinoName.localeCompare(b.casinoName);
    return a.offerName.localeCompare(b.offerName);
  });

  return c.json({ items });
});

app.post("/api/runs", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    states?: StateAbbreviation[];
    mode?: RunMode;
    maxCasinos?: number;
  };
  const mode: RunMode =
    body.mode === "discover_casinos" || body.mode === "discover_offers" || body.mode === "full"
      ? body.mode
      : "full";

  const requestedStates = (body.states ?? [...SUPPORTED_STATES]).filter((state): state is StateAbbreviation =>
    SUPPORTED_STATES.includes(state)
  );
  const states = requestedStates.length > 0 ? requestedStates : [...SUPPORTED_STATES];
  const maxCasinos =
    typeof body.maxCasinos === "number" && Number.isFinite(body.maxCasinos) && body.maxCasinos > 0
      ? Math.floor(body.maxCasinos)
      : undefined;

  const runId = randomUUID();
  createRun({ id: runId, trigger: "manual", mode, states });

  void processRun({ runId, states, mode, maxCasinosPerRun: maxCasinos, provider });

  return c.json({ runId, status: "queued", mode, maxCasinos }, 202);
});

app.post("/api/internal/scheduled-run", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    states?: StateAbbreviation[];
    mode?: RunMode;
    maxCasinos?: number;
  };
  const mode: RunMode =
    body.mode === "discover_casinos" || body.mode === "discover_offers" || body.mode === "full"
      ? body.mode
      : "full";

  const requestedStates = (body.states ?? [...SUPPORTED_STATES]).filter((state): state is StateAbbreviation =>
    SUPPORTED_STATES.includes(state)
  );
  const states = requestedStates.length > 0 ? requestedStates : [...SUPPORTED_STATES];
  const maxCasinos =
    typeof body.maxCasinos === "number" && Number.isFinite(body.maxCasinos) && body.maxCasinos > 0
      ? Math.floor(body.maxCasinos)
      : undefined;

  const runId = randomUUID();
  createRun({ id: runId, trigger: "scheduled", mode, states });

  void processRun({ runId, states, mode, maxCasinosPerRun: maxCasinos, provider });

  return c.json({ runId, status: "queued", trigger: "scheduled", mode, maxCasinos }, 202);
});

app.get("/api/runs/:runId", (c) => {
  const run = getRun(c.req.param("runId"));
  if (!run) {
    return c.json({ error: "Run not found" }, 404);
  }
  return c.json({ run: mapRunToSummary(run), error: run.error_message ?? undefined });
});

app.get("/api/runs/:runId/report", (c) => {
  const report = getRunReport(c.req.param("runId"));
  if (!report) {
    return c.json({ error: "Report not found" }, 404);
  }
  return c.json(report);
});

app.get("/api/runs/:runId/logs", (c) => {
  const runId = c.req.param("runId");
  const run = getRun(runId);
  if (!run) {
    return c.json({ error: "Run not found" }, 404);
  }
  return c.json({
    stageEvents: getRunStageEvents(runId),
    issues: getRunIssues(runId)
  });
});

app.get("/api/runs/:runId/llm-traces", (c) => {
  const runId = c.req.param("runId");
  const run = getRun(runId);
  if (!run) {
    return c.json({ error: "Run not found" }, 404);
  }

  const stageQuery = c.req.query("stage");
  const stage =
    stageQuery === "casino_discovery" || stageQuery === "offer_discovery" ? stageQuery : undefined;

  const statusQuery = c.req.query("status");
  const status: LlmTraceStatus | undefined =
    statusQuery === "parsed" || statusQuery === "parse_failed" || statusQuery === "request_failed"
      ? statusQuery
      : undefined;

  const limitRaw = Number(c.req.query("limit") ?? 200);
  const limit = Number.isFinite(limitRaw) ? limitRaw : 200;
  const items = listLlmTraces({ runId, stage, status, limit });

  return c.json({ items });
});

serve({
  fetch: app.fetch,
  port: config.PORT
});

console.log(`API listening on http://localhost:${config.PORT}`);
