import type {
  Citation,
  DiscoveredOffer,
  MissingCasino,
  OfferComparison,
  OfferRecord,
  RunIssue,
  StateAbbreviation
} from "@re-ai/shared";

export interface BaselineOffer {
  state: StateAbbreviation;
  casinoName: string;
  offerName: string;
  offerType?: string;
  expectedDeposit: number;
  expectedBonus: number;
}

export interface DiscoveredCasino extends MissingCasino {
  normalizedName: string;
  isMissing: boolean;
}

export interface RunUsage {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

export interface ResearchProvider {
  discoverCasinos: (input: {
    runId: string;
    state: StateAbbreviation;
    knownCasinos: string[];
  }) => Promise<Array<{ casinoName: string; confidence: number; citations: Citation[] }>>;
  discoverOffers: (input: {
    runId: string;
    state: StateAbbreviation;
    casinoName: string;
    currentOffers: OfferRecord[];
  }) => Promise<DiscoveredOffer[]>;
}

export interface PipelineResult {
  discoveredCasinos: DiscoveredCasino[];
  missingCasinos: MissingCasino[];
  offerComparisons: OfferComparison[];
  issues: RunIssue[];
  usage: RunUsage;
}
