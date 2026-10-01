"use client";

import { useState } from "react";

export function RequiredMinimumFields({
  requiredByDefault,
  minByDefault,
}: {
  requiredByDefault: boolean;
  minByDefault: number;
}) {
  const [required, setRequired] = useState(requiredByDefault);
  const [minimum, setMinimum] = useState(Math.max(minByDefault, requiredByDefault ? 1 : 0));

  function changeRequired(checked: boolean) {
    setRequired(checked);
    if (checked) setMinimum((current) => Math.max(current, 1));
  }

  return (
    <>
      <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950">
        <span className="font-medium text-zinc-900 dark:text-zinc-50">Obrigatório</span>
        <input
          type="checkbox"
          name="is_required"
          checked={required}
          onChange={(event) => changeRequired(event.target.checked)}
          className="h-5 w-5 rounded border-zinc-300 dark:border-zinc-700"
        />
      </label>
      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
        Mínimo{required ? " (obrigatório)" : " (opcional)"}
        <input
          name="min_selections"
          type="number"
          required
          inputMode="numeric"
          min={required ? 1 : 0}
          max={50}
          step={1}
          value={minimum}
          onChange={(event) => setMinimum(Math.max(0, Math.min(50, Number(event.target.value) || 0)))}
          className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        />
      </label>
    </>
  );
}
