import Link from "next/link";
import { ComparisonsTable } from "@/components/ComparisonsTable";
import { DiscoveredCasinosTable } from "@/components/DiscoveredCasinosTable";
import { MissingCasinosTable } from "@/components/MissingCasinosTable";
import { getRunReport } from "@/lib/api";

export default async function StatePage({
  params
}: {
  params: Promise<{ id: string; abbr: string }>;
}) {
  const { id, abbr } = await params;
  const state = abbr.toUpperCase();
  const report = await getRunReport(id);

  const discovered = report.discoveredCasinos.filter((item) => item.state === state);
  const missing = report.missingCasinos.filter((item) => item.state === state);
  const comparisons = report.offerComparisons.filter((item) => item.state === state);

  return (
    <div className="relative">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-80 border-r border-slate-200 bg-white lg:block">
        <div className="flex h-full flex-col">
          <div className="px-5 pb-4 pt-6">
            <p className="text-base font-bold tracking-tight">RE AI Researcher</p>
            <p className="text-xs text-slate-500">Control Center</p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Navigation</p>
            <div className="mt-2 space-y-1">
              <Link
                href="/"
                className="block rounded-lg border border-transparent bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50/70"
              >
                Dashboard
              </Link>
              <Link
                href="/tracked-casinos"
                className="block rounded-lg border border-transparent bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50/70"
              >
                Tracked Casinos
              </Link>
              <Link
                href="/tracked-casinos/latest-run-comparison"
                className="block rounded-lg border border-transparent bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50/70"
              >
                Latest Run Comparison
              </Link>
              <Link
                href="/runs"
                className="block rounded-lg border border-transparent bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50/70"
              >
                Recent Runs
              </Link>
              <Link
                href={`/runs/${id}`}
                className="block rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 shadow-sm"
              >
                Back to run
              </Link>
            </div>
          </div>
        </div>
      </aside>

      <section className="space-y-6 lg:ml-80 lg:pl-6">
        <header className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">State Report: {state}</h1>
            <Link href={`/runs/${id}`} className="text-sm app-link lg:hidden">
              Back to run
            </Link>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Identified casinos: {discovered.length} | Missing casinos: {missing.length} | Offer comparisons:{" "}
            {comparisons.length}
          </p>
        </header>

        <DiscoveredCasinosTable casinos={discovered} />
        <MissingCasinosTable items={missing} />
        <ComparisonsTable comparisons={comparisons} scopeStates={[state as "NJ" | "MI" | "PA" | "WV"]} />
      </section>
    </div>
  );
}
