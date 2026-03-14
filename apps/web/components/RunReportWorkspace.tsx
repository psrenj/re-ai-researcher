"use client";

import { useState } from "react";
import type { LlmTrace, RunReport } from "@re-ai/shared";
import Link from "next/link";
import { ComparisonsTable } from "@/components/ComparisonsTable";
import { DiscoveredCasinosTable } from "@/components/DiscoveredCasinosTable";
import { RunLogsSection } from "@/components/run-report/RunLogsSection";
import { RunMobileSectionPicker } from "@/components/run-report/RunMobileSectionPicker";
import { RunOverviewSection } from "@/components/run-report/RunOverviewSection";
import { RunSidebar } from "@/components/run-report/RunSidebar";
import { buildStateDrilldown, type Section } from "@/components/run-report/types";

export function RunReportWorkspace({
  report,
  reportReady = true,
  llmTraces = []
}: {
  report: RunReport;
  reportReady?: boolean;
  llmTraces?: LlmTrace[];
}) {
  const [section, setSection] = useState<Section>(reportReady ? "overview" : "logs");

  const better = report.offerComparisons.filter((item) => item.verdict === "better").length;
  const unclear = report.offerComparisons.filter((item) => item.verdict === "unclear").length;
  const actionableTotal = better + unclear;
  const failedTraceCount = llmTraces.filter((item) => item.status !== "parsed").length;
  const stateDrilldown = buildStateDrilldown(report);

  return (
    <div className="relative">
      <RunSidebar report={report} section={section} onSectionChange={setSection} />

      <section className="space-y-6 lg:ml-80 lg:pl-6">
        <header className="rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-2xl font-bold">Run Report</h1>
            <Link
              href="/"
              className="rounded-md border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800 lg:hidden"
            >
              Dashboard
            </Link>
          </div>
          <p className="mt-2 font-mono text-xs text-slate-500">Run ID: {report.run.id}</p>
          <p className="mt-1 text-sm text-slate-600">
            Status: {report.run.status} | Trigger: {report.run.trigger} | Mode: {report.run.mode}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            LLM Calls: {llmTraces.length} | Parse/Request Failures: {failedTraceCount}
          </p>
        </header>

        {!reportReady ? (
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            Run is still generating findings. Logs update live and tables will populate as stages complete.
          </div>
        ) : null}

        <RunMobileSectionPicker section={section} onSectionChange={setSection} />

        {section === "overview" ? (
          <RunOverviewSection
            report={report}
            stateDrilldown={stateDrilldown}
            actionableTotal={actionableTotal}
            better={better}
            unclear={unclear}
          />
        ) : null}

        {section === "casinos" ? (
          <DiscoveredCasinosTable
            casinos={report.discoveredCasinos}
            title="Casinos Found During Discovery"
            description="Discovery output with confidence and source citations."
          />
        ) : null}

        {section === "offers" ? <ComparisonsTable comparisons={report.offerComparisons} /> : null}

        {section === "logs" ? <RunLogsSection report={report} llmTraces={llmTraces} /> : null}
      </section>
    </div>
  );
}
