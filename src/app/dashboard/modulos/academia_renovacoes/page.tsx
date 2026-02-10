import Link from "next/link";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { recordGymPayment, setGymMembershipDueDate } from "@/lib/gym/actions";

function isOverdue(nextDueAt: string | null | undefined): boolean {
  if (!nextDueAt) return false;
  const due = new Date(`${nextDueAt}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return due.getTime() < now.getTime();
}

export default async function AcademiaRenovacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;
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
            <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Renovações</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Você não tem permissão para acessar este módulo.</p>
          </div>
        </main>
      </div>
    );
  }

  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("gym_memberships")
    .select("id, student_id, next_due_at, last_paid_at, status, updated_at")
    .eq("merchant_id", merchant.id)
    .order("next_due_at", { ascending: true })
    .limit(500);

  const studentIds = (memberships ?? []).map((m) => m.student_id);

  type StudentRow = { id: string; name: string; login: string };
  let students: StudentRow[] = [];

  if (studentIds.length) {
    const { data } = await supabase
      .from("gym_students")
      .select("id, name, login")
      .eq("merchant_id", merchant.id)
      .in("id", studentIds);

    students = (data ?? []) as StudentRow[];
  }

  const studentById = new Map<string, StudentRow>();
  for (const s of students) studentById.set(s.id, s);

  const overdueList = (memberships ?? []).filter((m) => isOverdue(m.next_due_at));

  const banner =
    saved === "1"
      ? { kind: "success" as const, message: "Salvo." }
      : error === "invalid"
        ? { kind: "error" as const, message: "Dados inválidos." }
        : error === "save_failed"
          ? { kind: "error" as const, message: "Não foi possível salvar agora. Tente novamente." }
          : null;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div>
          <Link href="/dashboard" className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50">
            ← Voltar ao painel
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Renovações</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Lista de vencidos (para cobrar/renovar).</p>
        </div>

        {banner ? (
          <div
            className={`mt-6 rounded-2xl border p-4 text-sm ${
              banner.kind === "error"
                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
                : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
            }`}
          >
            {banner.message}
          </div>
        ) : null}

        <section className="mt-8 space-y-3">
          {overdueList.length ? (
            overdueList.map((m) => {
              const s = studentById.get(m.student_id);
              return (
                <div
                  key={m.id}
                  className="rounded-2xl border border-red-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-red-900/60 dark:bg-zinc-900/60"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {s?.name ?? "Aluno"}
                        {s?.login ? (
                          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{` • ${s.login}`}</span>
                        ) : null}
                      </h3>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {m.next_due_at ? `Venceu em: ${m.next_due_at}` : "Sem vencimento"}
                        {m.last_paid_at ? ` • Último pag.: ${m.last_paid_at}` : ""}
                      </p>
                    </div>
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-200">
                      Vencido
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <form action={recordGymPayment}>
                      <input type="hidden" name="return_to" value="/dashboard/modulos/academia_renovacoes" />
                      <input type="hidden" name="membership_id" value={m.id} />
                      <button
                        type="submit"
                        className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                      >
                        Marcar pago
                      </button>
                    </form>

                    <form action={setGymMembershipDueDate} className="flex gap-2">
                      <input type="hidden" name="return_to" value="/dashboard/modulos/academia_renovacoes" />
                      <input type="hidden" name="membership_id" value={m.id} />
                      <input
                        type="date"
                        name="next_due_at"
                        defaultValue={m.next_due_at ?? ""}
                        className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                      />
                      <button
                        type="submit"
                        className="shrink-0 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
                      >
                        Salvar
                      </button>
                    </form>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-zinc-200 bg-white/70 p-6 text-sm text-zinc-600 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
              Nenhum aluno vencido no momento.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
