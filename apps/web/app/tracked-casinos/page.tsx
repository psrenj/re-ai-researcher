import Link from "next/link";
import { ActionSidebar } from "@/components/ActionSidebar";
import { Card, CardContent } from "@/components/ui/card";
import { getBaselineCasinos, getBaselineStats } from "@/lib/api";

export default async function TrackedCasinosPage() {
  const baselineStats = await getBaselineStats().catch(() => null);
  const baselineCasinos = await getBaselineCasinos().catch(() => []);

  return (
    <div className="space-y-6">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-80 border-r border-slate-200 bg-white lg:block">
        <ActionSidebar activeNav="tracked" />
      </aside>

      <div className="space-y-6 lg:ml-80 lg:pl-6">
        <header className="rounded-2xl border border-border bg-card p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Baseline Coverage</p>
          <h1 className="mt-2 text-3xl font-bold">Tracked Casinos</h1>
          <p className="mt-2 text-sm text-slate-600">
            Review tracked casinos by state and drill into every casino offer record.
          </p>
        </header>

        <Card>
          <CardContent>
            <h2 className="mb-3 text-lg font-semibold">State Breakdown</h2>
            <div className="grid gap-3 md:grid-cols-4">
              {(baselineStats?.byState ?? []).map((state) => (
                <Link
                  key={state.state}
                  href={`/tracked-casinos/state/${state.state}`}
                  className="rounded-xl border border-border bg-white p-4 transition hover:border-sky-300 hover:bg-sky-50/60"
                >
                  <p className="text-sm font-semibold">{state.state}</p>
                  <p className="mt-1 text-xs text-slate-600">Tracked Casinos: {state.trackedCasinos}</p>
                  <p className="text-xs text-slate-600">Offer Rows: {state.offerRows}</p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="mb-3 text-lg font-semibold">All Tracked Casinos</h2>
            <div className="overflow-x-auto">
              <table className="app-table w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-slate-500">
                    <th className="py-2">State</th>
                    <th className="py-2">Casino</th>
                    <th className="py-2">Top Offer</th>
                    <th className="py-2">Top Bonus</th>
                    <th className="py-2">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {baselineCasinos.map((casino) => (
                    <tr key={`${casino.state}-${casino.casinoName}`} className="border-b border-border/70">
                      <td className="py-3">{casino.state}</td>
                      <td className="py-3 font-medium">{casino.casinoName}</td>
                      <td className="py-3">{casino.headlineOffer}</td>
                      <td className="py-3">{casino.bestKnownBonus}</td>
                      <td className="py-3">
                        <Link
                          href={`/tracked-casinos/state/${casino.state}/casino/${encodeURIComponent(casino.casinoName)}`}
                          className="app-link"
                        >
                          View Offers
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
