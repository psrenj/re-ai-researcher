import type {
  DiscoveredCasinoCoverage,
  LlmTrace,
  OfferComparison,
  RunIssue,
  RunReport,
  RunStageEvent,
  RunSummary
} from "@re-ai/shared";
import type { DiscoveredCasino, PipelineResult, RunUsage } from "./types.js";
import type {
  DiscoveredCasinoRow,
  LlmTraceRow,
  RunIssueRow,
  RunRow,
  RunStageEventRow
} from "./repositoryRows.js";

export interface ReportSnapshotPayload {
  discoveredCasinos: DiscoveredCasino[];
  missingCasinos: PipelineResult["missingCasinos"];
  offerComparisons: PipelineResult["offerComparisons"];
  issues: PipelineResult["issues"];
  usage: RunUsage;
}

export function normalizeOfferComparisons(comparisons: OfferComparison[]): OfferComparison[] {
  return comparisons.map((comparison) => {
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
}

export function toPublicDiscoveredCasinos(items: DiscoveredCasino[]): DiscoveredCasinoCoverage[] {
  return items.map((item) => ({
    state: item.state,
    casinoName: item.casinoName,
    confidence: item.confidence,
    citations: item.citations,
    isMissing: item.isMissing
  }));
}

export function mapDiscoveredCasinoRow(row: DiscoveredCasinoRow): DiscoveredCasinoCoverage {
  return {
    state: row.state as DiscoveredCasinoCoverage["state"],
    casinoName: row.casino_name,
    confidence: row.confidence,
    isMissing: row.is_missing === 1,
    citations: JSON.parse(row.citations_json) as DiscoveredCasinoCoverage["citations"]
  };
}

export function buildRunSummary(params: {
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

export function buildRunReport(params: {
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

export function mapRunIssueRow(row: RunIssueRow): RunIssue {
  return {
    severity: row.severity,
    category: row.category,
    title: row.title,
    details: row.details,
    status: row.status
  };
}

export function mapRunStageEventRow(row: RunStageEventRow): RunStageEvent {
  return {
    stage: row.stage,
    status: row.status,
    reason: row.reason ?? undefined,
    impact: row.impact ?? undefined,
    suggestedNextStep: row.suggested_next_step ?? undefined,
    createdAt: row.created_at
  };
}

export function mapLlmTraceRow(row: LlmTraceRow): LlmTrace {
  return {
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
  };
}

export function mapRunToSummary(row: RunRow): RunSummary {
  let summary: RunSummary | null = null;
  if (row.summary_json) {
    try {
      summary = JSON.parse(row.summary_json) as RunSummary;
    } catch {
      summary = null;
    }
  }
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
