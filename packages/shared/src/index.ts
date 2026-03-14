export type StateAbbreviation = "NJ" | "MI" | "PA" | "WV";

export type RunStatus = "queued" | "running" | "completed" | "failed";
export type RunMode = "full" | "discover_casinos" | "discover_offers";
export type LlmTraceStatus = "parsed" | "parse_failed" | "request_failed";

export type Verdict = "better" | "same" | "unclear";

export interface Citation {
  title: string;
  url: string;
  snippet?: string;
}

export interface OfferRecord {
  offerName: string;
  offerType?: string;
  expectedDeposit: number;
  expectedBonus: number;
  source?: string;
}

export interface MissingCasino {
  state: StateAbbreviation;
  casinoName: string;
  confidence: number;
  citations: Citation[];
}

export interface DiscoveredCasinoCoverage extends MissingCasino {
  isMissing: boolean;
}

export interface DiscoveredOffer extends OfferRecord {
  state: StateAbbreviation;
  casinoName: string;
  confidence: number;
  citations: Citation[];
}

export interface OfferComparison {
  state: StateAbbreviation;
  casinoName: string;
  currentOffer: OfferRecord | null;
  discoveredOffer: OfferRecord | null;
  verdict: Verdict;
  bonusDelta: number;
  depositDelta: number;
  confidence: number;
  rationale: string;
  alternatives: OfferRecord[];
  citations: Citation[];
}

export interface RunIssue {
  severity: "low" | "medium" | "high";
  category: string;
  title: string;
  details: string;
  status: "open" | "resolved";
}

export interface RunStageEvent {
  stage: string;
  status: "completed" | "skipped" | "failed";
  reason?: string;
  impact?: string;
  suggestedNextStep?: string;
  createdAt: string;
}

export interface LlmTrace {
  id: number;
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
  createdAt: string;
}

export interface RunSummary {
  id: string;
  status: RunStatus;
  trigger: "manual" | "scheduled";
  mode: RunMode;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  missingCount: number;
  comparisonCount: number;
  betterCount: number;
  unclearCount: number;
  costEstimateUsd: number;
}

export interface RunReport {
  run: RunSummary;
  discoveredCasinos: DiscoveredCasinoCoverage[];
  missingCasinos: MissingCasino[];
  offerComparisons: OfferComparison[];
  issues: RunIssue[];
  stageEvents: RunStageEvent[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
  };
  limitations: string[];
}
