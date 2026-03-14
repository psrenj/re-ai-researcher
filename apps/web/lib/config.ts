import { z } from "zod";

type ServerEnv = {
  API_BASE_URL: string;
  API_KEY: string;
};

function normalizeEnvValue(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

const envSchema = z.object({
  API_BASE_URL: z.string().optional(),
  NEXT_PUBLIC_API_BASE_URL: z.string().optional(),
  API_KEY: z.string().optional(),
  RESEARCH_API_KEY: z.string().optional()
});

export function getServerEnv(): ServerEnv {
  const parsed = envSchema.parse(process.env);

  const baseUrlCandidate =
    parsed.API_BASE_URL ?? parsed.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787";
  const API_BASE_URL = z.string().url("API_BASE_URL must be a valid URL").parse(baseUrlCandidate);
  const API_KEY = parsed.API_KEY ?? parsed.RESEARCH_API_KEY;

  if (!API_KEY) {
    throw new Error("API_KEY is required for web server API calls");
  }

  return { API_BASE_URL, API_KEY };
}
