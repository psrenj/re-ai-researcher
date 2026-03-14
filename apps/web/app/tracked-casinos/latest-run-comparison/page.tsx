import { ActionSidebar } from "@/components/ActionSidebar";
import { ComparisonsTable } from "@/components/ComparisonsTable";
import { KpiStrip } from "@/components/KpiStrip";
import { StateBreakdownView } from "@/components/StateBreakdown";
import { getBaselineCasinos, getRunReport, listRuns } from "@/lib/api";

function normalizeCasinoKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

export default async function TrackedVsLatestRunPage() {
  const baselineCasinos = await getBaselineCasinos().catch(() => []);
  const runs = await listRuns().catch(() => []);
  const latest = runs[0];
  const report = latest ? await getRunReport(latest.id).catch(() => null) : null;

  const trackedCasinoKeySet = new Set(
    baselineCasinos.map((casino) => `${casino.state}::${normalizeCasinoKey(casino.casinoName)}`)
  );
  const trackedComparisons = (report?.offerComparisons ?? []).filter((comparison) =>
    trackedCasinoKeySet.has(`${comparison.state}::${normalizeCasinoKey(comparison.casinoName)}`)
  );
  const actionableComparisons = trackedComparisons.filter((item) => item.verdict !== "same");
  const stateBreakdown = (["NJ", "MI", "PA", "WV"] as const).map((state) => ({
    state,
    tracked: actionableComparisons.filter((item) => item.state === state).length,
    missing: report?.missingCasinos.filter((item) => item.state === state).length ?? 0,
    better: actionableComparisons.filter((item) => item.state === state && item.verdict === "better").length,
    unclear:
      actionableComparisons.filter((item) => item.state === state && item.verdict === "unclear").length
  }));
  const betterCount = actionableComparisons.filter((item) => item.verdict === "better").length;
  const unclearCount = actionableComparisons.filter((item) => item.verdict === "unclear").length;

  return (
    <div className="space-y-6">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-80 border-r border-slate-200 bg-white lg:block">
        <ActionSidebar activeNav="tracked_vs_latest" />
      </aside>

      <div className="space-y-6 lg:ml-80 lg:pl-6">
        <header className="rounded-2xl border border-border bg-card p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Casino Offer AI Researcher</p>
          <h1 className="mt-2 text-3xl font-bold">Tracked Offers vs Latest Run</h1>
          <p className="mt-2 text-sm text-slate-600">
            Actionable differences for baseline-tracked casinos against the latest completed run.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {latest ? `Latest run: ${latest.id.slice(0, 8)} (${latest.status})` : "No runs yet"}
          </p>
        </header>

        <KpiStrip
          tracked={actionableComparisons.length}
          missing={report?.missingCasinos.length ?? 0}
          better={betterCount}
          unclear={unclearCount}
          trackedLabel="Actionable Casinos"
        />

        <StateBreakdownView
          items={stateBreakdown}
          primaryLabel="Actionable Casinos"
          primaryShortLabel="Actionable"
        />
        <ComparisonsTable comparisons={trackedComparisons} />
      </div>
    </div>
  );
}
