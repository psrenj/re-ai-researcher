import "dotenv/config";
import path from "node:path";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(8787),
  API_KEY: z.string().min(1, "API_KEY is required"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL_DISCOVERY: z.string().default("gpt-4.1-mini"),
  OPENAI_MODEL_EXTRACTION: z.string().default("gpt-4.1"),
  OPENAI_PROMPT_ID_CASINO_DISCOVERY: z.string().optional(),
  OPENAI_PROMPT_VERSION_CASINO_DISCOVERY: z.string().optional(),
  OPENAI_PROMPT_ID_CASINO_OFFERS_DISCOVERY: z.string().optional(),
  OPENAI_PROMPT_VERSION_CASINO_OFFERS_DISCOVERY: z.string().optional(),
  OPENAI_PROMPT_ID_DISCOVERY: z.string().optional(),
  OPENAI_PROMPT_VERSION_DISCOVERY: z.string().optional(),
  OPENAI_PROMPT_ID_OFFERS: z.string().optional(),
  OPENAI_PROMPT_VERSION_OFFERS: z.string().optional(),
  OPENAI_MAX_OUTPUT_TOKENS_DISCOVERY: z.coerce.number().int().positive().default(2600),
  OPENAI_MAX_OUTPUT_TOKENS_OFFERS: z.coerce.number().int().positive().default(2400),
  OPENAI_CONCURRENCY: z.coerce.number().int().positive().default(5),
  OPENAI_MAX_RETRIES: z.coerce.number().int().min(0).default(2),
  OPENAI_RETRY_BASE_MS: z.coerce.number().int().positive().default(800),
  DATABASE_PATH: z.string().default(path.resolve(process.cwd(), "../../data/research.sqlite")),
  XANO_ENDPOINT: z
    .string()
    .url()
    .default("https://xhks-nxia-vlqr.n7c.xano.io/api:1ZwRS-f0/activeSUB"),
  MAX_CASINOS_PER_RUN: z.coerce.number().int().positive().default(20),
  MAX_STATES_PER_RUN: z.coerce.number().int().positive().default(4),
  CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.65),
  RUN_TOKEN_CAP: z.coerce.number().int().positive().default(200000)
});

const parsed = envSchema.parse(process.env);
export const config = {
  ...parsed,
  OPENAI_PROMPT_ID_DISCOVERY:
    parsed.OPENAI_PROMPT_ID_CASINO_DISCOVERY ?? parsed.OPENAI_PROMPT_ID_DISCOVERY,
  OPENAI_PROMPT_VERSION_DISCOVERY:
    parsed.OPENAI_PROMPT_VERSION_CASINO_DISCOVERY ?? parsed.OPENAI_PROMPT_VERSION_DISCOVERY,
  OPENAI_PROMPT_ID_OFFERS:
    parsed.OPENAI_PROMPT_ID_CASINO_OFFERS_DISCOVERY ?? parsed.OPENAI_PROMPT_ID_OFFERS,
  OPENAI_PROMPT_VERSION_OFFERS:
    parsed.OPENAI_PROMPT_VERSION_CASINO_OFFERS_DISCOVERY ?? parsed.OPENAI_PROMPT_VERSION_OFFERS
};
export type Config = typeof config;

export const SUPPORTED_STATES = ["NJ", "MI", "PA", "WV"] as const;
