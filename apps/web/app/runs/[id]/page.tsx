import Link from "next/link";
import type { RunReport } from "@re-ai/shared";
import { RunAutoRefresh } from "@/components/RunAutoRefresh";
import { RunReportWorkspace } from "@/components/RunReportWorkspace";
import { getRun, getRunLlmTraces, getRunLogs, getRunReport } from "@/lib/api";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getRunReport(id).catch(() => null);
  const run = report ? report.run : await getRun(id).catch(() => null);
  const logs = report ? null : await getRunLogs(id).catch(() => ({ stageEvents: [], issues: [] }));
  const llmTraces = await getRunLlmTraces(id, { limit: 300 }).catch(() => []);

  if (!run) {
    return (
      <div className="space-y-6">
        <header className="rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-2xl font-bold">Run Not Found</h1>
            <Link href="/" className="text-sm app-link">
              Back to dashboard
            </Link>
          </div>
        </header>
      </div>
    );
  }

  const hydratedReport: RunReport =
    report ??
    ({
      run,
      discoveredCasinos: [],
      missingCasinos: [],
      offerComparisons: [],
      issues: logs?.issues ?? [],
      stageEvents: logs?.stageEvents ?? [],
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: run.costEstimateUsd
      },
      limitations: []
    } satisfies RunReport);

  return (
    <div className="space-y-6">
      <RunAutoRefresh
        status={run.status}
        enabled={run.status === "queued" || run.status === "running"}
      />
      <RunReportWorkspace
        report={hydratedReport}
        reportReady={run.status === "completed" || run.status === "failed"}
        llmTraces={llmTraces}
      />
    </div>
  );
}
