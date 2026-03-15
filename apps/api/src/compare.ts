import type { DiscoveredOffer, OfferComparison, OfferRecord, Verdict } from "@re-ai/shared";

function pickBest(offers: OfferRecord[]): OfferRecord | null {
  if (offers.length === 0) return null;
  return [...offers].sort((a, b) => {
    if (b.expectedBonus !== a.expectedBonus) {
      return b.expectedBonus - a.expectedBonus;
    }
    return a.expectedDeposit - b.expectedDeposit;
  })[0] ?? null;
}

function calculateVerdict(current: OfferRecord | null, discovered: OfferRecord | null, confidence: number): Verdict {
  if (!discovered) {
    return "unclear";
  }
  if (!current) {
    return "better";
  }

  if (discovered.expectedBonus > current.expectedBonus) {
    return confidence >= 0.65 ? "better" : "unclear";
  }

  if (
    discovered.expectedBonus === current.expectedBonus &&
    discovered.expectedDeposit < current.expectedDeposit
  ) {
    return confidence >= 0.65 ? "better" : "unclear";
  }

  if (confidence < 0.65) {
    return "unclear";
  }

  return "same";
}

export function buildComparison(input: {
  state: "NJ" | "MI" | "PA" | "WV";
  casinoName: string;
  currentOffers: OfferRecord[];
  discoveredOffers: DiscoveredOffer[];
  confidenceThreshold: number;
}): OfferComparison {
  const currentBest = pickBest(input.currentOffers);
  const discoveredBase = input.discoveredOffers.map((offer) => ({
    offerName: offer.offerName,
    offerType: offer.offerType,
    expectedDeposit: offer.expectedDeposit,
    expectedBonus: offer.expectedBonus
  }));
  const discoveredBest = pickBest(discoveredBase);
  const maxConfidence = input.discoveredOffers.reduce((max, offer) => Math.max(max, offer.confidence), 0);

  const verdict = calculateVerdict(currentBest, discoveredBest, maxConfidence);
  const bonusDelta = (discoveredBest?.expectedBonus ?? 0) - (currentBest?.expectedBonus ?? 0);
  const depositDelta = (discoveredBest?.expectedDeposit ?? 0) - (currentBest?.expectedDeposit ?? 0);

  const alternatives =
    verdict === "unclear" || maxConfidence < input.confidenceThreshold
      ? discoveredBase.slice(1, 4)
      : [];

  return {
    state: input.state,
    casinoName: input.casinoName,
    currentOffer: currentBest,
    discoveredOffer: discoveredBest,
    verdict,
    bonusDelta,
    depositDelta,
    confidence: maxConfidence,
    rationale:
      verdict === "better"
        ? "Discovered offer appears superior based on bonus/deposit comparison."
        : verdict === "same"
          ? "Discovered offer does not materially exceed the current offer."
          : "Evidence is mixed or low-confidence; showing alternatives.",
    alternatives,
    citations: input.discoveredOffers.flatMap((offer) => offer.citations)
  };
}
