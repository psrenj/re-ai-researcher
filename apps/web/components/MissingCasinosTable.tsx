import type { MissingCasino } from "@re-ai/shared";
import { Card, CardContent } from "@/components/ui/card";

function confidenceClass(confidence: number): string {
  if (confidence >= 0.75) return "border-success bg-green-50 text-success";
  if (confidence >= 0.5) return "border-warning bg-amber-50 text-warning";
  return "border-danger bg-red-50 text-danger";
}

export function MissingCasinosTable({
  items,
  title = "Missing Casinos by State",
  description
}: {
  items: MissingCasino[];
  title?: string;
  description?: string;
}) {
  return (
    <Card>
      <CardContent>
        <h2 className="mb-1 text-lg font-semibold">{title}</h2>
        {description ? <p className="mb-3 text-sm text-slate-600">{description}</p> : <div className="mb-3" />}
        <div className="overflow-x-auto">
          <table className="app-table w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-slate-500">
                <th className="w-16 px-3 py-2">State</th>
                <th className="px-3 py-2">Casino</th>
                <th className="w-24 px-3 py-2">Confidence</th>
                <th className="w-72 px-3 py-2">Sources</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={`${item.state}-${item.casinoName}`} className="border-b border-border/70 align-middle">
                  <td className="px-3 py-2.5 font-semibold text-slate-700">{item.state}</td>
                  <td className="px-3 py-2.5 font-medium">{item.casinoName}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex rounded-md border px-2 py-0.5 font-mono text-[11px] ${confidenceClass(item.confidence)}`}
                    >
                      {(item.confidence * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {item.citations.slice(0, 3).map((citation) => (
                        <a
                          key={citation.url}
                          href={citation.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700 hover:border-sky-200 hover:bg-sky-50"
                        >
                          {citation.title}
                        </a>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-slate-500" colSpan={4}>
                    No missing casinos detected in this run.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
