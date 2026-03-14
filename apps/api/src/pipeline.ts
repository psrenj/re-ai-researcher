import type { DiscoveredOffer, OfferRecord, RunMode, StateAbbreviation } from "@re-ai/shared";
import { config } from "./config.js";
import { buildComparison } from "./compare.js";
import {
  insertBaselineSnapshot,
  insertComparisons,
  insertDiscoveredCasinos,
  insertDiscoveredOffers,
  insertIssue,
  insertStageEvent,
  persistRunProgress,
  setRunFailed,
  setRunRunning,
  updateRunReport
} from "./repository.js";
import type { BaselineOffer, DiscoveredCasino, PipelineResult, ResearchProvider } from "./types.js";
import { baselineToOfferRecord, normalizeCasinoName } from "./utils.js";
import { fetchBaselineOffers } from "./xano.js";

function pickStates(states: StateAbbreviation[]): StateAbbreviation[] {
  return states.slice(0, config.MAX_STATES_PER_RUN);
}

function groupOffersByCasino(offers: BaselineOffer[]): Map<string, BaselineOffer[]> {
  const map = new Map<string, BaselineOffer[]>();
  for (const offer of offers) {
    const key = `${offer.state}::${normalizeCasinoName(offer.casinoName)}`;
    const current = map.get(key) ?? [];
    current.push(offer);
    map.set(key, current);
  }
  return map;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const size = Math.max(1, Math.min(limit, items.length));
  const results = new Array<R>(items.length);
  let next = 0;

  async function runner() {
    while (true) {
      const current = next;
      next += 1;
      if (current >= items.length) break;
      const item = items[current];
      if (item === undefined) break;
      results[current] = await worker(item, current);
    }
  }

  await Promise.all(Array.from({ length: size }, () => runner()));
  return results;
}

function calculateUsage(discoveryCalls: number, offerCalls: number) {
  const inputTokens = discoveryCalls * 1200 + offerCalls * 1800;
  const outputTokens = discoveryCalls * 700 + offerCalls * 1100;
  return {
    inputTokens,
    outputTokens,
    estimatedCostUsd: Number((inputTokens * 0.000002 + outputTokens * 0.000008).toFixed(4))
  };
}

function buildOfferComparisons(params: {
  mode: RunMode;
  groupedCurrentOffers: Map<string, BaselineOffer[]>;
  discoveredOffers: DiscoveredOffer[];
}): PipelineResult["offerComparisons"] {
  if (params.mode === "discover_casinos") {
    return [];
  }

  const discoveredGrouped = new Map<string, DiscoveredOffer[]>();
  for (const offer of params.discoveredOffers) {
    const key = `${offer.state}::${normalizeCasinoName(offer.casinoName)}`;
    const list = discoveredGrouped.get(key) ?? [];
    list.push(offer);
    discoveredGrouped.set(key, list);
  }

  const comparisonKeys = Array.from(
    new Set([...params.groupedCurrentOffers.keys(), ...discoveredGrouped.keys()])
  );

  return comparisonKeys.map((key) => {
    const [state, normalizedName] = key.split("::") as [StateAbbreviation, string];
    const current = (params.groupedCurrentOffers.get(key) ?? []).map<OfferRecord>(baselineToOfferRecord);
    const discovered = discoveredGrouped.get(key) ?? [];
    const canonicalCasinoName =
      params.groupedCurrentOffers.get(key)?.[0]?.casinoName ?? discovered[0]?.casinoName ?? normalizedName;

    return buildComparison({
      state,
      casinoName: canonicalCasinoName,
      currentOffers: current,
      discoveredOffers: discovered,
      confidenceThreshold: config.CONFIDENCE_THRESHOLD
    });
  });
}

export async function processRun(params: {
  runId: string;
  states: StateAbbreviation[];
  mode?: RunMode;
  maxCasinosPerRun?: number;
  provider: ResearchProvider;
  fetchOffers?: () => Promise<BaselineOffer[]>;
}): Promise<void> {
  const fetcher = params.fetchOffers ?? fetchBaselineOffers;
  const mode = params.mode ?? "full";
  const issues: PipelineResult["issues"] = [];
  const discoveredCasinos: DiscoveredCasino[] = [];
  const discoveredOffers: DiscoveredOffer[] = [];
  let missingCasinos: PipelineResult["missingCasinos"] = [];
  let groupedCurrentOffers = new Map<string, BaselineOffer[]>();
  let discoveryCalls = 0;
  let offerCalls = 0;

  try {
    setRunRunning(params.runId);
    persistRunProgress(params.runId, {
      discoveredCasinos,
      missingCasinos,
      offerComparisons: [],
      issues,
      usage: calculateUsage(discoveryCalls, offerCalls)
    });

    const baselineOffers = await fetcher();
    insertBaselineSnapshot(params.runId, baselineOffers);
    insertStageEvent({ runId: params.runId, stage: "baseline_ingest", status: "completed" });

    const states = pickStates(params.states);
    const baselineByState = new Map<StateAbbreviation, BaselineOffer[]>();

    for (const state of states) {
      baselineByState.set(
        state,
        baselineOffers.filter((offer) => offer.state === state)
      );
    }

    groupedCurrentOffers = groupOffersByCasino(baselineOffers);

    persistRunProgress(params.runId, {
      discoveredCasinos,
      missingCasinos: [],
      offerComparisons: [],
      issues,
      usage: calculateUsage(discoveryCalls, offerCalls)
    });

    if (mode !== "discover_offers") {
      const discoveryResults = await runWithConcurrency(
        states,
        config.OPENAI_CONCURRENCY,
        async (state) => {
          const knownCasinos = Array.from(
            new Set((baselineByState.get(state) ?? []).map((offer) => offer.casinoName))
          );

          try {
            discoveryCalls += 1;
            const discovered = await params.provider.discoverCasinos({
              runId: params.runId,
              state,
              knownCasinos
            });

            return { state, discovered, failed: false as const };
          } catch (error) {
            const details = error instanceof Error ? error.message : "Unknown error";
            const issue = {
              severity: "medium" as const,
              category: "discovery",
              title: `Casino discovery failed for ${state}`,
              details,
              status: "open" as const
            };
            issues.push(issue);
            insertIssue(params.runId, issue);
            return { state, discovered: [], failed: true as const };
          }
        }
      );

      const discoveryFailures = discoveryResults.filter((item) => item.failed).length;
      for (const result of discoveryResults) {
        for (const item of result.discovered) {
          discoveredCasinos.push({
            state: result.state,
            casinoName: item.casinoName,
            normalizedName: normalizeCasinoName(item.casinoName),
            isMissing: false,
            confidence: item.confidence,
            citations: item.citations
          });
        }
      }

      insertStageEvent({
        runId: params.runId,
        stage: "casino_discovery",
        status: "completed",
        impact: `Processed ${states.length} states with ${discoveryFailures} failures`
      });
    } else {
      insertStageEvent({
        runId: params.runId,
        stage: "casino_discovery",
        status: "skipped",
        reason: "Run mode discover_offers skips casino discovery",
        impact: "Missing casino detection is not computed for this run mode",
        suggestedNextStep: "Run mode full or discover_casinos for coverage gaps"
      });
    }

    const baselineCasinoSet = new Set(
      baselineOffers.map((offer) => `${offer.state}::${normalizeCasinoName(offer.casinoName)}`)
    );

    missingCasinos = discoveredCasinos
      .filter((casino) => !baselineCasinoSet.has(`${casino.state}::${casino.normalizedName}`))
      .map((casino) => {
        casino.isMissing = true;
        return {
          state: casino.state,
          casinoName: casino.casinoName,
          confidence: casino.confidence,
          citations: casino.citations
        };
      });

    insertDiscoveredCasinos(params.runId, discoveredCasinos);
    persistRunProgress(params.runId, {
      discoveredCasinos,
      missingCasinos,
      offerComparisons: buildOfferComparisons({ mode, groupedCurrentOffers, discoveredOffers }),
      issues,
      usage: calculateUsage(discoveryCalls, offerCalls)
    });

    if (mode !== "discover_casinos") {
      const researchTargets = Array.from(
        new Set([
          ...baselineOffers.map((offer) => `${offer.state}::${offer.casinoName}`),
          ...(mode === "full"
            ? discoveredCasinos.map((casino) => `${casino.state}::${casino.casinoName}`)
            : [])
        ])
      );

      const maxCasinosPerRun = Math.max(1, params.maxCasinosPerRun ?? config.MAX_CASINOS_PER_RUN);
      const batches = chunk(researchTargets, maxCasinosPerRun);
      insertStageEvent({
        runId: params.runId,
        stage: "offer_discovery_plan",
        status: "completed",
        impact: `Prepared ${researchTargets.length} casino-state targets across ${batches.length} batches (batch_size=${maxCasinosPerRun})`
      });

      let processedTargets = 0;
      let failedTargets = 0;

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
        const batch = batches[batchIndex] ?? [];
        if (batch.length === 0) {
          continue;
        }
        let batchFailures = 0;
        const batchOffers = await runWithConcurrency(
          batch,
          config.OPENAI_CONCURRENCY,
          async (target): Promise<DiscoveredOffer[]> => {
            const separator = target.indexOf("::");
            const state = target.slice(0, separator) as StateAbbreviation;
            const casinoName = target.slice(separator + 2);
            const key = `${state}::${normalizeCasinoName(casinoName)}`;
            const currentOffers = (groupedCurrentOffers.get(key) ?? []).map(baselineToOfferRecord);

            try {
              offerCalls += 1;
              return await params.provider.discoverOffers({
                runId: params.runId,
                state,
                casinoName,
                currentOffers
              });
            } catch (error) {
              batchFailures += 1;
              const details = error instanceof Error ? error.message : "Unknown error";
              const issue = {
                severity: "medium" as const,
                category: "offers",
                title: `Offer discovery failed for ${casinoName} (${state})`,
                details,
                status: "open" as const
              };
              issues.push(issue);
              insertIssue(params.runId, issue);
              return [];
            }
          }
        );

        const flattenedBatchOffers = batchOffers.flat();
        if (flattenedBatchOffers.length > 0) {
          insertDiscoveredOffers(params.runId, flattenedBatchOffers);
          discoveredOffers.push(...flattenedBatchOffers);
        }

        processedTargets += batch.length;
        failedTargets += batchFailures;
        insertStageEvent({
          runId: params.runId,
          stage: "offer_discovery_batch",
          status: "completed",
          reason: `Batch ${batchIndex + 1}/${batches.length}`,
          impact: `Processed ${processedTargets}/${researchTargets.length} targets; failures ${failedTargets}`
        });

        persistRunProgress(params.runId, {
          discoveredCasinos,
          missingCasinos,
          offerComparisons: buildOfferComparisons({ mode, groupedCurrentOffers, discoveredOffers }),
          issues,
          usage: calculateUsage(discoveryCalls, offerCalls)
        });
      }
      insertStageEvent({
        runId: params.runId,
        stage: "offer_discovery",
        status: "completed",
        impact: `Completed ${processedTargets} targets with ${failedTargets} failures`
      });
    } else {
      insertStageEvent({
        runId: params.runId,
        stage: "offer_discovery",
        status: "skipped",
        reason: "Run mode discover_casinos skips offer discovery",
        impact: "No offer comparison computed for this run",
        suggestedNextStep: "Run mode full or discover_offers for offer-level analysis"
      });
    }

    const offerComparisons = buildOfferComparisons({ mode, groupedCurrentOffers, discoveredOffers });
    if (mode !== "discover_casinos") {
      insertComparisons(params.runId, offerComparisons);
      insertStageEvent({ runId: params.runId, stage: "comparison", status: "completed" });
    } else {
      insertStageEvent({
        runId: params.runId,
        stage: "comparison",
        status: "skipped",
        reason: "Run mode discover_casinos skips comparison stage",
        impact: "Report contains discovery-only coverage output",
        suggestedNextStep: "Run mode full for complete comparison output"
      });
    }

    const usage = calculateUsage(discoveryCalls, offerCalls);

    updateRunReport(params.runId, {
      discoveredCasinos,
      missingCasinos,
      offerComparisons,
      issues,
      usage
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown pipeline failure";
    setRunFailed(params.runId, message);
    insertStageEvent({
      runId: params.runId,
      stage: "pipeline",
      status: "failed",
      reason: message,
      impact: "Run failed before report finalization",
      suggestedNextStep: "Review logs and rerun"
    });
    persistRunProgress(params.runId, {
      discoveredCasinos,
      missingCasinos,
      offerComparisons: buildOfferComparisons({ mode, groupedCurrentOffers, discoveredOffers }),
      issues,
      usage: calculateUsage(discoveryCalls, offerCalls)
    });
  }
}
