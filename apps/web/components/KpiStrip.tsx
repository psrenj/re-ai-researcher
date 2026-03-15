import { Card, CardContent } from "@/components/ui/card";

export function KpiStrip(props: {
  tracked: number;
  missing: number;
  better: number;
  unclear: number;
  trackedLabel?: string;
}) {
  const cards = [
    { label: props.trackedLabel ?? "Tracked Casinos", value: props.tracked },
    { label: "Missing Casinos", value: props.missing },
    { label: "Better Offers", value: props.better },
    { label: "Unclear Findings", value: props.unclear }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {cards.map((item) => (
        <Card key={item.label}>
          <CardContent>
            <p className="text-sm text-slate-500">{item.label}</p>
            <p className="mt-2 text-3xl font-bold">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
