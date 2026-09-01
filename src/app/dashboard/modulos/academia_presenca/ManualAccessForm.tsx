"use client";

import { useState } from "react";
import { registerGymAccessCheckin } from "@/lib/gym/actions";

export function ManualAccessForm({ students }: { students: Array<{ id: string; name: string; login: string }> }) {
  const [selectedStudent, setSelectedStudent] = useState(students[0]?.id ?? "");

  return (
    <form action={registerGymAccessCheckin} className="mt-4 space-y-3">
      <input type="hidden" name="return_to" value="/dashboard/modulos/academia_presenca" />
      <input type="hidden" name="method" value="manual" />
      <select
        name="student_id"
        value={selectedStudent}
        onChange={(event) => setSelectedStudent(event.target.value)}
        required
        className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
      >
        <option value="">Selecione o aluno</option>
        {students.map((student) => (
          <option key={student.id} value={student.id}>
            {student.name} • {student.login}
          </option>
        ))}
      </select>
      <input
        name="device_name"
        placeholder="Recepção / terminal"
        defaultValue="Recepção"
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
        Registrar entrada/saída manual
      </button>
    </form>
  );
}
