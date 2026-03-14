import type { Citation, DiscoveredOffer, OfferRecord } from "@re-ai/shared";
import { toNumber } from "../utils.js";
import type { RawCasinoDiscovery, RawOfferDiscovery } from "./constants.js";

export function safeCitations(value: unknown): Citation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const citations: Citation[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as { title?: unknown; url?: unknown; snippet?: unknown };
    if (typeof item.url !== "string") continue;

    const citation: Citation = {
      title: typeof item.title === "string" ? item.title : "Source",
      url: item.url
    };
    if (typeof item.snippet === "string") {
      citation.snippet = item.snippet;
    }
    citations.push(citation);
  }
  return citations;
}

export function compactCurrentOffers(input: OfferRecord[]) {
  return input.map((offer) => ({
    name: offer.offerName,
    type: offer.offerType ?? "",
    deposit: offer.expectedDeposit,
    bonus: offer.expectedBonus
  }));
}

export function normalizeDiscoveredCasinos(parsed: RawCasinoDiscovery) {
  const casinos = parsed.casinos ?? [];
  const output: Array<{ casinoName: string; confidence: number; citations: Citation[] }> = [];
  for (const item of casinos) {
    if (!item.casinoName) continue;
    output.push({
      casinoName: item.casinoName.trim(),
      confidence: Math.min(1, Math.max(0, item.confidence ?? 0.5)),
      citations: safeCitations(item.citations)
    });
  }
  return output;
}

export function normalizeDiscoveredOffers(
  parsed: RawOfferDiscovery,
  context: { state: DiscoveredOffer["state"]; casinoName: string }
): DiscoveredOffer[] {
  const offers: DiscoveredOffer[] = [];
  for (const offer of parsed.offers ?? []) {
    if (!offer.offerName) continue;
    const normalized: DiscoveredOffer = {
      state: context.state,
      casinoName: context.casinoName,
      offerName: offer.offerName.trim(),
      expectedDeposit: toNumber(offer.expectedDeposit, 0),
      expectedBonus: toNumber(offer.expectedBonus, 0),
      confidence: Math.min(1, Math.max(0, offer.confidence ?? 0.5)),
      citations: safeCitations(offer.citations)
    };
    if (offer.offerType?.trim()) {
      normalized.offerType = offer.offerType.trim();
    }
    offers.push(normalized);
  }

  return offers;
}
