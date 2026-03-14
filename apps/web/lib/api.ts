import type { LlmTrace, LlmTraceStatus, RunMode, RunReport, RunSummary } from "@re-ai/shared";

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

async function callApi<T>(path: string, init?: RequestInit): Promise<T> {
  const API_BASE_URL = readEnv("API_BASE_URL") ?? "http://localhost:8787";
  const API_KEY = readEnv("API_KEY");

  if (!API_KEY) {
    throw new Error("API_KEY is required for web server API calls");
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-api-key": API_KEY,
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  const payload = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(payload.error ?? `API request failed: ${res.status}`);
  }

  return payload;
}

export async function listRuns(): Promise<RunSummary[]> {
  const payload = await callApi<{ items: RunSummary[] }>("/api/runs");
  return payload.items;
}

export async function getBaselineStats(): Promise<{
  totalTrackedCasinos: number;
  totalOfferRows: number;
  byState: Array<{ state: "NJ" | "MI" | "PA" | "WV"; trackedCasinos: number; offerRows: number }>;
}> {
  return callApi("/api/baseline/stats");
}

export async function getBaselineCasinos(): Promise<
  Array<{
    state: "NJ" | "MI" | "PA" | "WV";
    casinoName: string;
    offerCount: number;
    bestKnownBonus: number;
    headlineOffer: string;
  }>
> {
  const payload = await callApi<{
    items: Array<{
      state: "NJ" | "MI" | "PA" | "WV";
      casinoName: string;
      offerCount: number;
      bestKnownBonus: number;
      headlineOffer: string;
    }>;
  }>("/api/baseline/casinos");
  return payload.items;
}

export async function getBaselineOffers(params?: {
  state?: "NJ" | "MI" | "PA" | "WV";
  casino?: string;
}): Promise<
  Array<{
    state: "NJ" | "MI" | "PA" | "WV";
    casinoName: string;
    offerName: string;
    offerType?: string;
    expectedDeposit: number;
    expectedBonus: number;
  }>
> {
  const search = new URLSearchParams();
  if (params?.state) search.set("state", params.state);
  if (params?.casino) search.set("casino", params.casino);
  const query = search.toString();
  const payload = await callApi<{
    items: Array<{
      state: "NJ" | "MI" | "PA" | "WV";
      casinoName: string;
      offerName: string;
      offerType?: string;
      expectedDeposit: number;
      expectedBonus: number;
    }>;
  }>(`/api/baseline/offers${query ? `?${query}` : ""}`);
  return payload.items;
}

export async function getRun(runId: string): Promise<RunSummary> {
  const payload = await callApi<{ run: RunSummary }>(`/api/runs/${runId}`);
  return payload.run;
}

export async function getRunReport(runId: string): Promise<RunReport> {
  return callApi<RunReport>(`/api/runs/${runId}/report`);
}

export async function getRunLogs(runId: string): Promise<{
  stageEvents: RunReport["stageEvents"];
  issues: RunReport["issues"];
}> {
  return callApi(`/api/runs/${runId}/logs`);
}

export async function getRunLlmTraces(
  runId: string,
  params?: {
    stage?: "casino_discovery" | "offer_discovery";
    status?: LlmTraceStatus;
    limit?: number;
  }
): Promise<LlmTrace[]> {
  const search = new URLSearchParams();
  if (params?.stage) search.set("stage", params.stage);
  if (params?.status) search.set("status", params.status);
  if (params?.limit) search.set("limit", String(params.limit));

  const query = search.toString();
  const payload = await callApi<{ items: LlmTrace[] }>(
    `/api/runs/${runId}/llm-traces${query ? `?${query}` : ""}`
  );
  return payload.items;
}

export async function triggerRun(params?: {
  states?: string[];
  mode?: RunMode;
}): Promise<{ runId: string; mode: RunMode }> {
  return callApi<{ runId: string; mode: RunMode }>("/api/runs", {
    method: "POST",
    body: JSON.stringify({
      ...(params?.states ? { states: params.states } : {}),
      ...(params?.mode ? { mode: params.mode } : {})
    })
  });
}
