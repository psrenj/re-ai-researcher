import OpenAI from "openai";
import type { Citation, DiscoveredOffer, OfferRecord, StateAbbreviation } from "@re-ai/shared";
import { config } from "./config.js";
import { insertLlmTrace } from "./repository.js";
import type { ResearchProvider } from "./types.js";
import { extractJsonObject, toNumber } from "./utils.js";

interface RawCasinoDiscovery {
  casinos?: Array<{ casinoName?: string; confidence?: number; citations?: Citation[] }>;
}

interface RawOfferDiscovery {
  offers?: Array<{
    offerName?: string;
    offerType?: string;
    expectedDeposit?: number | string;
    expectedBonus?: number | string;
    confidence?: number;
    citations?: Citation[];
  }>;
}

type TraceStage = "casino_discovery" | "offer_discovery";
type PromptTemplateConfig = {
  id: string;
  version?: string;
  variables: Record<string, string>;
};
const disabledPromptTemplates = new Set<string>();

const STRICT_JSON_SUFFIX = [
  "Return a single valid JSON object only.",
  "No markdown fences and no explanatory text."
].join(" ");

const PROCEED_IMMEDIATELY_SUFFIX = [
  "Proceed immediately.",
  "Do not ask follow-up questions.",
  "If evidence is partial, return best-effort JSON now."
].join(" ");
const CONTINUE_JSON_ONLY_INPUT = `${PROCEED_IMMEDIATELY_SUFFIX} ${STRICT_JSON_SUFFIX}`;

const CASINO_DISCOVERY_SCHEMA: Record<string, unknown> = {
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

const OFFERS_DISCOVERY_SCHEMA: Record<string, unknown> = {
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

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ error: "Unable to stringify response payload" });
  }
}

function getIncompleteReason(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;
  const value = response as { incomplete_details?: { reason?: unknown } };
  const reason = value.incomplete_details?.reason;
  return typeof reason === "string" ? reason : null;
}

function getResponseId(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;
  const value = response as { id?: unknown };
  return typeof value.id === "string" ? value.id : null;
}

function isRetryableError(error: unknown): boolean {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: number }).status)
      : NaN;
  if (status === 429 || (status >= 500 && status < 600)) {
    return true;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("timeout") ||
    message.includes("rate limit") ||
    message.includes("temporarily unavailable") ||
    message.includes("econnreset")
  );
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function collectText(value: unknown, out: string[], depth: number): void {
  if (depth > 6 || value == null) return;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) out.push(trimmed);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectText(item, out, depth + 1);
    return;
  }
  if (typeof value !== "object") return;

  const obj = value as Record<string, unknown>;
  for (const [key, entry] of Object.entries(obj)) {
    if ((key === "text" || key === "output_text") && typeof entry === "string") {
      const trimmed = entry.trim();
      if (trimmed.length > 0) out.push(trimmed);
      continue;
    }
    if (key === "content" || key === "output") {
      collectText(entry, out, depth + 1);
    }
  }
}

function getExtractedText(response: unknown): string {
  const texts: string[] = [];
  const root = response as { output_text?: unknown; output?: unknown };

  if (typeof root.output_text === "string" && root.output_text.trim().length > 0) {
    texts.push(root.output_text.trim());
  }

  if (Array.isArray(root.output)) {
    for (const item of root.output) {
      collectText(item, texts, 0);
    }
  }

  collectText(response, texts, 0);
  const unique = Array.from(new Set(texts.map((item) => item.trim()).filter((item) => item.length > 0)));
  return unique.join("\n");
}

function parseResponseJson(response: unknown): unknown {
  if (response && typeof response === "object") {
    const value = response as { output_parsed?: unknown };
    if (value.output_parsed && typeof value.output_parsed === "object") {
      return value.output_parsed;
    }
  }
  return extractJsonObject(getExtractedText(response));
}

function looksLikeClarificationRequest(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes("do you want me to proceed") ||
    normalized.includes("would you like me to proceed") ||
    normalized.includes("please confirm") ||
    normalized.includes("confirm before")
  );
}

function safeCitations(value: unknown): Citation[] {
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

function compactCurrentOffers(input: OfferRecord[]) {
  return input.map((offer) => ({
    name: offer.offerName,
    type: offer.offerType ?? "",
    deposit: offer.expectedDeposit,
    bonus: offer.expectedBonus
  }));
}

function getClient(): OpenAI {
  if (!config.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing. Set it before running research.");
  }
  return new OpenAI({ apiKey: config.OPENAI_API_KEY });
}

async function callAndParseJson<T>(params: {
  client: OpenAI;
  runId: string;
  stage: TraceStage;
  target: string;
  model: string;
  basePrompt: string;
  promptTemplate?: PromptTemplateConfig;
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  maxOutputTokens: number;
  parse: (payload: unknown) => T;
}): Promise<T> {
  let globalAttempt = 0;
  let lastParseError: Error | null = null;

  for (const strictJson of [false, true]) {
    const prompt = strictJson
      ? `${params.basePrompt}\n${PROCEED_IMMEDIATELY_SUFFIX} ${STRICT_JSON_SUFFIX}`
      : `${params.basePrompt}\n${PROCEED_IMMEDIATELY_SUFFIX}`;

    for (let retry = 0; retry <= config.OPENAI_MAX_RETRIES; retry += 1) {
      globalAttempt += 1;
      const startedAt = Date.now();
      let response: unknown;
      const tokenBudget = Math.min(params.maxOutputTokens + retry * 800 + (strictJson ? 400 : 0), 6000);
      const promptTemplate =
        params.promptTemplate && !disabledPromptTemplates.has(params.promptTemplate.id)
          ? params.promptTemplate
          : undefined;

      try {
        const requestBody: Record<string, unknown> = {
          model: params.model,
          max_output_tokens: tokenBudget,
          reasoning: { effort: "medium" },
          text: {
            format: {
              type: "json_schema",
              name: params.schemaName,
              strict: true,
              schema: params.jsonSchema
            }
          }
        };

        if (promptTemplate) {
          requestBody.prompt = {
            id: promptTemplate.id,
            ...(promptTemplate.version ? { version: promptTemplate.version } : {}),
            variables: promptTemplate.variables
          };
          requestBody.input = strictJson ? CONTINUE_JSON_ONLY_INPUT : PROCEED_IMMEDIATELY_SUFFIX;
        } else {
          requestBody.input = prompt;
          requestBody.tools = [{ type: "web_search_preview" }];
        }

        response = await params.client.responses.create(requestBody as never);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown OpenAI request error";
        const loweredMessage = message.toLowerCase();
        if (
          promptTemplate &&
          (loweredMessage.includes("unknown prompt variables") ||
            loweredMessage.includes("unsupported parameter: 'temperature'") ||
            loweredMessage.includes('unsupported parameter: "temperature"') ||
            loweredMessage.includes("unsupported parameter: temperature"))
        ) {
          disabledPromptTemplates.add(promptTemplate.id);
        }
        insertLlmTrace({
          runId: params.runId,
          stage: params.stage,
          target: params.target,
          model: params.model,
          attempt: globalAttempt,
          status: "request_failed",
          inputText: prompt,
          errorMessage: message,
          latencyMs: Date.now() - startedAt
        });

        if (isRetryableError(error) && retry < config.OPENAI_MAX_RETRIES) {
          const backoffMs = config.OPENAI_RETRY_BASE_MS * 2 ** retry + Math.round(Math.random() * 200);
          await sleep(backoffMs);
          continue;
        }

        throw error;
      }

      const extractedText = getExtractedText(response);
      const rawResponseJson = safeJsonStringify(response);
      const incompleteReason = getIncompleteReason(response);

      try {
        const parsed = params.parse(response);
        insertLlmTrace({
          runId: params.runId,
          stage: params.stage,
          target: params.target,
          model: params.model,
          attempt: globalAttempt,
          status: "parsed",
          inputText: prompt,
          rawResponseJson,
          extractedText,
          latencyMs: Date.now() - startedAt
        });
        return parsed;
      } catch (parseError) {
        const message = parseError instanceof Error ? parseError.message : "Unable to parse model output";
        lastParseError = new Error(message);
        const parseMessage = incompleteReason ? `${message} (incomplete_reason=${incompleteReason})` : message;
        insertLlmTrace({
          runId: params.runId,
          stage: params.stage,
          target: params.target,
          model: params.model,
          attempt: globalAttempt,
          status: "parse_failed",
          inputText: prompt,
          rawResponseJson,
          extractedText,
          errorMessage: parseMessage,
          latencyMs: Date.now() - startedAt
        });

        const responseId = getResponseId(response);
        const needsContinuation =
          incompleteReason === "max_output_tokens" || looksLikeClarificationRequest(extractedText);

        if (responseId && needsContinuation) {
          const continuationStartedAt = Date.now();
          globalAttempt += 1;
          let continuedResponse: unknown;
          try {
            continuedResponse = await params.client.responses.create({
              model: params.model,
              previous_response_id: responseId,
              input: CONTINUE_JSON_ONLY_INPUT,
              max_output_tokens: Math.min(tokenBudget + 1200, 6000),
              reasoning: { effort: "medium" },
              text: {
                format: {
                  type: "json_schema",
                  name: params.schemaName,
                  strict: true,
                  schema: params.jsonSchema
                }
              }
            } as never);
          } catch (continuationError) {
            const continuationMessage =
              continuationError instanceof Error
                ? continuationError.message
                : "Unknown continuation request error";
            insertLlmTrace({
              runId: params.runId,
              stage: params.stage,
              target: params.target,
              model: params.model,
              attempt: globalAttempt,
              status: "request_failed",
              inputText: `${prompt}\n[continuation] ${CONTINUE_JSON_ONLY_INPUT}`,
              errorMessage: continuationMessage,
              latencyMs: Date.now() - continuationStartedAt
            });

            if (isRetryableError(continuationError) && retry < config.OPENAI_MAX_RETRIES) {
              const backoffMs = config.OPENAI_RETRY_BASE_MS * 2 ** retry + Math.round(Math.random() * 200);
              await sleep(backoffMs);
              continue;
            }

            throw continuationError;
          }

          const continuationExtractedText = getExtractedText(continuedResponse);
          const continuationRawJson = safeJsonStringify(continuedResponse);
          const continuationIncompleteReason = getIncompleteReason(continuedResponse);

          try {
            const parsed = params.parse(continuedResponse);
            insertLlmTrace({
              runId: params.runId,
              stage: params.stage,
              target: params.target,
              model: params.model,
              attempt: globalAttempt,
              status: "parsed",
              inputText: `${prompt}\n[continuation] ${CONTINUE_JSON_ONLY_INPUT}`,
              rawResponseJson: continuationRawJson,
              extractedText: continuationExtractedText,
              latencyMs: Date.now() - continuationStartedAt
            });
            return parsed;
          } catch (continuationParseError) {
            const continuationMessage =
              continuationParseError instanceof Error
                ? continuationParseError.message
                : "Unable to parse continuation output";
            lastParseError = new Error(continuationMessage);
            const continuationParseMessage = continuationIncompleteReason
              ? `${continuationMessage} (incomplete_reason=${continuationIncompleteReason})`
              : continuationMessage;
            insertLlmTrace({
              runId: params.runId,
              stage: params.stage,
              target: params.target,
              model: params.model,
              attempt: globalAttempt,
              status: "parse_failed",
              inputText: `${prompt}\n[continuation] ${CONTINUE_JSON_ONLY_INPUT}`,
              rawResponseJson: continuationRawJson,
              extractedText: continuationExtractedText,
              errorMessage: continuationParseMessage,
              latencyMs: Date.now() - continuationStartedAt
            });

            if (
              continuationIncompleteReason === "max_output_tokens" &&
              retry < config.OPENAI_MAX_RETRIES
            ) {
              const backoffMs = config.OPENAI_RETRY_BASE_MS * 2 ** retry + Math.round(Math.random() * 200);
              await sleep(backoffMs);
              continue;
            }
          }
        }

        if (retry < config.OPENAI_MAX_RETRIES) {
          const backoffMs = config.OPENAI_RETRY_BASE_MS * 2 ** retry + Math.round(Math.random() * 200);
          await sleep(backoffMs);
          continue;
        }

        break;
      }
    }
  }

  throw lastParseError ?? new Error("Unable to parse JSON object from model output");
}

export function createOpenAiProvider(): ResearchProvider {
  return {
    async discoverCasinos(input) {
      const client = getClient();
      const prompt = [
        `You are researching licensed and currently operational online casino brands in ${input.state}.`,
        "Prioritize official state gaming regulators/commission websites and official operator pages.",
        "Use public information only and do not include sportsbooks.",
        `Known casinos already tracked: ${input.knownCasinos.join(", ") || "none"}.`,
        "Return only JSON with shape: {\"casinos\":[{\"casinoName\":string,\"confidence\":number,\"citations\":[{\"title\":string,\"url\":string,\"snippet\":string}]}]}"
      ].join("\n");

      const discoveryTemplate =
        config.OPENAI_PROMPT_ID_DISCOVERY
          ? {
              id: config.OPENAI_PROMPT_ID_DISCOVERY,
              version: config.OPENAI_PROMPT_VERSION_DISCOVERY,
              variables: {
                state: input.state,
                known_casinos: JSON.stringify(input.knownCasinos)
              }
            }
          : undefined;

      let parsed: RawCasinoDiscovery;
      try {
        parsed = await callAndParseJson<RawCasinoDiscovery>({
          client,
          runId: input.runId,
          stage: "casino_discovery",
          target: `${input.state}::all`,
          model: config.OPENAI_MODEL_DISCOVERY,
          basePrompt: prompt,
          promptTemplate: discoveryTemplate,
          schemaName: "casino_discovery",
          jsonSchema: CASINO_DISCOVERY_SCHEMA,
          maxOutputTokens: config.OPENAI_MAX_OUTPUT_TOKENS_DISCOVERY,
          parse: (response) => parseResponseJson(response) as RawCasinoDiscovery
        });
      } catch (error) {
        if (!discoveryTemplate) throw error;
        parsed = await callAndParseJson<RawCasinoDiscovery>({
          client,
          runId: input.runId,
          stage: "casino_discovery",
          target: `${input.state}::all`,
          model: config.OPENAI_MODEL_DISCOVERY,
          basePrompt: prompt,
          schemaName: "casino_discovery",
          jsonSchema: CASINO_DISCOVERY_SCHEMA,
          maxOutputTokens: config.OPENAI_MAX_OUTPUT_TOKENS_DISCOVERY,
          parse: (response) => parseResponseJson(response) as RawCasinoDiscovery
        });
      }

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
    },

    async discoverOffers(input): Promise<DiscoveredOffer[]> {
      const client = getClient();
      const compactOffers = compactCurrentOffers(input.currentOffers);
      const prompt = [
        `Research active CASINO promotional offers for ${input.casinoName} in ${input.state}.`,
        "Exclude sportsbook promotions.",
        "Focus on welcome/new-player and headline promotions.",
        "Use official casino/operator pages first; include citations.",
        `Current known offers: ${JSON.stringify(compactOffers)}`,
        "Return only JSON with shape: {\"offers\":[{\"offerName\":string,\"offerType\":string,\"expectedDeposit\":number,\"expectedBonus\":number,\"confidence\":number,\"citations\":[{\"title\":string,\"url\":string,\"snippet\":string}]}]}"
      ].join("\n");

      const offersTemplate =
        config.OPENAI_PROMPT_ID_OFFERS
          ? {
              id: config.OPENAI_PROMPT_ID_OFFERS,
              version: config.OPENAI_PROMPT_VERSION_OFFERS,
              variables: {
                casino: input.casinoName,
                state: input.state,
                known_offers: JSON.stringify(compactOffers)
              }
            }
          : undefined;

      let parsed: RawOfferDiscovery;
      try {
        parsed = await callAndParseJson<RawOfferDiscovery>({
          client,
          runId: input.runId,
          stage: "offer_discovery",
          target: `${input.state}::${input.casinoName}`,
          model: config.OPENAI_MODEL_EXTRACTION,
          basePrompt: prompt,
          promptTemplate: offersTemplate,
          schemaName: "casino_offers_discovery",
          jsonSchema: OFFERS_DISCOVERY_SCHEMA,
          maxOutputTokens: config.OPENAI_MAX_OUTPUT_TOKENS_OFFERS,
          parse: (response) => parseResponseJson(response) as RawOfferDiscovery
        });
      } catch (error) {
        if (!offersTemplate) throw error;
        parsed = await callAndParseJson<RawOfferDiscovery>({
          client,
          runId: input.runId,
          stage: "offer_discovery",
          target: `${input.state}::${input.casinoName}`,
          model: config.OPENAI_MODEL_EXTRACTION,
          basePrompt: prompt,
          schemaName: "casino_offers_discovery",
          jsonSchema: OFFERS_DISCOVERY_SCHEMA,
          maxOutputTokens: config.OPENAI_MAX_OUTPUT_TOKENS_OFFERS,
          parse: (response) => parseResponseJson(response) as RawOfferDiscovery
        });
      }

      const offers: DiscoveredOffer[] = [];
      for (const offer of parsed.offers ?? []) {
        if (!offer.offerName) continue;
        const normalized: DiscoveredOffer = {
          state: input.state,
          casinoName: input.casinoName,
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
  };
}

export const states: StateAbbreviation[] = ["NJ", "MI", "PA", "WV"];
