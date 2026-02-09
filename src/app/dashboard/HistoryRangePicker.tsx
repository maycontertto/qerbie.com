"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

type HistoryRange = "diario" | "semanal" | "mensal";

const STORAGE_KEY = "qerbie_history_range";

function isHistoryRange(value: string | null | undefined): value is HistoryRange {
  return value === "diario" || value === "semanal" || value === "mensal";
}

export function HistoryRangePicker({
  category,
  currentRange,
  hasExplicitRange,
}: {
  category: string;
  currentRange: HistoryRange;
  hasExplicitRange: boolean;
}) {
  const router = useRouter();

  const base = useMemo(() => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    params.set("section", "historico");
    return `/dashboard?${params.toString()}`;
  }, [category]);

  const makeHref = useCallback(
    (range: HistoryRange) => `${base}&range=${encodeURIComponent(range)}`,
    [base],
  );

  useEffect(() => {
    if (hasExplicitRange) return;
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (!isHistoryRange(stored)) return;
    if (stored === currentRange) return;
    router.replace(makeHref(stored));
  }, [currentRange, hasExplicitRange, makeHref, router]);

  function setRange(range: HistoryRange) {
    try {
      window.localStorage.setItem(STORAGE_KEY, range);
    } catch {
      // ignore
    }
    router.push(makeHref(range));
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => setRange("diario")}
        className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
          currentRange === "diario"
            ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        }`}
      >
        Diário
      </button>
      <button
        type="button"
        onClick={() => setRange("semanal")}
        className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
          currentRange === "semanal"
            ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        }`}
      >
        Semanal
      </button>
      <button
        type="button"
        onClick={() => setRange("mensal")}
        className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
          currentRange === "mensal"
            ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        }`}
      >
        Mensal
      </button>
    </div>
  );
}
