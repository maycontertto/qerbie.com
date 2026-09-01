"use client";

import { useState } from "react";
import { FaceAccessScanner } from "./FaceAccessScanner";
import { FingerprintAccessForm } from "./FingerprintAccessForm";
import { ManualAccessForm } from "./ManualAccessForm";

type Method = "facial" | "fingerprint" | "manual";

const TABS: Array<{ id: Method; label: string }> = [
  { id: "facial", label: "Rosto" },
  { id: "fingerprint", label: "Digital" },
  { id: "manual", label: "Manual" },
];

export function AccessMethodTabs({ students }: { students: Array<{ id: string; name: string; login: string }> }) {
  const [method, setMethod] = useState<Method>("facial");

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMethod(tab.id)}
            className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
              method === tab.id
                ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {method === "facial" ? <FaceAccessScanner students={students} /> : null}
      {method === "fingerprint" ? <FingerprintAccessForm students={students} /> : null}
      {method === "manual" ? <ManualAccessForm students={students} /> : null}

      <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
        O aluno escolhe a forma de liberar a entrada. Ambas são opcionais e cadastradas previamente pelo aluno.
      </p>
    </div>
  );
}
