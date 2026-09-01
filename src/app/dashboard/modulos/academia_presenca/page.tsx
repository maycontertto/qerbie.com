import Link from "next/link";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { registerGymAccessCheckin } from "@/lib/gym/actions";

export default async function AcademiaPresencaPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; already_checked?: string }>;
}) {
  const { saved, error, already_checked } = await searchParams;
  const { user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const canAccess =
    isOwner ||
    (membership
      ? hasMemberPermission(membership.role, membership.permissions, "dashboard_products") ||
        hasMemberPermission(membership.role, membership.permissions, "dashboard_orders")
      : false);

  if (!canAccess) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <Link href="/dashboard" className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50">
              ← Voltar ao painel
            </Link>
            <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Presença e acesso</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Você não tem permissão para acessar este módulo.</p>
          </div>
        </main>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: students } = await supabase
    .from("gym_students")
    .select("id, name, login, is_active")
    .eq("merchant_id", merchant.id)
    .order("name", { ascending: true })
    .limit(500);

  const banner =
    saved === "1"
      ? { kind: "success" as const, message: "Entrada registrada." }
      : already_checked === "1"
        ? { kind: "warning" as const, message: "Esse aluno já registrou entrada hoje." }
        : error === "invalid"
          ? { kind: "error" as const, message: "Aluno inválido." }
          : error === "save_failed"
            ? { kind: "error" as const, message: "Não foi possível registrar a entrada." }
            : null;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div>
          <Link href="/dashboard" className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50">
            ← Voltar ao painel
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Presença e acesso</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Recepção, QR e biometria em um único painel.</p>
        </div>

        {banner ? (
          <div
            className={`mt-6 rounded-2xl border p-4 text-sm ${
              banner.kind === "error"
                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
                : banner.kind === "warning"
                  ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
            }`}
          >
            {banner.message}
          </div>
        ) : null}

        <section className="mt-8 grid gap-6 lg:grid-cols-[420px_1fr]">
          <aside className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Registrar entrada</h2>
            <form action={registerGymAccessCheckin} className="mt-4 space-y-3">
              <input type="hidden" name="return_to" value="/dashboard/modulos/academia_presenca" />
              <select name="student_id" required className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800">
                <option value="">Selecione o aluno</option>
                {(students ?? []).map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} • {student.login}
                  </option>
                ))}
              </select>

              <select name="method" defaultValue="facial" className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800">
                <option value="manual">Manual</option>
                <option value="qr">QR</option>
                <option value="facial">Face</option>
                <option value="fingerprint">Digital</option>
              </select>

              <input
                name="confidence"
                type="number"
                step="0.01"
                min="0"
                max="1"
                placeholder="Confiança (0.98)"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />

              <input
                name="device_name"
                placeholder="Dispositivo / ponto de acesso"
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
                Confirmar entrada
              </button>
            </form>
          </aside>

          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Hoje na academia</h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Lista dos alunos com entrada registrada no dia de hoje.</p>

            <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="min-w-full divide-y divide-zinc-200 text-left text-sm dark:divide-zinc-800">
                <thead className="bg-zinc-50 dark:bg-zinc-950/60">
                  <tr>
                    <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-300">Aluno</th>
                    <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-300">Login</th>
                    <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-300">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-900/40">
                  {(students ?? []).map((student) => (
                    <tr key={student.id}>
                      <td className="px-3 py-2 text-zinc-800 dark:text-zinc-100">{student.name}</td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-200">{student.login}</td>
                      <td className="px-3 py-2">
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                          Ativo
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
