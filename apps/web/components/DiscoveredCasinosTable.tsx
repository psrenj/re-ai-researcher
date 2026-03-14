import type { DiscoveredCasinoCoverage } from "@re-ai/shared";
import { Card, CardContent } from "@/components/ui/card";

function confidenceClass(confidence: number): string {
  if (confidence >= 0.75) return "border-success bg-green-50 text-success";
  if (confidence >= 0.5) return "border-warning bg-amber-50 text-warning";
  return "border-danger bg-red-50 text-danger";
}

export function DiscoveredCasinosTable({
  casinos,
  title = "Identified Casinos by State",
  description = "Casinos found during discovery with confidence and coverage status."
}: {
  casinos: DiscoveredCasinoCoverage[];
  title?: string;
  description?: string;
}) {
  const sorted = [...casinos].sort((a, b) => {
    if (a.state !== b.state) return a.state.localeCompare(b.state);
    return a.casinoName.localeCompare(b.casinoName);
  });

  return (
    <Card>
      <CardContent>
        <h2 className="mb-1 text-lg font-semibold">{title}</h2>
        <p className="mb-3 text-sm text-slate-600">{description}</p>
        <div className="overflow-x-auto">
          <table className="app-table w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-slate-500">
                <th className="w-16 px-3 py-2">State</th>
                <th className="px-3 py-2">Casino</th>
                <th className="w-28 px-3 py-2">Status</th>
                <th className="w-24 px-3 py-2">Confidence</th>
                <th className="w-72 px-3 py-2">Sources</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((item) => (
                <tr key={`${item.state}-${item.casinoName}`} className="border-b border-border/70 align-middle">
                  <td className="px-3 py-2.5 font-semibold text-slate-700">{item.state}</td>
                  <td className="px-3 py-2.5 font-medium">{item.casinoName}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                        item.isMissing
                          ? "border-warning bg-amber-50 text-warning"
                          : "border-success bg-green-50 text-success"
                      }`}
                    >
                      {item.isMissing ? "missing" : "covered"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex rounded-md border px-2 py-0.5 font-mono text-[11px] ${confidenceClass(item.confidence)}`}
                    >
                      {Math.round(item.confidence * 100)}%
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {item.citations.slice(0, 2).map((citation) => (
                        <a
                          key={citation.url}
                          href={citation.url}
                          className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700 hover:border-sky-200 hover:bg-sky-50"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {citation.title}
                        </a>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-slate-500" colSpan={5}>
                    No discovered casinos recorded yet.
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
