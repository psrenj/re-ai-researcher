import type { RunReport, RunSummary } from "@re-ai/shared";
import { getRunReport } from "@/lib/api";

type ComparisonReportSlice = Pick<RunReport, "offerComparisons" | "missingCasinos" | "discoveredCasinos">;

export type ComparisonSourceSelection =
  | { strategy: "none" }
  | { strategy: "full"; fullRun: RunSummary }
  | { strategy: "composed"; offersRun?: RunSummary; casinosRun?: RunSummary };

export interface LatestComparisonSnapshot {
  source: ComparisonSourceSelection;
  report: ComparisonReportSlice | null;
}

export function selectComparisonSource(runs: RunSummary[]): ComparisonSourceSelection {
  const completed = runs.filter((run) => run.status === "completed");
  const fullRun = completed.find((run) => run.mode === "full");
  if (fullRun) {
    return { strategy: "full", fullRun };
  }

  const offersRun = completed.find((run) => run.mode === "discover_offers");
  const casinosRun = completed.find((run) => run.mode === "discover_casinos");
  if (offersRun || casinosRun) {
    return { strategy: "composed", offersRun, casinosRun };
  }

  return { strategy: "none" };
}

export async function loadLatestComparisonSnapshot(runs: RunSummary[]): Promise<LatestComparisonSnapshot> {
  const source = selectComparisonSource(runs);
  const completedRuns = runs.filter((run) => run.status === "completed");

  if (source.strategy === "none") {
    return { source, report: null };
  }

  if (source.strategy === "full") {
    const report = await getRunReport(source.fullRun.id).catch(() => null);
    if (report) {
      return {
        source,
        report: {
          offerComparisons: report.offerComparisons,
          missingCasinos: report.missingCasinos,
          discoveredCasinos: report.discoveredCasinos
        }
      };
    }
  }

  const offersRun =
    source.strategy === "composed"
      ? source.offersRun
      : completedRuns.find((run) => run.mode === "discover_offers");
  const casinosRun =
    source.strategy === "composed"
      ? source.casinosRun
      : completedRuns.find((run) => run.mode === "discover_casinos");
  const [offersReport, casinosReport] = await Promise.all([
    offersRun ? getRunReport(offersRun.id).catch(() => null) : Promise.resolve(null),
    casinosRun ? getRunReport(casinosRun.id).catch(() => null) : Promise.resolve(null)
  ]);

  if (!offersReport && !casinosReport) {
    return {
      source:
        offersRun || casinosRun
          ? { strategy: "composed", offersRun, casinosRun }
          : { strategy: "none" },
      report: null
    };
  }

  return {
    source: { strategy: "composed", offersRun, casinosRun },
    report: {
      offerComparisons: offersReport?.offerComparisons ?? [],
      missingCasinos: casinosReport?.missingCasinos ?? [],
      discoveredCasinos: casinosReport?.discoveredCasinos ?? []
    }
  };
}
