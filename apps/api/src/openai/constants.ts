import type { Citation } from "@re-ai/shared";

export interface RawCasinoDiscovery {
  casinos?: Array<{ casinoName?: string; confidence?: number; citations?: Citation[] }>;
}

export interface RawOfferDiscovery {
  offers?: Array<{
    offerName?: string;
    offerType?: string;
    expectedDeposit?: number | string;
    expectedBonus?: number | string;
    confidence?: number;
    citations?: Citation[];
  }>;
}

export type TraceStage = "casino_discovery" | "offer_discovery";

export type PromptTemplateConfig = {
  id: string;
  version?: string;
  variables: Record<string, string>;
};

export const STRICT_JSON_SUFFIX = [
  "Return a single valid JSON object only.",
  "No markdown fences and no explanatory text."
].join(" ");

export const PROCEED_IMMEDIATELY_SUFFIX = [
  "Proceed immediately.",
  "Do not ask follow-up questions.",
  "If evidence is partial, return best-effort JSON now."
].join(" ");

export const CONTINUE_JSON_ONLY_INPUT = `${PROCEED_IMMEDIATELY_SUFFIX} ${STRICT_JSON_SUFFIX}`;

export const CASINO_DISCOVERY_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    casinos: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          casinoName: { type: "string" },
          confidence: { type: "number" },
          citations: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                title: { type: "string" },
                url: { type: "string" },
                snippet: { type: "string" }
              },
              required: ["title", "url", "snippet"]
            }
          }
        },
        required: ["casinoName", "confidence", "citations"]
      }
    }
  },
  required: ["casinos"]
};

export const OFFERS_DISCOVERY_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    offers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          offerName: { type: "string" },
          offerType: { type: "string" },
          expectedDeposit: { type: "number" },
          expectedBonus: { type: "number" },
          confidence: { type: "number" },
          citations: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                title: { type: "string" },
                url: { type: "string" },
                snippet: { type: "string" }
              },
              required: ["title", "url", "snippet"]
            }
          }
        },
        required: ["offerName", "offerType", "expectedDeposit", "expectedBonus", "confidence", "citations"]
      }
    }
  },
  required: ["offers"]
};
