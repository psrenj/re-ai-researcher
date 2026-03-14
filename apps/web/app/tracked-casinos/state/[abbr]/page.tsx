import Link from "next/link";
import { ActionSidebar } from "@/components/ActionSidebar";
import { Card, CardContent } from "@/components/ui/card";
import { getBaselineOffers, getRunReport, listRuns } from "@/lib/api";

type StateAbbr = "NJ" | "MI" | "PA" | "WV";

function normalizeCasinoKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

export default async function TrackedStatePage({
  params
}: {
  params: Promise<{ abbr: string }>;
}) {
  const { abbr } = await params;
  const state = abbr.toUpperCase() as StateAbbr;
  const offers = await getBaselineOffers({ state }).catch(() => []);
  const runs = await listRuns().catch(() => []);
  const latest = runs[0];
  const latestReport = latest ? await getRunReport(latest.id).catch(() => null) : null;

  const byCasino = new Map<
    string,
    { casinoName: string; offerCount: number; topBonus: number; topOfferName: string }
  >();

  for (const offer of offers) {
    const current = byCasino.get(offer.casinoName);
    if (!current) {
      byCasino.set(offer.casinoName, {
        casinoName: offer.casinoName,
        offerCount: 1,
        topBonus: offer.expectedBonus,
        topOfferName: offer.offerName
      });
      continue;
    }
    current.offerCount += 1;
    if (offer.expectedBonus > current.topBonus) {
      current.topBonus = offer.expectedBonus;
      current.topOfferName = offer.offerName;
    }
  }

  const casinos = Array.from(byCasino.values()).sort((a, b) => a.casinoName.localeCompare(b.casinoName));
  const latestComparisonMap = new Map(
    (latestReport?.offerComparisons ?? [])
      .filter((item) => item.state === state)
      .map((item) => [
        normalizeCasinoKey(item.casinoName),
        {
          verdict: item.verdict,
          discoveredOfferName: item.discoveredOffer?.offerName ?? "No discovered offer"
        }
      ])
  );

  return (
    <div className="space-y-6">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-80 border-r border-slate-200 bg-white lg:block">
        <ActionSidebar
          activeNav="tracked"
          showActions={false}
          extraNavItems={[{ href: `/tracked-casinos/state/${state}`, label: `${state} State` }]}
        />
      </aside>

      <div className="space-y-6 lg:ml-80 lg:pl-6">
        <header className="rounded-2xl border border-border bg-card p-6">
          <h1 className="text-2xl font-bold">Tracked Casinos: {state}</h1>
          <p className="mt-2 text-sm text-slate-600">
            Total tracked casinos: {casinos.length} | Offer rows: {offers.length}
          </p>
          <Link href="/tracked-casinos" className="mt-2 inline-block text-sm app-link">
            Back to tracked overview
          </Link>
        </header>

        <Card>
          <CardContent>
            <h2 className="mb-3 text-lg font-semibold">Casinos in {state}</h2>
            <div className="overflow-x-auto">
              <table className="app-table w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-slate-500">
                    <th className="py-2">Casino</th>
                    <th className="py-2">Offers</th>
                    <th className="py-2">Top Offer</th>
                    <th className="py-2">Top Bonus</th>
                    <th className="py-2">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {casinos.map((casino) => (
                    (() => {
                      const latestComparison = latestComparisonMap.get(normalizeCasinoKey(casino.casinoName));
                      return (
                        <tr key={casino.casinoName} className="border-b border-border/70">
                          <td className="py-3 font-medium">
                            <Link
                              href={`/tracked-casinos/state/${state}/casino/${encodeURIComponent(casino.casinoName)}`}
                              className="app-link"
                            >
                              {casino.casinoName}
                            </Link>
                          </td>
                          <td className="py-3">{casino.offerCount}</td>
                          <td className="py-3">{casino.topOfferName}</td>
                          <td className="py-3">{casino.topBonus}</td>
                          <td className="py-3">
                            <Link
                              href={`/tracked-casinos/state/${state}/casino/${encodeURIComponent(casino.casinoName)}`}
                              className="app-link"
                            >
                              View Offers
                            </Link>
                            {latestComparison ? (
                              <p className="mt-1 text-xs text-slate-500">
                                Latest {latestComparison.verdict}: {latestComparison.discoveredOfferName}
                              </p>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })()
                  ))}
                  {casinos.length === 0 ? (
                    <tr>
                      <td className="py-3 text-slate-500" colSpan={5}>
                        No tracked casinos found for this state.
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
