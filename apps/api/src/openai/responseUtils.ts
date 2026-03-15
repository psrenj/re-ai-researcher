import { extractJsonObject } from "../utils.js";

export function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ error: "Unable to stringify response payload" });
  }
}

export function getIncompleteReason(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;
  const value = response as { incomplete_details?: { reason?: unknown } };
  const reason = value.incomplete_details?.reason;
  return typeof reason === "string" ? reason : null;
}

export function getResponseId(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;
  const value = response as { id?: unknown };
  return typeof value.id === "string" ? value.id : null;
}

export function isRetryableError(error: unknown): boolean {
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

export async function sleep(ms: number): Promise<void> {
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

export function getExtractedText(response: unknown): string {
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

export function parseResponseJson(response: unknown): unknown {
  if (response && typeof response === "object") {
    const value = response as { output_parsed?: unknown };
    if (value.output_parsed && typeof value.output_parsed === "object") {
      return value.output_parsed;
    }
  }
  return extractJsonObject(getExtractedText(response));
}

export function looksLikeClarificationRequest(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes("do you want me to proceed") ||
    normalized.includes("would you like me to proceed") ||
    normalized.includes("please confirm") ||
    normalized.includes("confirm before")
  );
}
