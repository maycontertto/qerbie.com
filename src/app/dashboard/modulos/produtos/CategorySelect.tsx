"use client";

import { useMemo, useState } from "react";

type Category = {
  id: string;
  name: string;
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function CategorySelect({
  name,
  categories,
  defaultValue,
  className,
}: {
  name: string;
  categories: Category[];
  defaultValue?: string;
  className?: string;
}) {
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const q = normalize(filter);
    if (!q) return categories;
    return categories.filter((c) => normalize(c.name).includes(q));
  }, [categories, filter]);

  return (
    <div>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Buscar categoria pelo nome"
        className="mb-2 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
      />
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        className={
          className ??
          "block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        }
      >
        <option value="">(Sem categoria)</option>
        {filtered.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
