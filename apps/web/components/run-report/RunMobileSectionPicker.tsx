import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { RUN_REPORT_SECTIONS, type Section } from "./types";

export function RunMobileSectionPicker({
  section,
  onSectionChange
}: {
  section: Section;
  onSectionChange: (section: Section) => void;
}) {
  return (
    <Card className="lg:hidden">
      <CardContent>
        <p className="text-sm font-semibold">Views</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {RUN_REPORT_SECTIONS.map(([value, label]) => (
            <button
              key={`mobile-${value}`}
              type="button"
              onClick={() => onSectionChange(value)}
              className={cn(
                "rounded-md border px-3 py-2 text-sm font-semibold",
                section === value
                  ? "border-accent bg-sky-50 text-accent"
                  : "border-border bg-white text-slate-700"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
