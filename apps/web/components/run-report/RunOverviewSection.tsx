import type { RunReport } from "@re-ai/shared";
import Link from "next/link";
import { KpiStrip } from "@/components/KpiStrip";
import { MissingCasinosTable } from "@/components/MissingCasinosTable";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import type { StateDrilldownSection } from "./types";

export function RunOverviewSection({
  report,
  stateDrilldown,
  actionableTotal,
  better,
  unclear
}: {
  report: RunReport;
  stateDrilldown: StateDrilldownSection[];
  actionableTotal: number;
  better: number;
  unclear: number;
}) {
  return (
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
                      <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5">Actionable {section.actionable}</span>
                      <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-800">Missing {section.missing}</span>
                      <span className="rounded border border-green-200 bg-green-50 px-2 py-0.5 text-green-800">Better {section.better}</span>
                      <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-800">Unclear {section.unclear}</span>
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
  );
}
