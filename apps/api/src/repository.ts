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
import {
  buildRunReport,
  buildRunSummary,
  mapDiscoveredCasinoRow,
  mapLlmTraceRow,
  mapRunIssueRow,
  mapRunToSummary as mapRunToSummaryInternal,
  mapRunStageEventRow,
  normalizeOfferComparisons,
  type ReportSnapshotPayload
} from "./repositoryHelpers.js";
import type { DiscoveredCasinoRow, LlmTraceRow, RunIssueRow, RunRow, RunStageEventRow } from "./repositoryRows.js";

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

export function getLatestBaselineSnapshot(): BaselineOffer[] | null {
  const row = sqlite
    .prepare(
      `SELECT data_json
       FROM source_offers_snapshot
       ORDER BY id DESC
       LIMIT 1`
    )
    .get() as { data_json: string } | undefined;

  if (!row?.data_json) {
    return null;
  }

  try {
    const parsed = JSON.parse(row.data_json) as BaselineOffer[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
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
  const normalizedOfferComparisons = normalizeOfferComparisons(baseReport.offerComparisons);
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

  return rows.map((row) => mapRunToSummaryInternal(row));
}

export function mapRunToSummary(row: RunRow): RunSummary {
  return mapRunToSummaryInternal(row);
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

  return rows.map(mapDiscoveredCasinoRow);
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
  return rows.map(mapRunIssueRow);
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
  return rows.map(mapRunStageEventRow);
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

  return rows.map(mapLlmTraceRow);
}
