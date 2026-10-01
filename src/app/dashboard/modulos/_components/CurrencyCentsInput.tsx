"use client";

import { useState } from "react";

function formatCents(cents: number): string {
  return (Math.max(0, Number.isFinite(cents) ? cents : 0) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function CurrencyCentsInput({
  name = "price_cents",
  label = "Preço (R$)",
  defaultCents = 0,
  required = false,
}: {
  name?: string;
  label?: string;
  defaultCents?: number;
  required?: boolean;
}) {
  const [cents, setCents] = useState(Math.max(0, Math.round(Number(defaultCents) || 0)));

  return (
    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
      {label}
      <span className="mt-1 flex items-center rounded-xl border border-zinc-300 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-800">
        <span className="mr-2 text-zinc-500">R$</span>
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-label={label}
          required={required}
          value={formatCents(cents)}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "");
            setCents(digits ? Math.min(Number(digits), 100_000_000_00) : 0);
          }}
          className="w-full border-0 bg-transparent px-0 py-2 text-sm text-zinc-900 outline-none focus:ring-0 dark:text-zinc-50"
        />
      </span>
      <input type="hidden" name={name} value={cents} />
    </label>
  );
}
