"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";

interface StateStats {
  state: "NJ" | "MI" | "PA" | "WV";
  tracked: number;
  missing: number;
  better: number;
  unclear: number;
}

type ViewMode = "graph" | "table" | "cards";

export function StateBreakdown({ items }: { items: StateStats[] }) {
  const primaryLabel = "Tracked Casinos";
  const primaryShortLabel = "Tracked";
  return <StateBreakdownView items={items} primaryLabel={primaryLabel} primaryShortLabel={primaryShortLabel} />;
}

export function StateBreakdownView({
  items,
  primaryLabel = "Tracked Casinos",
  primaryShortLabel = "Tracked"
}: {
  items: StateStats[];
  primaryLabel?: string;
  primaryShortLabel?: string;
}) {
  const [view, setView] = useState<ViewMode>("graph");
  const router = useRouter();
  const maxTracked = useMemo(() => Math.max(1, ...items.map((item) => item.tracked)), [items]);

  function openState(state: StateStats["state"]) {
    router.push(`/tracked-casinos/state/${state}`);
  }

  return (
    <Card>
      <CardContent>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">State Overview</h2>
            <p className="mt-1 text-sm text-slate-600">
              Click a state to open tracked casinos and offers for that state.
            </p>
          </div>
          <div className="flex rounded-lg border border-border bg-white p-1">
            {(["graph", "table", "cards"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold capitalize",
                  view === mode ? "bg-sky-100 text-sky-800" : "text-slate-600 hover:bg-slate-50"
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {view === "graph" ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {items.map((item) => {
              const trackedWidth = Math.max(6, Math.round((item.tracked / maxTracked) * 100));
              const betterWidth = item.tracked > 0 ? Math.round((item.better / item.tracked) * 100) : 0;
              const unclearWidth = item.tracked > 0 ? Math.round((item.unclear / item.tracked) * 100) : 0;
              const missingWidth = item.tracked > 0 ? Math.round((item.missing / item.tracked) * 100) : 0;

              return (
                <button
                  key={item.state}
                  type="button"
                  onClick={() => openState(item.state)}
                  className="rounded-xl border border-border bg-white p-4 text-left transition hover:border-sky-300 hover:bg-sky-50/60"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{item.state}</p>
                    <p className="text-xs text-slate-500">
                      {primaryShortLabel} {item.tracked}
                    </p>
                  </div>

                  <div className="mt-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">
                      {primaryShortLabel} Scale
                    </p>
                    <div className="mt-1 h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-sky-500" style={{ width: `${trackedWidth}%` }} />
                    </div>
                  </div>

                  <div className="mt-3 space-y-2 text-xs">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Better</span>
                        <span className="font-semibold text-green-700">{item.better}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                        <div className="h-1.5 rounded-full bg-green-500" style={{ width: `${betterWidth}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Unclear</span>
                        <span className="font-semibold text-amber-700">{item.unclear}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                        <div className="h-1.5 rounded-full bg-amber-500" style={{ width: `${unclearWidth}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Missing</span>
                        <span className="font-semibold text-rose-700">{item.missing}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                        <div className="h-1.5 rounded-full bg-rose-500" style={{ width: `${missingWidth}%` }} />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}

        {view === "table" ? (
          <div className="mt-4 overflow-x-auto">
            <table className="app-table w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-slate-500">
                  <th className="py-2">State</th>
                  <th className="py-2">{primaryLabel}</th>
                  <th className="py-2">Missing</th>
                  <th className="py-2">Better Offers</th>
                  <th className="py-2">Unclear</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.state}
                    className="cursor-pointer border-b border-border/70 transition hover:bg-sky-50/60"
                    onClick={() => openState(item.state)}
                  >
                    <td className="py-3 font-semibold">{item.state}</td>
                    <td className="py-3">{item.tracked}</td>
                    <td className="py-3">{item.missing}</td>
                    <td className="py-3">{item.better}</td>
                    <td className="py-3">{item.unclear}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {view === "cards" ? (
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {items.map((item) => (
              <button
                key={item.state}
                type="button"
                onClick={() => openState(item.state)}
                className="rounded-xl border border-border bg-white p-4 text-left transition hover:border-sky-300 hover:bg-sky-50/60"
              >
                <p className="text-sm font-semibold">{item.state}</p>
                <p className="mt-2 text-xs text-slate-600">
                  {primaryShortLabel}: {item.tracked}
                </p>
                <p className="text-xs text-slate-600">Better: {item.better}</p>
                <p className="text-xs text-slate-600">Unclear: {item.unclear}</p>
                <p className="text-xs text-slate-600">Missing: {item.missing}</p>
              </button>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
