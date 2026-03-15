import { ActionSidebar } from "@/components/ActionSidebar";
import { KpiStrip } from "@/components/KpiStrip";
import { StateBreakdown } from "@/components/StateBreakdown";
import { getBaselineCasinos, getBaselineStats, listRuns } from "@/lib/api";
import { loadLatestComparisonSnapshot } from "@/lib/comparison-source";

function normalizeCasinoKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

export default async function HomePage() {
  let runs = [] as Awaited<ReturnType<typeof listRuns>>;
  let runsError: string | null = null;
  try {
    runs = await listRuns();
  } catch (error) {
    runsError = error instanceof Error ? error.message : "Failed to load runs";
  }
  let report = null as Awaited<ReturnType<typeof loadLatestComparisonSnapshot>>["report"];
  let reportError: string | null = null;
  const comparisonSnapshot = await loadLatestComparisonSnapshot(runs).catch((error) => {
    reportError = error instanceof Error ? error.message : "Failed to load latest report";
    return null;
  });
  if (comparisonSnapshot) {
    report = comparisonSnapshot.report;
  }
  const sourceLabel =
    comparisonSnapshot?.source.strategy === "full"
      ? `Comparison source: full run ${comparisonSnapshot.source.fullRun.id.slice(0, 8)}`
      : comparisonSnapshot?.source.strategy === "composed"
        ? `Comparison source: ${
            comparisonSnapshot.source.offersRun
              ? `offers ${comparisonSnapshot.source.offersRun.id.slice(0, 8)}`
              : "offers n/a"
          } + ${
            comparisonSnapshot.source.casinosRun
              ? `casinos ${comparisonSnapshot.source.casinosRun.id.slice(0, 8)}`
              : "casinos n/a"
          }`
        : "Comparison source: no completed run source";
  let baselineStats = null as Awaited<ReturnType<typeof getBaselineStats>> | null;
  let baselineError: string | null = null;
  try {
    baselineStats = await getBaselineStats();
  } catch (error) {
    baselineError = error instanceof Error ? error.message : "Failed to load baseline stats";
  }
  const baselineCasinos = await getBaselineCasinos().catch(() => []);
  const trackedCasinoKeySet = new Set(
    baselineCasinos.map((casino) => `${casino.state}::${normalizeCasinoKey(casino.casinoName)}`)
  );
  const trackedComparisons = (report?.offerComparisons ?? []).filter((comparison) =>
    trackedCasinoKeySet.has(`${comparison.state}::${normalizeCasinoKey(comparison.casinoName)}`)
  );
  const actionableComparisons = trackedComparisons.filter((item) => item.verdict !== "same");
  const stateBreakdown = (["NJ", "MI", "PA", "WV"] as const).map((state) => {
    const tracked = actionableComparisons.filter((item) => item.state === state).length;
    const missing = report?.missingCasinos.filter((item) => item.state === state).length ?? 0;
    const better = actionableComparisons.filter(
      (item) => item.state === state && item.verdict === "better"
    ).length ?? 0;
    const unclear = actionableComparisons.filter(
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
          {runsError ? <p className="mt-2 text-sm text-rose-700">Runs load error: {runsError}</p> : null}
          {baselineError ? (
            <p className="mt-1 text-sm text-rose-700">Baseline load error: {baselineError}</p>
          ) : null}
          {reportError ? (
            <p className="mt-1 text-sm text-rose-700">Latest report load error: {reportError}</p>
          ) : null}
          {baselineStats ? (
            <p className="mt-1 text-xs text-slate-500">
              Baseline tracked casinos: {baselineStats.totalTrackedCasinos} ({baselineStats.totalOfferRows} offer rows)
            </p>
          ) : null}
          <p className="mt-1 text-xs text-slate-500">{sourceLabel}</p>
        </header>

        <div className="rounded-2xl border border-border bg-white lg:hidden">
          <ActionSidebar activeNav="dashboard" />
        </div>

        {baselineStats || report ? (
          <KpiStrip
            tracked={actionableComparisons.length}
            missing={report?.missingCasinos.length ?? 0}
            better={actionableComparisons.filter((item) => item.verdict === "better").length}
            unclear={actionableComparisons.filter((item) => item.verdict === "unclear").length}
            trackedLabel="Actionable Casinos"
          />
        ) : null}

        <StateBreakdown items={stateBreakdown} />
      </div>
    </div>
  );
}
