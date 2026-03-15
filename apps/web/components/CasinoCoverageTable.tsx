import { Card, CardContent } from "@/components/ui/card";

export interface CasinoCoverageRow {
  state: "NJ" | "MI" | "PA" | "WV";
  casinoName: string;
  status: "tracked" | "missing";
  confidence?: number;
}

export function CasinoCoverageTable({
  rows,
  title = "Casinos",
  description,
  showStatus = true
}: {
  rows: CasinoCoverageRow[];
  title?: string;
  description?: string;
  showStatus?: boolean;
}) {
  return (
    <Card>
      <CardContent>
        <h2 className="mb-1 text-lg font-semibold">{title}</h2>
        {description ? <p className="mb-3 text-sm text-slate-600">{description}</p> : <div className="mb-3" />}
        <div className="overflow-x-auto">
          <table className="app-table w-full min-w-[620px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-slate-500">
                <th className="py-2">State</th>
                <th className="py-2">Casino</th>
                {showStatus ? <th className="py-2">Status</th> : null}
                {showStatus ? <th className="py-2">Confidence</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.state}-${row.casinoName}-${row.status}`} className="border-b border-border/70">
                  <td className="py-3">{row.state}</td>
                  <td className="py-3 font-medium">{row.casinoName}</td>
                  {showStatus ? (
                    <td className="py-3">
                      <span
                        className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                          row.status === "missing"
                            ? "border-warning bg-amber-50 text-warning"
                            : "border-success bg-green-50 text-success"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  ) : null}
                  {showStatus ? (
                    <td className="py-3">
                      {typeof row.confidence === "number" ? `${(row.confidence * 100).toFixed(0)}%` : "-"}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
