import Link from "next/link";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { AccessMethodTabs } from "./AccessMethodTabs";

export default async function AcademiaPresencaPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; already_checked?: string; direction?: string }>;
}) {
  const { saved, error, direction } = await searchParams;
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

  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate(),
  ).padStart(2, "0")}`;

  const { data: todayCheckins } = await supabase
    .from("gym_checkins")
    .select("id, student_id, created_at, checked_out_at, verification_method, checkout_verification_method")
    .eq("merchant_id", merchant.id)
    .eq("checkin_date", todayIso)
    .order("created_at", { ascending: false })
    .limit(500);

  type TodayCheckin = {
    id: string;
    student_id: string;
    created_at: string;
    checked_out_at: string | null;
    verification_method: string;
    checkout_verification_method: string | null;
  };

  const checkinsToday = (todayCheckins ?? []) as TodayCheckin[];
  const studentNameById = new Map<string, string>();
  for (const student of students ?? []) {
    studentNameById.set(student.id, student.name);
  }

  const timeFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const methodLabel: Record<string, string> = {
    manual: "Manual",
    qr: "QR",
    facial: "Rosto",
    fingerprint: "Digital",
  };

  const peakHourCounts = new Map<number, number>();
  for (const c of checkinsToday) {
    const hour = new Date(c.created_at).getHours();
    peakHourCounts.set(hour, (peakHourCounts.get(hour) ?? 0) + 1);
  }
  const peakHours = Array.from(peakHourCounts.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([hour, count]) => ({ hour, count }));
  const peakHourMax = peakHours.reduce((max, item) => Math.max(max, item.count), 0);

  const banner =
    saved === "1"
      ? {
          kind: "success" as const,
          message: direction === "out" ? "Saída registrada." : "Entrada registrada.",
        }
      : error === "invalid"
        ? { kind: "error" as const, message: "Aluno inválido." }
        : error === "already_completed"
          ? { kind: "warning" as const, message: "Esse aluno já registrou entrada e saída hoje." }
          : error === "no_face_profile"
            ? { kind: "error" as const, message: "Esse aluno ainda não cadastrou o rosto." }
            : error === "no_fingerprint_profile"
              ? { kind: "error" as const, message: "Esse aluno ainda não cadastrou a digital." }
              : error === "fingerprint_not_recognized"
                ? { kind: "error" as const, message: "Digital não reconhecida. Tente novamente ou selecione o aluno." }
                : error === "save_failed"
                  ? { kind: "error" as const, message: "Não foi possível registrar o acesso." }
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
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Registrar entrada / saída</h2>
            <AccessMethodTabs students={students ?? []} />
          </aside>

          <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Hoje na academia</h2>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Entrada e saída de cada aluno hoje.</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                  {checkinsToday.length} hoje
                </span>
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                <div className="max-h-96 overflow-auto">
                  <table className="min-w-full divide-y divide-zinc-200 text-left text-sm dark:divide-zinc-800">
                    <thead className="bg-zinc-50 dark:bg-zinc-950/60">
                      <tr>
                        <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-300">Aluno</th>
                        <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-300">Entrada</th>
                        <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-300">Saída</th>
                        <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-300">Método</th>
                        <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-300">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-900/40">
                      {checkinsToday.length ? (
                        checkinsToday.map((c) => (
                          <tr key={c.id}>
                            <td className="px-3 py-2 text-zinc-800 dark:text-zinc-100">
                              {studentNameById.get(c.student_id) ?? "Aluno"}
                            </td>
                            <td className="px-3 py-2 text-zinc-700 dark:text-zinc-200">
                              {timeFormatter.format(new Date(c.created_at))}
                            </td>
                            <td className="px-3 py-2 text-zinc-700 dark:text-zinc-200">
                              {c.checked_out_at ? timeFormatter.format(new Date(c.checked_out_at)) : "-"}
                            </td>
                            <td className="px-3 py-2 capitalize text-zinc-700 dark:text-zinc-200">
                              {methodLabel[c.verification_method] ?? c.verification_method}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                  c.checked_out_at
                                    ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                                }`}
                              >
                                {c.checked_out_at ? "Saiu" : "Na academia"}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-3 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                            Nenhuma entrada registrada hoje.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Movimento por horário hoje</h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Controle de horário de pico com base nas entradas do dia.</p>

              {peakHours.length ? (
                <div className="mt-4 space-y-1.5">
                  {peakHours.map((item) => (
                    <div key={item.hour} className="flex items-center gap-3">
                      <span className="w-12 shrink-0 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                        {String(item.hour).padStart(2, "0")}h
                      </span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-violet-600"
                          style={{ width: `${peakHourMax ? (item.count / peakHourMax) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="w-6 shrink-0 text-right text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                        {item.count}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">Sem movimento registrado hoje ainda.</p>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
