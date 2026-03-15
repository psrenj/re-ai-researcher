import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import type { LlmTraceStatus, RunMode, StateAbbreviation } from "@re-ai/shared";
import { config, SUPPORTED_STATES } from "./config.js";
import { initDb } from "./db.js";
import { createOpenAiProvider } from "./openaiProvider.js";
import {
  createRun,
  getLatestBaselineSnapshot,
  getRun,
  getRunIssues,
  listLlmTraces,
  getRunReport,
  getRunStageEvents,
  listRuns,
  mapRunToSummary,
  requestRunCancellation,
  resolveRunReference
} from "./repository.js";
import { processRun } from "./pipeline.js";
import { apiKeyMiddleware } from "./auth.js";
import { fetchBaselineOffers } from "./xano.js";
import type { BaselineOffer } from "./types.js";

initDb();
const provider = createOpenAiProvider();

async function loadBaselineOffersWithFallback(): Promise<BaselineOffer[]> {
  try {
    const live = await fetchBaselineOffers();
    if (live.length > 0) {
      return live;
    }
  } catch {
    // Ignore live-baseline fetch failures and fallback to latest snapshot.
  }

  const snapshot = getLatestBaselineSnapshot();
  if (snapshot && snapshot.length > 0) {
    return snapshot;
  }

  return [];
}

function normalizeCasinoKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

function parseRunMode(value: unknown): RunMode {
  if (value === "discover_casinos" || value === "discover_offers" || value === "full") {
    return value;
  }
  return "full";
}

function parseRunStates(value: unknown): StateAbbreviation[] {
  if (!Array.isArray(value)) {
    return [...SUPPORTED_STATES];
  }

  const requestedStates = value.filter((state): state is StateAbbreviation =>
    SUPPORTED_STATES.includes(state as StateAbbreviation)
  );
  return requestedStates.length > 0 ? requestedStates : [...SUPPORTED_STATES];
}

function parseMaxCasinos(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.floor(value);
}

async function queueRun(params: {
  trigger: "manual" | "scheduled";
  body: unknown;
  provider: ReturnType<typeof createOpenAiProvider>;
}): Promise<{ runId: string; status: "queued"; trigger?: "scheduled"; mode: RunMode; maxCasinos?: number }> {
  const payload =
    params.body && typeof params.body === "object"
      ? (params.body as { states?: unknown; mode?: unknown; maxCasinos?: unknown })
      : {};
  const mode = parseRunMode(payload.mode);
  const states = parseRunStates(payload.states);
  const maxCasinos = parseMaxCasinos(payload.maxCasinos);

  const runId = randomUUID();
  createRun({ id: runId, trigger: params.trigger, mode, states });
  void processRun({ runId, states, mode, maxCasinosPerRun: maxCasinos, provider: params.provider });

  return {
    runId,
    status: "queued",
    ...(params.trigger === "scheduled" ? { trigger: "scheduled" as const } : {}),
    mode,
    maxCasinos
  };
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
  const baseline = await loadBaselineOffersWithFallback();
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
  const baseline = await loadBaselineOffersWithFallback();
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
  const baseline = await loadBaselineOffersWithFallback();
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
  const body = await c.req.json().catch(() => ({}));
  const queued = await queueRun({ trigger: "manual", body, provider });
  return c.json(queued, 202);
});

app.post("/api/internal/scheduled-run", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const queued = await queueRun({ trigger: "scheduled", body, provider });
  return c.json(queued, 202);
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

app.post("/api/runs/:runId/cancel", (c) => {
  const runRef = c.req.param("runId");
  const resolution = resolveRunReference(runRef);

  if (resolution.status === "not_found") {
    return c.json({ error: "Run not found", runRef }, 404);
  }
  if (resolution.status === "ambiguous") {
    return c.json(
      {
        error: "Ambiguous run id prefix",
        runRef,
        matches: resolution.matches
      },
      409
    );
  }

  const result = requestRunCancellation(resolution.runId);
  if (result.status === "not_found") {
    return c.json({ error: "Run not found", runRef }, 404);
  }
  if (result.status === "not_active") {
    return c.json(
      {
        error: "Run is not active",
        runId: result.runId,
        status: result.currentStatus
      },
      409
    );
  }

  return c.json({
    cancelled: true,
    runId: result.runId,
    previousStatus: result.previousStatus,
    matchedBy: resolution.matchedBy
  });
});

serve({
  fetch: app.fetch,
  port: config.PORT
});

console.log(`API listening on http://localhost:${config.PORT}`);
