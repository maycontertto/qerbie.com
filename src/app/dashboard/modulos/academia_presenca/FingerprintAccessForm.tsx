"use client";

import { useRef, useState } from "react";
import { verifyGymFingerprintAccess } from "@/lib/gym/actions";

export function FingerprintAccessForm({ students }: { students: Array<{ id: string; name: string; login: string }> }) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const codeInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedStudent, setSelectedStudent] = useState("");

  return (
    <form ref={formRef} action={verifyGymFingerprintAccess} className="mt-4 space-y-3">
      <input type="hidden" name="return_to" value="/dashboard/modulos/academia_presenca" />

      <div className="rounded-xl border border-dashed border-violet-300 bg-violet-50/60 p-4 text-center dark:border-violet-800 dark:bg-violet-950/30">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
          Leitor biométrico USB
        </p>
        <input
          ref={codeInputRef}
          name="device_user_code"
          autoFocus
          autoComplete="off"
          placeholder="Aproxime o dedo no leitor..."
          className="mt-2 w-full rounded-xl border border-violet-300 bg-white px-3 py-2 text-center text-sm dark:border-violet-700 dark:bg-zinc-900"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
        />
        <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          Conecte o leitor via USB no computador da recepção. Ao ler o dedo, o código do aluno é digitado
          automaticamente aqui.
        </p>
      </div>

      <details className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-950">
        <summary className="cursor-pointer font-semibold text-zinc-700 dark:text-zinc-200">
          Selecionar aluno manualmente (sem leitor)
        </summary>
        <select
          name="student_id"
          value={selectedStudent}
          onChange={(event) => setSelectedStudent(event.target.value)}
          className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        >
          <option value="">Selecione o aluno</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.name} • {student.login}
            </option>
          ))}
        </select>
      </details>

      <input
        name="device_name"
        placeholder="Nome do leitor (opcional)"
        defaultValue="Leitor USB recepção"
        className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
      />
      <input
        name="notes"
        placeholder="Observação (opcional)"
        className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
      />

      <button
        type="submit"
        className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Liberar acesso por digital
      </button>
    </form>
  );
}
