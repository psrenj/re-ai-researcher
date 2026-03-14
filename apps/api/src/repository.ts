import type {
  DiscoveredCasinoCoverage,
  LlmTrace,
  LlmTraceStatus,
  DiscoveredOffer,
  OfferComparison,
  RunMode,
  RunIssue,
  RunReport,
  RunStageEvent,
  RunSummary,
  StateAbbreviation
} from "@re-ai/shared";
import { sqlite } from "./db.js";
import type { BaselineOffer, DiscoveredCasino, PipelineResult, RunUsage } from "./types.js";
import { nowIso } from "./utils.js";

interface RunRow {
  id: string;
  trigger: "manual" | "scheduled";
  mode: RunMode;
  status: "queued" | "running" | "completed" | "failed";
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  summary_json: string | null;
  report_json: string | null;
  usage_json: string | null;
  states_json: string;
  error_message: string | null;
}

interface RunIssueRow {
  severity: "low" | "medium" | "high";
  category: string;
  title: string;
  details: string;
  status: "open" | "resolved";
}

interface RunStageEventRow {
  stage: string;
  status: "completed" | "skipped" | "failed";
  reason: string | null;
  impact: string | null;
  suggested_next_step: string | null;
  created_at: string;
}

interface LlmTraceRow {
  id: number;
  run_id: string;
  stage: "casino_discovery" | "offer_discovery";
  target: string;
  model: string;
  attempt: number;
  status: LlmTraceStatus;
  input_text: string;
  raw_response_json: string | null;
  extracted_text: string | null;
  error_message: string | null;
  latency_ms: number;
  created_at: string;
}

interface DiscoveredCasinoRow {
  state: string;
  casino_name: string;
  confidence: number;
  is_missing: number;
  citations_json: string;
}

interface ReportSnapshotPayload {
  discoveredCasinos: DiscoveredCasino[];
  missingCasinos: PipelineResult["missingCasinos"];
  offerComparisons: PipelineResult["offerComparisons"];
  issues: PipelineResult["issues"];
  usage: RunUsage;
}

export function createRun(params: {
  id: string;
  trigger: "manual" | "scheduled";
  mode: RunMode;
  states: StateAbbreviation[];
}): void {
  const stmt = sqlite.prepare(`
    INSERT INTO runs (id, trigger, mode, status, states_json, created_at)
    VALUES (?, ?, ?, 'queued', ?, ?)
  `);
  stmt.run(params.id, params.trigger, params.mode, JSON.stringify(params.states), nowIso());
}

export function setRunRunning(id: string): void {
  sqlite
    .prepare(`UPDATE runs SET status = 'running', started_at = ? WHERE id = ?`)
    .run(nowIso(), id);
}

export function setRunFailed(id: string, message: string): void {
  sqlite
    .prepare(`UPDATE runs SET status = 'failed', completed_at = ?, error_message = ? WHERE id = ?`)
    .run(nowIso(), message, id);
}

export function setRunCompleted(params: {
  id: string;
  summary: RunSummary;
  report: RunReport;
  usage: RunUsage;
}): void {
  sqlite
    .prepare(
      `UPDATE runs
         SET status = 'completed', completed_at = ?, summary_json = ?, report_json = ?, usage_json = ?
       WHERE id = ?`
    )
    .run(nowIso(), JSON.stringify(params.summary), JSON.stringify(params.report), JSON.stringify(params.usage), params.id);
}

export function insertStageEvent(params: {
  runId: string;
  stage: string;
  status: "completed" | "skipped" | "failed";
  reason?: string;
  impact?: string;
  suggestedNextStep?: string;
}): void {
  sqlite
    .prepare(
      `INSERT INTO run_stage_events
       (run_id, stage, status, reason, impact, suggested_next_step, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      params.runId,
      params.stage,
      params.status,
      params.reason ?? null,
      params.impact ?? null,
      params.suggestedNextStep ?? null,
      nowIso()
    );
}

export function insertIssue(runId: string, issue: RunIssue): void {
  sqlite
    .prepare(
      `INSERT INTO run_issues (run_id, severity, category, title, details, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(runId, issue.severity, issue.category, issue.title, issue.details, issue.status, nowIso());
}

export function insertBaselineSnapshot(runId: string, offers: BaselineOffer[]): void {
  sqlite
    .prepare(`INSERT INTO source_offers_snapshot (run_id, data_json, created_at) VALUES (?, ?, ?)`)
    .run(runId, JSON.stringify(offers), nowIso());
}

export function insertDiscoveredCasinos(runId: string, casinos: DiscoveredCasino[]): void {
  const stmt = sqlite.prepare(
    `INSERT INTO discovered_casinos
      (run_id, state, casino_name, confidence, is_missing, citations_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  for (const casino of casinos) {
    stmt.run(
      runId,
      casino.state,
      casino.casinoName,
      casino.confidence,
      casino.isMissing ? 1 : 0,
      JSON.stringify(casino.citations),
      nowIso()
    );
  }
}

export function insertDiscoveredOffers(runId: string, offers: DiscoveredOffer[]): void {
  const stmt = sqlite.prepare(
    `INSERT INTO discovered_offers
      (run_id, state, casino_name, offer_name, offer_type, expected_deposit, expected_bonus, confidence, citations_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const offer of offers) {
    stmt.run(
      runId,
      offer.state,
      offer.casinoName,
      offer.offerName,
      offer.offerType ?? null,
      offer.expectedDeposit,
      offer.expectedBonus,
      offer.confidence,
      JSON.stringify(offer.citations),
      nowIso()
    );
  }
}

export function insertComparisons(runId: string, comparisons: OfferComparison[]): void {
  const stmt = sqlite.prepare(
    `INSERT INTO comparisons
      (run_id, state, casino_name, verdict, bonus_delta, deposit_delta, confidence, rationale, current_offer_json, discovered_offer_json, alternatives_json, citations_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const comparison of comparisons) {
    stmt.run(
      runId,
      comparison.state,
      comparison.casinoName,
      comparison.verdict,
      comparison.bonusDelta,
      comparison.depositDelta,
      comparison.confidence,
      comparison.rationale,
      comparison.currentOffer ? JSON.stringify(comparison.currentOffer) : null,
      comparison.discoveredOffer ? JSON.stringify(comparison.discoveredOffer) : null,
      JSON.stringify(comparison.alternatives),
      JSON.stringify(comparison.citations),
      nowIso()
    );
  }
}

export function insertLlmTrace(params: {
  runId: string;
  stage: "casino_discovery" | "offer_discovery";
  target: string;
  model: string;
  attempt: number;
  status: LlmTraceStatus;
  inputText: string;
  rawResponseJson?: string;
  extractedText?: string;
  errorMessage?: string;
  latencyMs: number;
}): void {
  sqlite
    .prepare(
      `INSERT INTO llm_traces
      (run_id, stage, target, model, attempt, status, input_text, raw_response_json, extracted_text, error_message, latency_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      params.runId,
      params.stage,
      params.target,
      params.model,
      params.attempt,
      params.status,
      params.inputText,
      params.rawResponseJson ?? null,
      params.extractedText ?? null,
      params.errorMessage ?? null,
      params.latencyMs,
      nowIso()
    );
}

export function getRun(id: string): RunRow | undefined {
  return sqlite.prepare(`SELECT * FROM runs WHERE id = ?`).get(id) as RunRow | undefined;
}

export function getRunReport(id: string): RunReport | null {
  const row = getRun(id);
  if (!row?.report_json) {
    return null;
  }

  const baseReport = JSON.parse(row.report_json) as RunReport;
  const normalizedOfferComparisons = baseReport.offerComparisons.map((comparison) => {
    if (!comparison.currentOffer && comparison.discoveredOffer && comparison.verdict === "unclear") {
      return {
        ...comparison,
        verdict: "better" as const,
        rationale:
          comparison.rationale && comparison.rationale.length > 0
            ? comparison.rationale
            : "No tracked offer exists; discovered offer is treated as better."
      };
    }
    return comparison;
  });
  const stageEvents = getRunStageEvents(id);
  const issues = getRunIssues(id);
  const discoveredCasinos =
    baseReport.discoveredCasinos && baseReport.discoveredCasinos.length > 0
      ? baseReport.discoveredCasinos
      : getDiscoveredCasinosByRunId(id);

  return {
    ...baseReport,
    offerComparisons: normalizedOfferComparisons,
    discoveredCasinos,
    stageEvents,
    issues: issues.length > 0 ? issues : baseReport.issues
  };
}

export function listRuns(limit = 20): RunSummary[] {
  const rows = sqlite
    .prepare(`SELECT * FROM runs ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as RunRow[];

  return rows.map((row) => mapRunToSummary(row));
}

export function mapRunToSummary(row: RunRow): RunSummary {
  const summary = row.summary_json ? (JSON.parse(row.summary_json) as RunSummary) : null;
  if (summary) {
    return {
      ...summary,
      mode: summary.mode ?? row.mode ?? "full"
    };
  }
  return {
    id: row.id,
    status: row.status,
    trigger: row.trigger,
    mode: row.mode ?? "full",
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at,
    missingCount: 0,
    comparisonCount: 0,
    betterCount: 0,
    unclearCount: 0,
    costEstimateUsd: 0
  };
}

function toPublicDiscoveredCasinos(items: DiscoveredCasino[]): DiscoveredCasinoCoverage[] {
  return items.map((item) => ({
    state: item.state,
    casinoName: item.casinoName,
    confidence: item.confidence,
    citations: item.citations,
    isMissing: item.isMissing
  }));
}

function getDiscoveredCasinosByRunId(runId: string): DiscoveredCasinoCoverage[] {
  const rows = sqlite
    .prepare(
      `SELECT state, casino_name, confidence, is_missing, citations_json
       FROM discovered_casinos
       WHERE run_id = ?
       ORDER BY state ASC, casino_name ASC`
    )
    .all(runId) as DiscoveredCasinoRow[];

  return rows.map((row) => ({
    state: row.state as DiscoveredCasinoCoverage["state"],
    casinoName: row.casino_name,
    confidence: row.confidence,
    isMissing: row.is_missing === 1,
    citations: JSON.parse(row.citations_json) as DiscoveredCasinoCoverage["citations"]
  }));
}

function buildRunSummary(params: {
  run: RunRow;
  status: RunSummary["status"];
  missingCasinos: PipelineResult["missingCasinos"];
  offerComparisons: PipelineResult["offerComparisons"];
  usage: RunUsage;
  completedAt?: string;
}): RunSummary {
  return {
    id: params.run.id,
    status: params.status,
    trigger: params.run.trigger,
    mode: params.run.mode ?? "full",
    startedAt: params.run.started_at ?? undefined,
    completedAt: params.completedAt,
    createdAt: params.run.created_at,
    missingCount: params.missingCasinos.length,
    comparisonCount: params.offerComparisons.length,
    betterCount: params.offerComparisons.filter((item) => item.verdict === "better").length,
    unclearCount: params.offerComparisons.filter((item) => item.verdict === "unclear").length,
    costEstimateUsd: params.usage.estimatedCostUsd
  };
}

function buildRunReport(params: {
  summary: RunSummary;
  discoveredCasinos: DiscoveredCasino[];
  missingCasinos: PipelineResult["missingCasinos"];
  offerComparisons: PipelineResult["offerComparisons"];
  issues: PipelineResult["issues"];
  usage: RunUsage;
}): RunReport {
  return {
    run: params.summary,
    discoveredCasinos: toPublicDiscoveredCasinos(params.discoveredCasinos),
    missingCasinos: params.missingCasinos,
    offerComparisons: params.offerComparisons,
    issues: params.issues,
    stageEvents: [],
    usage: params.usage,
    limitations: [
      "AI-based research can miss or misread promotion details.",
      "Public source availability can change or be incomplete.",
      "Heuristic normalization may underfit complex promotional mechanics."
    ]
  };
}

export function persistRunProgress(runId: string, snapshot: ReportSnapshotPayload): RunReport {
  const run = getRun(runId);
  if (!run) {
    throw new Error(`Run ${runId} not found`);
  }

  const status: RunSummary["status"] =
    run.status === "failed" || run.status === "completed" ? run.status : "running";
  const summary = buildRunSummary({
    run,
    status,
    missingCasinos: snapshot.missingCasinos,
    offerComparisons: snapshot.offerComparisons,
    usage: snapshot.usage,
    completedAt: status === "completed" ? run.completed_at ?? undefined : undefined
  });
  const report = buildRunReport({
    summary,
    discoveredCasinos: snapshot.discoveredCasinos,
    missingCasinos: snapshot.missingCasinos,
    offerComparisons: snapshot.offerComparisons,
    issues: snapshot.issues,
    usage: snapshot.usage
  });

  sqlite
    .prepare(
      `UPDATE runs
       SET summary_json = ?, report_json = ?, usage_json = ?
       WHERE id = ?`
    )
    .run(JSON.stringify(summary), JSON.stringify(report), JSON.stringify(snapshot.usage), runId);

  return report;
}

export function updateRunReport(runId: string, result: PipelineResult): RunReport {
  const run = getRun(runId);
  if (!run) {
    throw new Error(`Run ${runId} not found`);
  }

  const completedAt = nowIso();
  const summary = buildRunSummary({
    run,
    status: "completed",
    missingCasinos: result.missingCasinos,
    offerComparisons: result.offerComparisons,
    usage: result.usage,
    completedAt
  });
  const report = buildRunReport({
    summary,
    discoveredCasinos: result.discoveredCasinos,
    missingCasinos: result.missingCasinos,
    offerComparisons: result.offerComparisons,
    issues: result.issues,
    usage: result.usage
  });

  setRunCompleted({ id: runId, summary, report, usage: result.usage });
  return report;
}

export function getRunIssues(runId: string): RunIssue[] {
  const rows = sqlite
    .prepare(`SELECT severity, category, title, details, status FROM run_issues WHERE run_id = ? ORDER BY id ASC`)
    .all(runId) as RunIssueRow[];
  return rows.map((row) => ({
    severity: row.severity,
    category: row.category,
    title: row.title,
    details: row.details,
    status: row.status
  }));
}

export function getRunStageEvents(runId: string): RunStageEvent[] {
  const rows = sqlite
    .prepare(
      `SELECT stage, status, reason, impact, suggested_next_step, created_at
       FROM run_stage_events
       WHERE run_id = ?
       ORDER BY id ASC`
    )
    .all(runId) as RunStageEventRow[];
  return rows.map((row) => ({
    stage: row.stage,
    status: row.status,
    reason: row.reason ?? undefined,
    impact: row.impact ?? undefined,
    suggestedNextStep: row.suggested_next_step ?? undefined,
    createdAt: row.created_at
  }));
}

export function listLlmTraces(params: {
  runId: string;
  stage?: "casino_discovery" | "offer_discovery";
  status?: LlmTraceStatus;
  limit?: number;
}): LlmTrace[] {
  const limit = Math.max(1, Math.min(500, params.limit ?? 200));
  const clauses = ["run_id = ?"];
  const values: Array<string | number> = [params.runId];

  if (params.stage) {
    clauses.push("stage = ?");
    values.push(params.stage);
  }
  if (params.status) {
    clauses.push("status = ?");
    values.push(params.status);
  }

  values.push(limit);
  const rows = sqlite
    .prepare(
      `SELECT id, run_id, stage, target, model, attempt, status, input_text, raw_response_json, extracted_text, error_message, latency_ms, created_at
       FROM llm_traces
       WHERE ${clauses.join(" AND ")}
       ORDER BY id DESC
       LIMIT ?`
    )
    .all(...values) as LlmTraceRow[];

  return rows.map((row) => ({
    id: row.id,
    runId: row.run_id,
    stage: row.stage,
    target: row.target,
    model: row.model,
    attempt: row.attempt,
    status: row.status,
    inputText: row.input_text,
    rawResponseJson: row.raw_response_json ?? undefined,
    extractedText: row.extracted_text ?? undefined,
    errorMessage: row.error_message ?? undefined,
    latencyMs: row.latency_ms,
    createdAt: row.created_at
  }));
}
