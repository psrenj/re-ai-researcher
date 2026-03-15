import Link from "next/link";
import { ActionSidebar } from "@/components/ActionSidebar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { getBaselineOffers, getRunReport, listRuns } from "@/lib/api";

type StateAbbr = "NJ" | "MI" | "PA" | "WV";

function normalizeCasinoKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

export default async function TrackedCasinoPage({
  params
}: {
  params: Promise<{ abbr: string; casino: string }>;
}) {
  const { abbr, casino } = await params;
  const state = abbr.toUpperCase() as StateAbbr;
  const casinoName = decodeURIComponent(casino);
  const offers = await getBaselineOffers({ state, casino: casinoName }).catch(() => []);
  const runs = await listRuns().catch(() => []);
  const latest = runs[0];
  const latestReport = latest ? await getRunReport(latest.id).catch(() => null) : null;
  const latestComparison =
    latestReport?.offerComparisons.find(
      (item) => item.state === state && normalizeCasinoKey(item.casinoName) === normalizeCasinoKey(casinoName)
    ) ?? null;

  return (
    <div className="space-y-6">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-80 border-r border-slate-200 bg-white lg:block">
        <ActionSidebar
          activeNav="tracked"
          showActions={false}
          extraNavItems={[
            { href: `/tracked-casinos/state/${state}`, label: `${state} State` },
            {
              href: `/tracked-casinos/state/${state}/casino/${encodeURIComponent(casinoName)}`,
              label: casinoName
            }
          ]}
        />
      </aside>

      <div className="space-y-6 lg:ml-80 lg:pl-6">
        <header className="rounded-2xl border border-border bg-card p-6">
          <h1 className="text-2xl font-bold">
            {casinoName} ({state})
          </h1>
          <p className="mt-2 text-sm text-slate-600">Tracked offers: {offers.length}</p>
          <Link href={`/tracked-casinos/state/${state}`} className="mt-2 inline-block text-sm app-link">
            Back to {state} casinos
          </Link>
        </header>

        <Card>
          <CardContent>
            <h2 className="mb-3 text-lg font-semibold">Latest Run Comparison</h2>
            {latestComparison ? (
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    className={cn(
                      "border px-2 py-1 text-xs font-semibold",
                      latestComparison.verdict === "better"
                        ? "border-success bg-green-50 text-success"
                        : latestComparison.verdict === "unclear"
                          ? "border-warning bg-amber-50 text-warning"
                          : "border-slate-200 bg-slate-50 text-slate-700"
                    )}
                  >
                    {latestComparison.verdict}
                  </Badge>
                  <p className="text-xs text-slate-500">
                    {latest ? `Run ${latest.id.slice(0, 8)}` : "Latest run"} | Confidence{" "}
                    {Math.round(latestComparison.confidence * 100)}%
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Current (Tracked)
                    </p>
                    {latestComparison.currentOffer ? (
                      <div className="mt-1 space-y-0.5 text-slate-700">
                        <p className="font-medium">{latestComparison.currentOffer.offerName}</p>
                        <p>
                          Deposit: {latestComparison.currentOffer.expectedDeposit} | Bonus:{" "}
                          {latestComparison.currentOffer.expectedBonus}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-1 text-slate-500">No tracked offer in comparison.</p>
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Discovered
                    </p>
                    {latestComparison.discoveredOffer ? (
                      <div className="mt-1 space-y-0.5 text-slate-700">
                        <p className="font-medium">{latestComparison.discoveredOffer.offerName}</p>
                        <p>
                          Deposit: {latestComparison.discoveredOffer.expectedDeposit} | Bonus:{" "}
                          {latestComparison.discoveredOffer.expectedBonus}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-1 text-slate-500">No discovered offer in latest run.</p>
                    )}
                  </div>
                </div>

                {latestComparison.citations.length > 0 ? (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Sources</p>
                    <ul className="mt-1 space-y-1 text-xs text-slate-600">
                      {latestComparison.citations.map((citation, index) => (
                        <li key={`${citation.url}-${index}`}>
                          <a href={citation.url} className="app-link" target="_blank" rel="noreferrer">
                            {citation.title}
                          </a>
                          {citation.snippet ? <span className="ml-1">- {citation.snippet}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No latest run comparison for this casino yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="mb-3 text-lg font-semibold">Tracked Offers</h2>
            <div className="overflow-x-auto">
              <table className="app-table w-full min-w-[840px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-slate-500">
                    <th className="py-2">Offer Name</th>
                    <th className="py-2">Type</th>
                    <th className="py-2">Expected Deposit</th>
                    <th className="py-2">Expected Bonus</th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((offer, index) => (
                    <tr key={`${offer.offerName}-${index}`} className="border-b border-border/70">
                      <td className="py-3 font-medium">{offer.offerName}</td>
                      <td className="py-3">{offer.offerType ?? "-"}</td>
                      <td className="py-3">{offer.expectedDeposit}</td>
                      <td className="py-3">{offer.expectedBonus}</td>
                    </tr>
                  ))}
                  {offers.length === 0 ? (
                    <tr>
                      <td className="py-3 text-slate-500" colSpan={4}>
                        No tracked offers found for this casino.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
