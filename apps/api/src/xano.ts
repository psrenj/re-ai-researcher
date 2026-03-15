import type { StateAbbreviation } from "@re-ai/shared";
import { config } from "./config.js";
import type { BaselineOffer } from "./types.js";
import { toNumber } from "./utils.js";

interface XanoRow {
  Name: string;
  Offer_Name: string;
  offer_type?: string;
  Expected_Deposit?: number | string;
  Expected_Bonus?: number | string;
  state?: {
    Abbreviation?: StateAbbreviation;
  };
}

export async function fetchBaselineOffers(): Promise<BaselineOffer[]> {
  const res = await fetch(config.XANO_ENDPOINT, {
    headers: {
      accept: "application/json"
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Xano baseline offers: ${res.status}`);
  }

  const rows = (await res.json()) as XanoRow[];

  const offers: BaselineOffer[] = [];
  for (const row of rows) {
    const state = row.state?.Abbreviation;
    if (!state || !row.Name || !row.Offer_Name) {
      continue;
    }

    const offer: BaselineOffer = {
      state,
      casinoName: row.Name.trim(),
      offerName: row.Offer_Name.trim(),
      expectedDeposit: toNumber(row.Expected_Deposit, 0),
      expectedBonus: toNumber(row.Expected_Bonus, 0)
    };
    if (row.offer_type?.trim()) {
      offer.offerType = row.offer_type.trim();
    }
    offers.push(offer);
  }
  return offers;
}
