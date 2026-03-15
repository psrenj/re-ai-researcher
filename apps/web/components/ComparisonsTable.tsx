/* eslint-disable jsx-a11y/label-has-associated-control */
"use client";

import { useMemo, useState } from "react";
import type { OfferComparison } from "@re-ai/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

function verdictClass(verdict: OfferComparison["verdict"]): string {
  if (verdict === "better") return "border-success bg-green-50 text-success";
  if (verdict === "unclear") return "border-warning bg-amber-50 text-warning";
  return "border-border bg-slate-50 text-slate-700";
}

function verdictRank(verdict: OfferComparison["verdict"]): number {
  if (verdict === "better") return 0;
  if (verdict === "unclear") return 1;
  return 2;
}

function formatMoney(value: number): string {
  return `$${value.toLocaleString()}`;
}

export function ComparisonsTable({
  comparisons,
  scopeStates,
  showStateBreakdown = false
}: {
  comparisons: OfferComparison[];
  scopeStates?: Array<"NJ" | "MI" | "PA" | "WV">;
  showStateBreakdown?: boolean;
}) {
  const actionableComparisons = comparisons.filter((item) => item.verdict !== "same");
  const states = useMemo(
    () =>
      (
        scopeStates && scopeStates.length > 0
          ? scopeStates
          : Array.from(new Set(actionableComparisons.map((item) => item.state)))
      ) as Array<"NJ" | "MI" | "PA" | "WV">,
    [actionableComparisons, scopeStates]
  );
  const [stateFilter, setStateFilter] = useState<"ALL" | "NJ" | "MI" | "PA" | "WV">("ALL");
  const selectedState = scopeStates && scopeStates.length === 1 ? scopeStates[0] : stateFilter;
  const filteredComparisons = useMemo(
    () =>
      selectedState === "ALL"
        ? actionableComparisons
        : actionableComparisons.filter((item) => item.state === selectedState),
    [actionableComparisons, selectedState]
  );
  const byState = states.map((state) => ({
    state,
    better: actionableComparisons.filter((item) => item.state === state && item.verdict === "better").length,
    unclear: actionableComparisons.filter((item) => item.state === state && item.verdict === "unclear").length
  }));
  const casinoGroups = useMemo(() => {
    const grouped = new Map<string, OfferComparison[]>();
    for (const item of filteredComparisons) {
      const key = `${item.state}::${item.casinoName}`;
      const current = grouped.get(key) ?? [];
      current.push(item);
      grouped.set(key, current);
    }
    return Array.from(grouped.entries())
      .map(([key, items]) => {
        const [rawState, rawCasinoName] = key.split("::");
        const state = rawState as "NJ" | "MI" | "PA" | "WV";
        const casinoName = rawCasinoName ?? "Unknown Casino";
        const sortedItems = [...items].sort((a, b) => {
          const byVerdict = verdictRank(a.verdict) - verdictRank(b.verdict);
          if (byVerdict !== 0) return byVerdict;
          return b.bonusDelta - a.bonusDelta;
        });
        return {
          key,
          state,
          casinoName,
          items: sortedItems
        };
      })
      .sort((a, b) => a.casinoName.localeCompare(b.casinoName));
  }, [filteredComparisons]);

  return (
    <Card>
      <CardContent>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="mb-1 text-lg font-semibold">Offer Comparison</h2>
          </div>
          {(!scopeStates || scopeStates.length > 1) && states.length > 0 ? (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">State</label>
              <select
                value={stateFilter}
                onChange={(event) => setStateFilter(event.target.value as "ALL" | "NJ" | "MI" | "PA" | "WV")}
                className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700 focus:border-sky-400 focus:outline-none"
              >
                <option value="ALL">All</option>
                {states.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        {showStateBreakdown ? (
          <div className="mb-4 overflow-x-auto">
            <table className="app-table w-full min-w-[420px] text-left text-xs">
              <thead>
                <tr className="border-b border-border text-slate-500">
                  <th className="py-2">State</th>
                  <th className="py-2">Better</th>
                  <th className="py-2">Unclear</th>
                </tr>
              </thead>
              <tbody>
                {byState.map((item) => (
                  <tr key={item.state} className="border-b border-border/70">
                    <td className="py-2 font-semibold">{item.state}</td>
                    <td className="py-2 text-green-700">{item.better}</td>
                    <td className="py-2 text-amber-700">{item.unclear}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="space-y-5">
          {casinoGroups.map((group) => (
            <section key={group.key} className="border-b border-border pb-5 last:border-b-0 last:pb-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{group.casinoName}</p>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{group.state}</span>
                </div>
              </div>

              <div className="space-y-4">
                {group.items.map((item, index) => (
                  <article
                    key={`${group.key}-${index}`}
                    className={index > 0 ? "border-t border-border pt-4" : ""}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={verdictClass(item.verdict)}>{item.verdict}</Badge>
                      {item.discoveredOffer ? (
                        <p className="text-xs text-slate-500">
                          Delta bonus: {formatMoney(item.bonusDelta)} | Confidence: {Math.round(item.confidence * 100)}
                          %
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500">No discovered offer yet.</p>
                      )}
                    </div>

                    <div className="mt-2 grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Current (Tracked)
                        </p>
                        {item.currentOffer ? (
                          <div className="mt-1 space-y-0.5 text-sm text-slate-700">
                            <p className="font-medium">{item.currentOffer.offerName}</p>
                            <p>Type: {item.currentOffer.offerType || "N/A"}</p>
                            <p>
                              Deposit: {formatMoney(item.currentOffer.expectedDeposit)} | Bonus:{" "}
                              {formatMoney(item.currentOffer.expectedBonus)}
                            </p>
                          </div>
                        ) : (
                          <p className="mt-1 text-sm text-slate-500">No tracked offer.</p>
                        )}
                      </div>

                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Discovered
                        </p>
                        {item.discoveredOffer ? (
                          <div className="mt-1 space-y-0.5 text-sm text-slate-700">
                            <p className="font-medium">{item.discoveredOffer.offerName}</p>
                            <p>Type: {item.discoveredOffer.offerType || "N/A"}</p>
                            <p>
                              Deposit: {formatMoney(item.discoveredOffer.expectedDeposit)} | Bonus:{" "}
                              {formatMoney(item.discoveredOffer.expectedBonus)}
                            </p>
                          </div>
                        ) : (
                          <p className="mt-1 text-sm text-slate-500">No discovered offer.</p>
                        )}
                      </div>
                    </div>

                    {item.alternatives.length > 0 ? (
                      <p className="mt-2 text-xs text-slate-600">
                        Alternatives: {item.alternatives.map((alt) => alt.offerName).join(", ")}
                      </p>
                    ) : null}

                    <div className="mt-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Sources</p>
                      <ul className="mt-1 space-y-1 text-xs text-slate-600">
                        {item.citations.map((citation, citationIndex) => (
                          <li key={`${citation.url}-${citationIndex}`}>
                            <a
                              href={citation.url}
                              className="font-semibold app-link"
                              target="_blank"
                              rel="noreferrer"
                            >
                              {citation.title}
                            </a>
                            {citation.snippet ? <span className="ml-1">- {citation.snippet}</span> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}

          {casinoGroups.length === 0 ? (
            <p className="text-sm text-slate-500">No better/unclear offer differences detected.</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
