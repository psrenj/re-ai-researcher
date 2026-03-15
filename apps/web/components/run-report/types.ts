import type { RunReport } from "@re-ai/shared";

export type Section = "overview" | "casinos" | "offers" | "logs";

export const RUN_REPORT_SECTIONS: Array<[Section, string]> = [
  ["overview", "Overview"],
  ["casinos", "Casinos"],
  ["offers", "Offers"],
  ["logs", "Logs"]
];

export type StateDrilldownItem = {
  casinoName: string;
  better: number;
  unclear: number;
  actionable: number;
  verdict: "better" | "unclear";
  discoveredOfferName: string;
};

export type StateDrilldownSection = {
  state: "NJ" | "MI" | "PA" | "WV";
  actionable: number;
  missing: number;
  better: number;
  unclear: number;
  items: StateDrilldownItem[];
};

export function buildStateDrilldown(report: RunReport): StateDrilldownSection[] {
  return (["NJ", "MI", "PA", "WV"] as const).map((state) => {
    const map = new Map<string, StateDrilldownItem>();

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
}
