import OpenAI from "openai";
import { config } from "../config.js";
import { insertLlmTrace } from "../repository.js";
import {
  CONTINUE_JSON_ONLY_INPUT,
  PROCEED_IMMEDIATELY_SUFFIX,
  STRICT_JSON_SUFFIX,
  type PromptTemplateConfig,
  type TraceStage
} from "./constants.js";
import {
  getExtractedText,
  getIncompleteReason,
  getResponseId,
  isRetryableError,
  looksLikeClarificationRequest,
  safeJsonStringify,
  sleep
} from "./responseUtils.js";

const disabledPromptTemplates = new Set<string>();

export async function callAndParseJson<T>(params: {
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

            if (continuationIncompleteReason === "max_output_tokens" && retry < config.OPENAI_MAX_RETRIES) {
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
