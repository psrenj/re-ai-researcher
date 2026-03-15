import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/config";

type ParamsInput = { params: Promise<{ runId: string }> | { runId: string } };

function normalizeParams(input: ParamsInput["params"]): Promise<{ runId: string }> {
  if (typeof (input as Promise<{ runId: string }>).then === "function") {
    return input as Promise<{ runId: string }>;
  }
  return Promise.resolve(input as { runId: string });
}

export async function POST(_request: Request, context: ParamsInput) {
  const { runId } = await normalizeParams(context.params);
  const { API_BASE_URL, API_KEY } = getServerEnv();

  const response = await fetch(`${API_BASE_URL}/api/runs/${encodeURIComponent(runId)}/cancel`, {
    method: "POST",
    headers: {
      "x-api-key": API_KEY
    },
    cache: "no-store"
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(payload, { status: response.status });
}

