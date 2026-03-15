"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RunMode } from "@re-ai/shared";
import { cn } from "@/components/ui/cn";

type Action = {
  label: string;
  mode: RunMode;
  description: string;
};

const actions: Action[] = [
  {
    label: "Run Full Research",
    mode: "full",
    description: "Casino + offers + comparison"
  },
  {
    label: "Discover Casinos",
    mode: "discover_casinos",
    description: "Coverage and missing casinos"
  },
  {
    label: "Discover Offers",
    mode: "discover_offers",
    description: "Offer research for tracked casinos"
  }
];

type NavItem = {
  key: "dashboard" | "tracked" | "tracked_vs_latest" | "runs" | string;
  href: string;
  label: string;
};

export function ActionSidebar({
  activeNav = "dashboard",
  showActions = true,
  extraNavItems = []
}: {
  activeNav?: NavItem["key"];
  showActions?: boolean;
  extraNavItems?: Array<{ href: string; label: string }>;
}) {
  const router = useRouter();
  const [loadingMode, setLoadingMode] = useState<RunMode | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmFullRunOpen, setConfirmFullRunOpen] = useState(false);

  const navItems: NavItem[] = [
    { key: "dashboard", href: "/", label: "Dashboard" },
    { key: "tracked", href: "/tracked-casinos", label: "Tracked Casinos" },
    {
      key: "tracked_vs_latest",
      href: "/tracked-casinos/latest-run-comparison",
      label: "Latest Run Comparison"
    },
    { key: "runs", href: "/runs", label: "Recent Runs" },
    ...extraNavItems.map((item, index) => ({
      key: `extra-${index}`,
      href: item.href,
      label: item.label
    }))
  ];

  async function queueRun(mode: RunMode) {
    setLoadingMode(mode);
    setMessage(null);
    try {
      const response = await fetch("/api/run-now", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ mode })
      });
      const payload = (await response.json()) as { runId?: string; mode?: RunMode; error?: string };
      if (!response.ok) {
        setMessage(payload.error ?? "Failed to queue action");
      } else {
        const runId = payload.runId;
        setMessage(`Queued ${payload.mode ?? mode}: ${runId ?? "pending id"}`);
        if (runId) {
          router.push(`/runs/${runId}`);
          router.refresh();
        }
      }
    } catch {
      setMessage("Failed to queue action");
    } finally {
      setLoadingMode(null);
    }
  }

  async function trigger(mode: RunMode) {
    if (mode === "full") {
      setConfirmFullRunOpen(true);
      return;
    }
    await queueRun(mode);
  }

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <div className="px-5 pb-4 pt-6">
        <div>
          <p className="text-base font-bold tracking-tight">RE AI Researcher</p>
          <p className="text-xs text-slate-500">Control Center</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Navigation</p>
        <div className="mt-2 space-y-1">
          {navItems.map((item) => (
            <Link
              key={`${item.key}-${item.href}`}
              href={item.href}
              className={cn(
                "block rounded-lg border px-3 py-2 text-sm font-semibold transition",
                item.key === activeNav
                  ? "border-sky-300 bg-sky-50 text-sky-800 shadow-sm"
                  : "border-transparent bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50/70"
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {showActions ? (
          <div className="mt-5 border-t border-slate-200 pt-4">
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Run Actions</p>
            <div className="mt-2 space-y-1">
              {actions.map((action) => {
                const isLoading = loadingMode === action.mode;
                return (
                  <button
                    key={action.mode}
                    type="button"
                    onClick={() => trigger(action.mode)}
                    disabled={loadingMode !== null}
                    className={cn(
                      "w-full rounded-lg border px-3 py-2 text-left transition",
                      "border-transparent bg-white hover:border-sky-200 hover:bg-sky-50/70",
                      "disabled:cursor-not-allowed disabled:opacity-60",
                      isLoading ? "border-sky-300 bg-sky-50 shadow-sm" : ""
                    )}
                    title={action.label}
                  >
                    <p className="text-sm font-semibold">{action.label}</p>
                    <p className="text-xs text-slate-500">{isLoading ? "Queueing..." : action.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {showActions ? (
          <div className="mt-6 border-t border-slate-200 pt-4">
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Modes</p>
            <ul className="mt-2 space-y-1 px-1 text-xs text-slate-600">
              <li>`full` - complete run</li>
              <li>`discover_casinos` - coverage only</li>
              <li>`discover_offers` - offer analysis only</li>
            </ul>
          </div>
        ) : null}
        {message ? <p className="mt-4 px-1 text-xs text-slate-600">{message}</p> : null}
      </div>

      {confirmFullRunOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold">Confirm Full Research Run</h3>
            <p className="mt-2 text-sm text-slate-600">
              This will run casino discovery and offer discovery across the configured states.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={async () => {
                  setConfirmFullRunOpen(false);
                  await queueRun("full");
                }}
                className="rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-100"
                disabled={loadingMode !== null}
              >
                Run
              </button>
              <button
                type="button"
                onClick={() => setConfirmFullRunOpen(false)}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                disabled={loadingMode !== null}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
