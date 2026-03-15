import type { DiscoveredOffer, OfferRecord, RunMode, StateAbbreviation } from "@re-ai/shared";
import { buildComparison } from "./compare.js";
import { config } from "./config.js";
import type { BaselineOffer, PipelineResult } from "./types.js";
import { baselineToOfferRecord, normalizeCasinoName } from "./utils.js";

export function pickStates(states: StateAbbreviation[]): StateAbbreviation[] {
  return states.slice(0, config.MAX_STATES_PER_RUN);
}

export function groupOffersByCasino(offers: BaselineOffer[]): Map<string, BaselineOffer[]> {
  const map = new Map<string, BaselineOffer[]>();
  for (const offer of offers) {
    const key = `${offer.state}::${normalizeCasinoName(offer.casinoName)}`;
    const current = map.get(key) ?? [];
    current.push(offer);
    map.set(key, current);
  }
  return map;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export async function runWithConcurrency<T, R>(
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

export function calculateUsage(discoveryCalls: number, offerCalls: number) {
  const inputTokens = discoveryCalls * 1200 + offerCalls * 1800;
  const outputTokens = discoveryCalls * 700 + offerCalls * 1100;
  return {
    inputTokens,
    outputTokens,
    estimatedCostUsd: Number((inputTokens * 0.000002 + outputTokens * 0.000008).toFixed(4))
  };
}

export function buildOfferComparisons(params: {
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
