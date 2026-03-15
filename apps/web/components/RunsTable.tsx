"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RunSummary } from "@re-ai/shared";

export function RunsTable({ initialRuns }: { initialRuns: RunSummary[] }) {
  const router = useRouter();
  const [runs, setRuns] = useState(initialRuns);
  const [pendingRunId, setPendingRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cancelRun(run: RunSummary) {
    const runId = run.id;
    const isActive = run.status === "queued" || run.status === "running";
    if (!isActive) {
      return;
    }
    setPendingRunId(runId);
    setError(null);
    try {
      const response = await fetch(`/api/runs/${encodeURIComponent(runId)}/cancel`, { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        matches?: string[];
        runId?: string;
        status?: RunSummary["status"];
      };

      if (!response.ok) {
        if (payload.error === "Ambiguous run id prefix" && payload.matches && payload.matches.length > 0) {
          setError(`Ambiguous run id: ${payload.matches.join(", ")}`);
          return;
        }
        if (payload.error === "Run is not active") {
          const affectedId = payload.runId ?? runId;
          setRuns((prev) =>
            prev.map((item) =>
              item.id === affectedId
                ? {
                    ...item,
                    status: payload.status ?? item.status
                  }
                : item
            )
          );
          router.refresh();
          return;
        }
        setError(payload.error ?? "Failed to cancel run");
        return;
      }

      const affectedId = payload.runId ?? runId;
      setRuns((prev) =>
        prev.map((item) =>
          item.id === affectedId
            ? {
                ...item,
                status: "failed",
                completedAt: new Date().toISOString()
              }
            : item
        )
      );
      router.refresh();
    } catch {
      setError("Failed to cancel run");
    } finally {
      setPendingRunId(null);
    }
  }

  return (
    <div className="overflow-x-auto">
      {error ? <p className="mb-2 text-sm text-rose-700">{error}</p> : null}
      <table className="app-table w-full min-w-[760px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-slate-500">
            <th className="py-2">Run</th>
            <th className="py-2">Status</th>
            <th className="py-2">Trigger</th>
            <th className="py-2">Mode</th>
            <th className="py-2">Missing</th>
            <th className="py-2">Better</th>
            <th className="py-2">Created</th>
            <th className="py-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} className="border-b border-border/70">
              <td className="py-3 font-mono text-xs">{run.id.slice(0, 8)}</td>
              <td className="py-3">{run.status}</td>
              <td className="py-3">{run.trigger}</td>
              <td className="py-3">{run.mode}</td>
              <td className="py-3">{run.missingCount}</td>
              <td className="py-3">{run.betterCount}</td>
              <td className="py-3">{new Date(run.createdAt).toLocaleString()}</td>
              <td className="py-3">
                <div className="flex items-center gap-3">
                  <Link href={`/runs/${run.id}`} className="app-link">
                    Open
                  </Link>
                  {run.status === "queued" || run.status === "running" ? (
                    <button
                      type="button"
                      onClick={() => void cancelRun(run)}
                      disabled={pendingRunId !== null}
                      className="text-xs font-semibold text-rose-700 transition hover:text-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {pendingRunId === run.id ? "Cancelling..." : "Cancel"}
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
          {runs.length === 0 ? (
            <tr>
              <td className="py-3 text-slate-500" colSpan={8}>
                No runs yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
