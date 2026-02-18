"use client";

import { useState } from "react";

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Fallback: do nothing (clipboard may be blocked)
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className="shrink-0 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
    >
      {copied ? "Copiado" : label}
    </button>
  );
}
