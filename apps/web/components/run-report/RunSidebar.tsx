import type { RunReport } from "@re-ai/shared";
import Link from "next/link";
import { cn } from "@/components/ui/cn";
import { RUN_REPORT_SECTIONS, type Section } from "./types";

export function RunSidebar({
  report,
  section,
  onSectionChange
}: {
  report: RunReport;
  section: Section;
  onSectionChange: (section: Section) => void;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-80 border-r border-slate-200 bg-white lg:block">
      <div className="flex h-full flex-col">
        <div className="px-5 pb-4 pt-6">
          <p className="text-base font-bold tracking-tight">RE AI Researcher</p>
          <p className="text-xs text-slate-500">Control Center</p>
        </div>

        <div className="border-t border-slate-200 px-4 py-3">
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
              className="block rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 shadow-sm"
            >
              Recent Runs
            </Link>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <div className="mt-5 border-t border-slate-200 pt-4">
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Views</p>
            <div className="mt-2 space-y-1">
              {RUN_REPORT_SECTIONS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onSectionChange(value)}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-left text-sm font-semibold transition",
                    section === value
                      ? "border-sky-300 bg-sky-50 text-sky-800 shadow-sm"
                      : "border-transparent bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50/70"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-4">
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Recent Stage Events</p>
            <ul className="mt-2 space-y-2 text-xs">
              {report.stageEvents.slice(-5).map((event, index) => (
                <li key={`${event.stage}-${event.createdAt}-${index}`} className="rounded-md bg-slate-50 p-2 text-slate-700">
                  <p className="font-semibold">{event.stage}</p>
                  <p className="text-slate-500">{event.status}</p>
                </li>
              ))}
              {report.stageEvents.length === 0 ? <li className="px-1 text-slate-500">No stage events recorded.</li> : null}
            </ul>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-4">
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Issues</p>
            <ul className="mt-2 space-y-2 text-xs">
              {report.issues.slice(-3).map((issue, index) => (
                <li key={`${issue.category}-${issue.title}-${index}`} className="rounded-md bg-slate-50 p-2 text-slate-700">
                  <p className="font-semibold">{issue.title}</p>
                  <p className="text-slate-500">{issue.severity}</p>
                </li>
              ))}
              {report.issues.length === 0 ? <li className="px-1 text-slate-500">No issues recorded.</li> : null}
            </ul>
          </div>
        </div>
      </div>
    </aside>
  );
}
