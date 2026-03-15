import { NextResponse } from "next/server";
import type { RunMode } from "@re-ai/shared";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8787";
const API_KEY = process.env.API_KEY;

function normalizeMode(value: unknown): RunMode {
  if (value === "discover_casinos" || value === "discover_offers" || value === "full") {
    return value;
  }
  return "full";
}

export async function POST(request: Request) {
  if (!API_KEY) {
    return NextResponse.json({ error: "API_KEY is missing" }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as { mode?: RunMode };
  const mode = normalizeMode(body.mode);

  const response = await fetch(`${API_BASE_URL}/api/runs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": API_KEY
    },
    body: JSON.stringify({ mode })
  });

  const payload = (await response.json().catch(() => ({}))) as {
    runId?: string;
    error?: string;
    mode?: RunMode;
  };

  if (!response.ok) {
    return NextResponse.json({ error: payload.error ?? "Failed to trigger run" }, { status: response.status });
  }

  return NextResponse.json({ runId: payload.runId, mode: payload.mode ?? mode });
}
