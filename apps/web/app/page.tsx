import { ActionSidebar } from "@/components/ActionSidebar";
import { KpiStrip } from "@/components/KpiStrip";
import { StateBreakdown } from "@/components/StateBreakdown";
import { getBaselineStats, getRunReport, listRuns } from "@/lib/api";

export default async function HomePage() {
  const runs = await listRuns().catch(() => []);
  const latest = runs[0];
  const report = latest ? await getRunReport(latest.id).catch(() => null) : null;
  const baselineStats = await getBaselineStats().catch(() => null);
  const stateBreakdown = (["NJ", "MI", "PA", "WV"] as const).map((state) => {
    const tracked =
      baselineStats?.byState.find((item) => item.state === state)?.trackedCasinos ??
      (report?.offerComparisons.filter((item) => item.state === state).length ?? 0);
    const missing = report?.missingCasinos.filter((item) => item.state === state).length ?? 0;
    const better = report?.offerComparisons.filter(
      (item) => item.state === state && item.verdict === "better"
    ).length ?? 0;
    const unclear = report?.offerComparisons.filter(
      (item) => item.state === state && item.verdict === "unclear"
    ).length ?? 0;
    return { state, tracked, missing, better, unclear };
  });

  return (
    <div className="space-y-6">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-80 border-r border-slate-200 bg-white lg:block">
        <ActionSidebar activeNav="dashboard" />
      </aside>

      <div className="space-y-6 lg:ml-80 lg:pl-6">
        <header className="rounded-2xl border border-border bg-card p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Casino Offer AI Researcher</p>
          <h1 className="mt-2 text-3xl font-bold">Research Dashboard</h1>
          <p className="mt-2 text-sm text-slate-600">
            AI-first coverage monitoring for NJ, MI, PA, and WV casino offers.
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Use actions panel for full run or stage-specific run modes.
          </p>
          {baselineStats ? (
            <p className="mt-1 text-xs text-slate-500">
              Baseline tracked casinos: {baselineStats.totalTrackedCasinos} ({baselineStats.totalOfferRows} offer rows)
            </p>
          ) : null}
        </header>

        <div className="rounded-2xl border border-border bg-white lg:hidden">
          <ActionSidebar activeNav="dashboard" />
        </div>

        {latest ? (
          <KpiStrip
            tracked={baselineStats?.totalTrackedCasinos ?? latest.comparisonCount}
            missing={latest.missingCount}
            better={latest.betterCount}
            unclear={latest.unclearCount}
          />
        ) : null}

        <StateBreakdown items={stateBreakdown} />
      </div>
    </div>
  );
}
