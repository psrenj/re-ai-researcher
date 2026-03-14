"use client";

import { useState } from "react";
import type { LlmTrace, RunReport } from "@re-ai/shared";
import Link from "next/link";
import { ComparisonsTable } from "@/components/ComparisonsTable";
import { DiscoveredCasinosTable } from "@/components/DiscoveredCasinosTable";
import { KpiStrip } from "@/components/KpiStrip";
import { MissingCasinosTable } from "@/components/MissingCasinosTable";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";

type Section = "overview" | "casinos" | "offers" | "logs";

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
  const stateDrilldown = (["NJ", "MI", "PA", "WV"] as const).map((state) => {
    const map = new Map<
      string,
      {
        casinoName: string;
        better: number;
        unclear: number;
        actionable: number;
        verdict: "better" | "unclear";
        discoveredOfferName: string;
      }
    >();

    const actionableComparisons = report.offerComparisons.filter(
      (item) => item.state === state && (item.verdict === "better" || item.verdict === "unclear")
    );

    for (const comparison of actionableComparisons) {
      if (comparison.verdict !== "better" && comparison.verdict !== "unclear") {
        continue;
      }
      const current = map.get(comparison.casinoName) ?? {
        casinoName: comparison.casinoName,
        better: 0,
        unclear: 0,
        actionable: 0,
        verdict: comparison.verdict,
        discoveredOfferName: comparison.discoveredOffer?.offerName ?? "No discovered offer"
      };
      if (comparison.verdict === "better") {
        current.better += 1;
        current.actionable += 1;
      }
      if (comparison.verdict === "unclear") {
        current.unclear += 1;
        current.actionable += 1;
      }
      map.set(comparison.casinoName, current);
    }

    return {
      state,
      actionable: actionableComparisons.length,
      missing: report.missingCasinos.filter((item) => item.state === state).length,
      better: actionableComparisons.filter((item) => item.verdict === "better").length,
      unclear: actionableComparisons.filter((item) => item.verdict === "unclear").length,
      items: Array.from(map.values()).sort((a, b) => {
        if (a.actionable !== b.actionable) return b.actionable - a.actionable;
        return a.casinoName.localeCompare(b.casinoName);
      })
    };
  });

  return (
    <div className="relative">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-80 border-r border-slate-200 bg-white lg:block">
        <div className="flex h-full flex-col">
          <div className="px-5 pb-4 pt-6">
            <p className="text-base font-bold tracking-tight">RE AI Researcher</p>
            <p className="text-xs text-slate-500">Control Center</p>
          </div>

          <div className="border-t border-slate-200 px-4 py-3">
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Navigation</p>
            <div className="mt-2 space-y-1">
              <Link
                href="/"
                className="block rounded-lg border border-transparent bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50/70"
              >
                Dashboard
              </Link>
              <Link
                href="/tracked-casinos"
                className="block rounded-lg border border-transparent bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50/70"
              >
                Tracked Casinos
              </Link>
              <Link
                href="/tracked-casinos/latest-run-comparison"
                className="block rounded-lg border border-transparent bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50/70"
              >
                Latest Run Comparison
              </Link>
              <Link
                href="/runs"
                className="block rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 shadow-sm"
              >
                Recent Runs
              </Link>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <div className="mt-5 border-t border-slate-200 pt-4">
              <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Views</p>
              <div className="mt-2 space-y-1">
                {([
                  ["overview", "Overview"],
                  ["casinos", "Casinos"],
                  ["offers", "Offers"],
                  ["logs", "Logs"]
                ] as Array<[Section, string]>).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSection(value)}
                    className={cn(
                      "w-full rounded-lg border px-3 py-2 text-left text-sm font-semibold transition",
                      section === value
                        ? "border-sky-300 bg-sky-50 text-sky-800 shadow-sm"
                        : "border-transparent bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50/70"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-4">
              <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Recent Stage Events</p>
              <ul className="mt-2 space-y-2 text-xs">
                {report.stageEvents.slice(-5).map((event, index) => (
                  <li key={`${event.stage}-${event.createdAt}-${index}`} className="rounded-md bg-slate-50 p-2 text-slate-700">
                    <p className="font-semibold">{event.stage}</p>
                    <p className="text-slate-500">{event.status}</p>
                  </li>
                ))}
                {report.stageEvents.length === 0 ? <li className="px-1 text-slate-500">No stage events recorded.</li> : null}
              </ul>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-4">
              <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Issues</p>
              <ul className="mt-2 space-y-2 text-xs">
                {report.issues.slice(-3).map((issue, index) => (
                  <li key={`${issue.category}-${issue.title}-${index}`} className="rounded-md bg-slate-50 p-2 text-slate-700">
                    <p className="font-semibold">{issue.title}</p>
                    <p className="text-slate-500">{issue.severity}</p>
                  </li>
                ))}
                {report.issues.length === 0 ? <li className="px-1 text-slate-500">No issues recorded.</li> : null}
              </ul>
            </div>
          </div>
        </div>
      </aside>

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

        <Card className="lg:hidden">
          <CardContent>
            <p className="text-sm font-semibold">Views</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {([
                ["overview", "Overview"],
                ["casinos", "Casinos"],
                ["offers", "Offers"],
                ["logs", "Logs"]
              ] as Array<[Section, string]>).map(([value, label]) => (
                <button
                  key={`mobile-${value}`}
                  type="button"
                  onClick={() => setSection(value)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm font-semibold",
                    section === value
                      ? "border-accent bg-sky-50 text-accent"
                      : "border-border bg-white text-slate-700"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {section === "overview" ? (
          <>
            <KpiStrip
              tracked={actionableTotal}
              missing={report.missingCasinos.length}
              better={better}
              unclear={unclear}
              trackedLabel="Actionable Casinos"
            />

            <MissingCasinosTable
              items={report.missingCasinos}
              title="Missing Casinos by State"
              description="Casinos discovered in research but not present in the current baseline feed."
            />

            <Card>
              <CardContent>
                <h2 className="mb-1 text-lg font-semibold">State and Casino Drilldown</h2>
                <p className="mb-3 text-sm text-slate-600">
                  Expand a state to inspect actionable findings and open tracked offers with latest discovery context.
                </p>
                <div className="space-y-3">
                  {stateDrilldown.map((section) => (
                    <details key={section.state} className="rounded-lg border border-border bg-white p-3" open>
                      <summary className="cursor-pointer text-sm font-semibold">
                        <div className="flex items-center justify-between gap-3">
                          <span>
                            {section.state} ({section.items.length} casinos)
                          </span>
                          <span className="flex items-center gap-2 text-[11px] font-medium text-slate-600">
                            <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5">
                              Actionable {section.actionable}
                            </span>
                            <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-800">
                              Missing {section.missing}
                            </span>
                            <span className="rounded border border-green-200 bg-green-50 px-2 py-0.5 text-green-800">
                              Better {section.better}
                            </span>
                            <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-800">
                              Unclear {section.unclear}
                            </span>
                          </span>
                        </div>
                      </summary>
                      <div className="mt-3 overflow-x-auto">
                        <table className="app-table w-full min-w-[760px] text-left text-xs">
                          <thead>
                            <tr className="border-b border-border text-slate-500">
                              <th className="py-2">Casino</th>
                              <th className="py-2">Latest Discovered Offer</th>
                              <th className="py-2">Verdict</th>
                              <th className="py-2">Open</th>
                            </tr>
                          </thead>
                          <tbody>
                            {section.items.map((item) => (
                              <tr key={`${section.state}-${item.casinoName}`} className="border-b border-border/70">
                                <td className="py-2 font-medium">{item.casinoName}</td>
                                <td className="py-2 text-slate-700">{item.discoveredOfferName}</td>
                                <td className="py-2">
                                  <span
                                    className={cn(
                                      "rounded-md border px-2 py-1 text-[11px] font-semibold",
                                      item.verdict === "better"
                                        ? "border-success bg-green-50 text-success"
                                        : "border-warning bg-amber-50 text-warning"
                                    )}
                                  >
                                    {item.verdict}
                                  </span>
                                </td>
                                <td className="py-2">
                                  <Link
                                    href={`/tracked-casinos/state/${section.state}/casino/${encodeURIComponent(item.casinoName)}`}
                                    className="app-link"
                                  >
                                    View Offers
                                  </Link>
                                </td>
                              </tr>
                            ))}
                            {section.items.length === 0 ? (
                              <tr>
                                <td className="py-2 text-slate-500" colSpan={4}>
                                  No better/unclear findings for this state.
                                </td>
                              </tr>
                            ) : null}
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-2">
                        <Link href={`/runs/${report.run.id}/state/${section.state}`} className="text-xs app-link">
                          Open run state page
                        </Link>
                      </div>
                    </details>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}

        {section === "casinos" ? (
          <DiscoveredCasinosTable
            casinos={report.discoveredCasinos}
            title="Casinos Found During Discovery"
            description="Discovery output with confidence and source citations."
          />
        ) : null}

        {section === "offers" ? <ComparisonsTable comparisons={report.offerComparisons} /> : null}

        {section === "logs" ? (
          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold">Run Events, Issues, and LLM Traces</h2>
              <div className="mt-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                Failed targets can be inspected in the LLM Traces table below.
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold">Stage Events</p>
                  <ul className="mt-2 space-y-2 text-sm">
                    {report.stageEvents.map((event, index) => (
                      <li key={`${event.stage}-${event.createdAt}-${index}`} className="rounded-md border border-border p-3">
                        <p className="font-semibold">{event.stage}</p>
                        <p className="text-slate-600">Status: {event.status}</p>
                        {event.reason ? <p className="text-slate-600">Reason: {event.reason}</p> : null}
                        {event.impact ? <p className="text-slate-600">Impact: {event.impact}</p> : null}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-sm font-semibold">Issues</p>
                  <ul className="mt-2 space-y-2 text-sm">
                    {report.issues.map((issue, index) => (
                      <li key={`${issue.category}-${issue.title}-${index}`} className="rounded-md border border-border p-3">
                        <p className="font-semibold">{issue.title}</p>
                        <p className="text-slate-600">Severity: {issue.severity}</p>
                        <p className="text-slate-600">{issue.details}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-sm font-semibold">LLM Traces</p>
                <div className="mt-2 overflow-x-auto">
                  <table className="app-table w-full min-w-[860px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-border text-slate-500">
                        <th className="py-2">ID</th>
                        <th className="py-2">Stage</th>
                        <th className="py-2">Target</th>
                        <th className="py-2">Status</th>
                        <th className="py-2">Latency</th>
                        <th className="py-2">Trace</th>
                      </tr>
                    </thead>
                    <tbody>
                      {llmTraces.map((trace) => (
                        <tr key={trace.id} className="border-b border-border/70">
                          <td className="py-2 font-mono">{trace.id}</td>
                          <td className="py-2">{trace.stage}</td>
                          <td className="py-2">{trace.target}</td>
                          <td className="py-2">{trace.status}</td>
                          <td className="py-2">{trace.latencyMs}ms</td>
                          <td className="py-2">
                            <details>
                              <summary className="cursor-pointer text-sky-700">View raw</summary>
                              <div className="mt-2 space-y-2">
                                {trace.errorMessage ? <p className="text-red-600">{trace.errorMessage}</p> : null}
                                {trace.extractedText ? (
                                  <pre className="max-h-36 overflow-auto rounded bg-slate-50 p-2 whitespace-pre-wrap">
                                    {trace.extractedText}
                                  </pre>
                                ) : null}
                                {trace.rawResponseJson ? (
                                  <pre className="max-h-48 overflow-auto rounded bg-slate-50 p-2 whitespace-pre-wrap">
                                    {trace.rawResponseJson}
                                  </pre>
                                ) : null}
                              </div>
                            </details>
                          </td>
                        </tr>
                      ))}
                      {llmTraces.length === 0 ? (
                        <tr>
                          <td className="py-3 text-slate-500" colSpan={6}>
                            No LLM traces recorded yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </section>
    </div>
  );
}
