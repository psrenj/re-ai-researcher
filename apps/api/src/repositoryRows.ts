import type { LlmTraceStatus, RunMode } from "@re-ai/shared";

export interface RunRow {
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

export interface RunIssueRow {
  severity: "low" | "medium" | "high";
  category: string;
  title: string;
  details: string;
  status: "open" | "resolved";
}

export interface RunStageEventRow {
  stage: string;
  status: "completed" | "skipped" | "failed";
  reason: string | null;
  impact: string | null;
  suggested_next_step: string | null;
  created_at: string;
}

export interface LlmTraceRow {
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

export interface DiscoveredCasinoRow {
  state: string;
  casino_name: string;
  confidence: number;
  is_missing: number;
  citations_json: string;
}
