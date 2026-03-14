import Link from "next/link";
import { ActionSidebar } from "@/components/ActionSidebar";
import { Card, CardContent } from "@/components/ui/card";
import { listRuns } from "@/lib/api";

export default async function RunsPage() {
  const runs = await listRuns().catch(() => []);

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
        </header>

        <Card>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="app-table w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-slate-500">
                    <th className="py-2">Run</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Trigger</th>
                    <th className="py-2">Mode</th>
                    <th className="py-2">Missing</th>
                    <th className="py-2">Better</th>
                    <th className="py-2">Created</th>
                    <th className="py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id} className="border-b border-border/70">
                      <td className="py-3 font-mono text-xs">{run.id.slice(0, 8)}</td>
                      <td className="py-3">{run.status}</td>
                      <td className="py-3">{run.trigger}</td>
                      <td className="py-3">{run.mode}</td>
                      <td className="py-3">{run.missingCount}</td>
                      <td className="py-3">{run.betterCount}</td>
                      <td className="py-3">{new Date(run.createdAt).toLocaleString()}</td>
                      <td className="py-3">
                        <Link href={`/runs/${run.id}`} className="app-link">
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {runs.length === 0 ? (
                    <tr>
                      <td className="py-3 text-slate-500" colSpan={8}>
                        No runs yet.
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
