import { ActionSidebar } from "@/components/ActionSidebar";
import { RunsTable } from "@/components/RunsTable";
import { Card, CardContent } from "@/components/ui/card";
import { listRuns } from "@/lib/api";

export default async function RunsPage() {
  let runs = [] as Awaited<ReturnType<typeof listRuns>>;
  let runsError: string | null = null;
  try {
    runs = await listRuns();
  } catch (error) {
    runsError = error instanceof Error ? error.message : "Failed to load runs";
  }

  return (
    <div className="space-y-6">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-80 border-r border-slate-200 bg-white lg:block">
        <ActionSidebar activeNav="runs" />
      </aside>

      <div className="space-y-6 lg:ml-80 lg:pl-6">
        <header className="rounded-2xl border border-border bg-card p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Run History</p>
          <h1 className="mt-2 text-3xl font-bold">Recent Runs</h1>
          <p className="mt-2 text-sm text-slate-600">Review status, trigger mode, and open each run report.</p>
          {runsError ? (
            <p className="mt-2 text-sm text-rose-700">Unable to load runs: {runsError}</p>
          ) : null}
        </header>

        <Card>
          <CardContent>
            <RunsTable initialRuns={runs} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
