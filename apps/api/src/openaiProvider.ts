import OpenAI from "openai";
import type { DiscoveredOffer, OfferRecord, StateAbbreviation } from "@re-ai/shared";
import { config } from "./config.js";
import type { ResearchProvider } from "./types.js";
import { callAndParseJson } from "./openai/callAndParseJson.js";
import {
  CASINO_DISCOVERY_SCHEMA,
  OFFERS_DISCOVERY_SCHEMA,
  type PromptTemplateConfig,
  type RawCasinoDiscovery,
  type RawOfferDiscovery
} from "./openai/constants.js";
import {
  compactCurrentOffers,
  normalizeDiscoveredCasinos,
  normalizeDiscoveredOffers
} from "./openai/normalizers.js";
import { parseResponseJson } from "./openai/responseUtils.js";

function getClient(): OpenAI {
  if (!config.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing. Set it before running research.");
  }
  return new OpenAI({ apiKey: config.OPENAI_API_KEY });
}

function createDiscoveryPrompt(state: StateAbbreviation, knownCasinos: string[]): string {
  return [
    `You are researching licensed and currently operational online casino brands in ${state}.`,
    "Prioritize official state gaming regulators/commission websites and official operator pages.",
    "Use public information only and do not include sportsbooks.",
    `Known casinos already tracked: ${knownCasinos.join(", ") || "none"}.`,
    'Return only JSON with shape: {"casinos":[{"casinoName":string,"confidence":number,"citations":[{"title":string,"url":string,"snippet":string}]}]}'
  ].join("\n");
}

function createOffersPrompt(state: StateAbbreviation, casinoName: string, currentOffers: OfferRecord[]): string {
  const compactOffers = compactCurrentOffers(currentOffers);
  return [
    `Research active CASINO promotional offers for ${casinoName} in ${state}.`,
    "Exclude sportsbook promotions.",
    "Focus on welcome/new-player and headline promotions.",
    "Use official casino/operator pages first; include citations.",
    `Current known offers: ${JSON.stringify(compactOffers)}`,
    'Return only JSON with shape: {"offers":[{"offerName":string,"offerType":string,"expectedDeposit":number,"expectedBonus":number,"confidence":number,"citations":[{"title":string,"url":string,"snippet":string}]}]}'
  ].join("\n");
}

function getDiscoveryPromptTemplate(input: { state: StateAbbreviation; knownCasinos: string[] }):
  | PromptTemplateConfig
  | undefined {
  if (!config.OPENAI_PROMPT_ID_DISCOVERY) {
    return undefined;
  }

  return {
    id: config.OPENAI_PROMPT_ID_DISCOVERY,
    version: config.OPENAI_PROMPT_VERSION_DISCOVERY,
    variables: {
      state: input.state,
      known_casinos: JSON.stringify(input.knownCasinos)
    }
  };
}

function getOffersPromptTemplate(input: {
  state: StateAbbreviation;
  casinoName: string;
  currentOffers: OfferRecord[];
}): PromptTemplateConfig | undefined {
  if (!config.OPENAI_PROMPT_ID_OFFERS) {
    return undefined;
  }

  return {
    id: config.OPENAI_PROMPT_ID_OFFERS,
    version: config.OPENAI_PROMPT_VERSION_OFFERS,
    variables: {
      casino: input.casinoName,
      state: input.state,
      known_offers: JSON.stringify(compactCurrentOffers(input.currentOffers))
    }
  };
}

async function discoverCasinosWithFallback(params: {
  client: OpenAI;
  runId: string;
  state: StateAbbreviation;
  prompt: string;
  promptTemplate?: PromptTemplateConfig;
}): Promise<RawCasinoDiscovery> {
  try {
    return await callAndParseJson<RawCasinoDiscovery>({
      client: params.client,
      runId: params.runId,
      stage: "casino_discovery",
      target: `${params.state}::all`,
      model: config.OPENAI_MODEL_DISCOVERY,
      basePrompt: params.prompt,
      promptTemplate: params.promptTemplate,
      schemaName: "casino_discovery",
      jsonSchema: CASINO_DISCOVERY_SCHEMA,
      maxOutputTokens: config.OPENAI_MAX_OUTPUT_TOKENS_DISCOVERY,
      parse: (response) => parseResponseJson(response) as RawCasinoDiscovery
    });
  } catch (error) {
    if (!params.promptTemplate) throw error;

    return callAndParseJson<RawCasinoDiscovery>({
      client: params.client,
      runId: params.runId,
      stage: "casino_discovery",
      target: `${params.state}::all`,
      model: config.OPENAI_MODEL_DISCOVERY,
      basePrompt: params.prompt,
      schemaName: "casino_discovery",
      jsonSchema: CASINO_DISCOVERY_SCHEMA,
      maxOutputTokens: config.OPENAI_MAX_OUTPUT_TOKENS_DISCOVERY,
      parse: (response) => parseResponseJson(response) as RawCasinoDiscovery
    });
  }
}

async function discoverOffersWithFallback(params: {
  client: OpenAI;
  runId: string;
  state: StateAbbreviation;
  casinoName: string;
  prompt: string;
  promptTemplate?: PromptTemplateConfig;
}): Promise<RawOfferDiscovery> {
  try {
    return await callAndParseJson<RawOfferDiscovery>({
      client: params.client,
      runId: params.runId,
      stage: "offer_discovery",
      target: `${params.state}::${params.casinoName}`,
      model: config.OPENAI_MODEL_EXTRACTION,
      basePrompt: params.prompt,
      promptTemplate: params.promptTemplate,
      schemaName: "casino_offers_discovery",
      jsonSchema: OFFERS_DISCOVERY_SCHEMA,
      maxOutputTokens: config.OPENAI_MAX_OUTPUT_TOKENS_OFFERS,
      parse: (response) => parseResponseJson(response) as RawOfferDiscovery
    });
  } catch (error) {
    if (!params.promptTemplate) throw error;

    return callAndParseJson<RawOfferDiscovery>({
      client: params.client,
      runId: params.runId,
      stage: "offer_discovery",
      target: `${params.state}::${params.casinoName}`,
      model: config.OPENAI_MODEL_EXTRACTION,
      basePrompt: params.prompt,
      schemaName: "casino_offers_discovery",
      jsonSchema: OFFERS_DISCOVERY_SCHEMA,
      maxOutputTokens: config.OPENAI_MAX_OUTPUT_TOKENS_OFFERS,
      parse: (response) => parseResponseJson(response) as RawOfferDiscovery
    });
  }
}

export function createOpenAiProvider(): ResearchProvider {
  return {
    async discoverCasinos(input) {
      const client = getClient();
      const prompt = createDiscoveryPrompt(input.state, input.knownCasinos);
      const promptTemplate = getDiscoveryPromptTemplate({
        state: input.state,
        knownCasinos: input.knownCasinos
      });

      const parsed = await discoverCasinosWithFallback({
        client,
        runId: input.runId,
        state: input.state,
        prompt,
        promptTemplate
      });

      return normalizeDiscoveredCasinos(parsed);
    },

    async discoverOffers(input): Promise<DiscoveredOffer[]> {
      const client = getClient();
      const prompt = createOffersPrompt(input.state, input.casinoName, input.currentOffers);
      const promptTemplate = getOffersPromptTemplate({
        state: input.state,
        casinoName: input.casinoName,
        currentOffers: input.currentOffers
      });

      const parsed = await discoverOffersWithFallback({
        client,
        runId: input.runId,
        state: input.state,
        casinoName: input.casinoName,
        prompt,
        promptTemplate
      });

      return normalizeDiscoveredOffers(parsed, {
        state: input.state,
        casinoName: input.casinoName
      });
    }
  };
}

export const states: StateAbbreviation[] = ["NJ", "MI", "PA", "WV"];
