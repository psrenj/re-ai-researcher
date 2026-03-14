import type { LlmTrace, RunReport } from "@re-ai/shared";
import { Card, CardContent } from "@/components/ui/card";

export function RunLogsSection({ report, llmTraces }: { report: RunReport; llmTraces: LlmTrace[] }) {
  return (
    <Card>
      <CardContent>
        <h2 className="text-lg font-semibold">Run Events, Issues, and LLM Traces</h2>
        <div className="mt-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
          Failed targets can be inspected in the LLM Traces table below.
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm font-semibold">Stage Events</p>
            <ul className="mt-2 space-y-2 text-sm">
              {report.stageEvents.map((event, index) => (
                <li key={`${event.stage}-${event.createdAt}-${index}`} className="rounded-md border border-border p-3">
                  <p className="font-semibold">{event.stage}</p>
                  <p className="text-slate-600">Status: {event.status}</p>
                  {event.reason ? <p className="text-slate-600">Reason: {event.reason}</p> : null}
                  {event.impact ? <p className="text-slate-600">Impact: {event.impact}</p> : null}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold">Issues</p>
            <ul className="mt-2 space-y-2 text-sm">
              {report.issues.map((issue, index) => (
                <li key={`${issue.category}-${issue.title}-${index}`} className="rounded-md border border-border p-3">
                  <p className="font-semibold">{issue.title}</p>
                  <p className="text-slate-600">Severity: {issue.severity}</p>
                  <p className="text-slate-600">{issue.details}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-sm font-semibold">LLM Traces</p>
          <div className="mt-2 overflow-x-auto">
            <table className="app-table w-full min-w-[860px] text-left text-xs">
              <thead>
                <tr className="border-b border-border text-slate-500">
                  <th className="py-2">ID</th>
                  <th className="py-2">Stage</th>
                  <th className="py-2">Target</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Latency</th>
                  <th className="py-2">Trace</th>
                </tr>
              </thead>
              <tbody>
                {llmTraces.map((trace) => (
                  <tr key={trace.id} className="border-b border-border/70">
                    <td className="py-2 font-mono">{trace.id}</td>
                    <td className="py-2">{trace.stage}</td>
                    <td className="py-2">{trace.target}</td>
                    <td className="py-2">{trace.status}</td>
                    <td className="py-2">{trace.latencyMs}ms</td>
                    <td className="py-2">
                      <details>
                        <summary className="cursor-pointer text-sky-700">View raw</summary>
                        <div className="mt-2 space-y-2">
                          {trace.errorMessage ? <p className="text-red-600">{trace.errorMessage}</p> : null}
                          {trace.extractedText ? (
                            <pre className="max-h-36 overflow-auto rounded bg-slate-50 p-2 whitespace-pre-wrap">
                              {trace.extractedText}
                            </pre>
                          ) : null}
                          {trace.rawResponseJson ? (
                            <pre className="max-h-48 overflow-auto rounded bg-slate-50 p-2 whitespace-pre-wrap">
                              {trace.rawResponseJson}
                            </pre>
                          ) : null}
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
                {llmTraces.length === 0 ? (
                  <tr>
                    <td className="py-3 text-slate-500" colSpan={6}>
                      No LLM traces recorded yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
