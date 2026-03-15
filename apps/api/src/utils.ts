import type { BaselineOffer } from "./types.js";

export function nowIso(): string {
  return new Date().toISOString();
}

export function normalizeCasinoName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractJsonObject(text: string): unknown {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first < 0 || last < first) {
    throw new Error("Unable to parse JSON object from model output");
  }
  const content = text.slice(first, last + 1);
  return JSON.parse(content);
}

export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const n = Number(value.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return fallback;
}

export function baselineToOfferRecord(item: BaselineOffer) {
  return {
    offerName: item.offerName,
    offerType: item.offerType,
    expectedDeposit: item.expectedDeposit,
    expectedBonus: item.expectedBonus
  };
}
