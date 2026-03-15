"use client";

import { useEffect } from "react";
import type { RunStatus } from "@re-ai/shared";
import { useRouter } from "next/navigation";

export function RunAutoRefresh({ status, enabled }: { status: RunStatus; enabled: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    if (status !== "queued" && status !== "running") return;

    const timer = window.setInterval(() => {
      router.refresh();
    }, 3500);

    return () => {
      window.clearInterval(timer);
    };
  }, [enabled, router, status]);

  return null;
}
