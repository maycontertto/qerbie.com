import Link from "next/link";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { createGymStudent, recordGymPayment, resetGymStudentPassword, setGymMembershipDueDate } from "@/lib/gym/actions";

function formatBrlCents(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    (cents ?? 0) / 100,
  );
}

function isOverdue(nextDueAt: string | null | undefined): boolean {
  if (!nextDueAt) return false;
  const due = new Date(`${nextDueAt}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return due.getTime() < now.getTime();
}

export default async function AcademiaAlunosPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; password_reset?: string; error?: string }>;
}) {
  const { saved, password_reset, error } = await searchParams;
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
            <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Alunos</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Você não tem permissão para acessar este módulo.</p>
          </div>
        </main>
      </div>
    );
  }

  const supabase = await createClient();

  const { data: plans } = await supabase
    .from("gym_plans")
    .select("id, name, price_cents")
    .eq("merchant_id", merchant.id)
    .order("is_active", { ascending: false })
    .order("updated_at", { ascending: false });

  type PlanRow = { id: string; name: string; price_cents: number };
  const planRows = (plans ?? []) as PlanRow[];

  const { data: students } = await supabase
    .from("gym_students")
    .select("id, name, login, is_active, updated_at")
    .eq("merchant_id", merchant.id)
    .order("is_active", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(500);

  const studentIds = (students ?? []).map((s) => s.id);

  let memberships: Array<{
    id: string;
    student_id: string;
    plan_id: string | null;
    status: string;
    next_due_at: string | null;
    last_paid_at: string | null;
    updated_at: string;
  }> = [];

  if (studentIds.length) {
    const { data } = await supabase
      .from("gym_memberships")
      .select("id, student_id, plan_id, status, next_due_at, last_paid_at, updated_at")
      .eq("merchant_id", merchant.id)
      .in("student_id", studentIds)
      .order("updated_at", { ascending: false });

    memberships = (data ?? []) as typeof memberships;
  }

  const membershipByStudent = new Map<string, (typeof memberships)[number]>();
  for (const m of memberships) {
    if (!membershipByStudent.has(m.student_id)) membershipByStudent.set(m.student_id, m);
  }

  const planById = new Map<string, PlanRow>();
  for (const p of planRows) planById.set(p.id, p);

  const banner =
    saved === "1"
      ? { kind: "success" as const, message: "Salvo." }
      : password_reset === "1"
        ? { kind: "success" as const, message: "Senha redefinida." }
      : error === "invalid"
        ? { kind: "error" as const, message: "Dados inválidos." }
        : error === "login_taken"
          ? { kind: "error" as const, message: "Esse login já existe." }
        : error === "save_failed"
          ? { kind: "error" as const, message: "Não foi possível salvar agora. Tente novamente." }
          : null;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div>
          <Link href="/dashboard" className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50">
            ← Voltar ao painel
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Alunos</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Controle de vencimentos e registro de pagamentos (manual).
          </p>
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

        <div className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
          <aside className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Novo aluno</h2>
            <form action={createGymStudent} className="mt-4 space-y-3">
              <input type="hidden" name="return_to" value="/dashboard/modulos/academia_alunos" />
              <input
                name="login"
                required
                minLength={2}
                placeholder="Usuário (ex: joao)"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              <input
                name="password"
                required
                minLength={1}
                placeholder="Senha"
                type="password"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              <select
                name="plan_id"
                defaultValue=""
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              >
                <option value="">Sem plano (definir depois)</option>
                {(plans ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({formatBrlCents(Number(p.price_cents ?? 0))})
                  </option>
                ))}
              </select>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Vencimento (opcional)</label>
                <input
                  name="next_due_at"
                  type="date"
                  className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Criar
              </button>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                O aluno também pode entrar via QR de cadastro.
              </p>
            </form>
          </aside>

          <section className="space-y-3">
            {students?.length ? (
              students.map((s) => {
                const m = membershipByStudent.get(s.id) ?? null;
                const p = m?.plan_id ? planById.get(m.plan_id) ?? null : null;
                const overdue = isOverdue(m?.next_due_at);

                return (
                  <div
                    key={s.id}
                    className={`rounded-2xl border bg-white/70 p-5 shadow-sm backdrop-blur dark:bg-zinc-900/60 ${
                      overdue
                        ? "border-red-200 dark:border-red-900/60"
                        : "border-zinc-200 dark:border-zinc-800"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                          {s.name}
                          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{` • ${s.login}`}</span>
                        </h3>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          {p ? `Plano: ${p.name} (${formatBrlCents(Number(p.price_cents ?? 0))})` : "Sem plano"}
                          {m?.next_due_at ? ` • Vence: ${m.next_due_at}` : ""}
                          {m?.last_paid_at ? ` • Último pag.: ${m.last_paid_at}` : ""}
                        </p>
                      </div>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${
                          overdue
                            ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                        }`}
                      >
                        {overdue ? "Vencido" : "Em dia"}
                      </span>
                    </div>

                    {m ? (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <form action={resetGymStudentPassword} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                          <input type="hidden" name="return_to" value="/dashboard/modulos/academia_alunos" />
                          <input type="hidden" name="student_id" value={s.id} />
                          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Senha</p>
                          <input
                            name="password"
                            type="password"
                            required
                            minLength={1}
                            placeholder="Nova senha"
                            className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                          />
                          <button
                            type="submit"
                            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
                          >
                            Redefinir senha
                          </button>
                          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                            Isso desconecta sessões ativas do aluno.
                          </p>
                        </form>

                        <form action={recordGymPayment} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                          <input type="hidden" name="return_to" value="/dashboard/modulos/academia_alunos" />
                          <input type="hidden" name="membership_id" value={m.id} />
                          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Pagamento</p>
                          <input
                            name="note"
                            placeholder="Observação (opcional)"
                            className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                          />
                          <button
                            type="submit"
                            className="mt-2 w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                          >
                            Marcar como pago (avançar 1 período)
                          </button>
                        </form>

                        <form action={setGymMembershipDueDate} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                          <input type="hidden" name="return_to" value="/dashboard/modulos/academia_alunos" />
                          <input type="hidden" name="membership_id" value={m.id} />
                          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Vencimento</p>
                          <input
                            name="next_due_at"
                            type="date"
                            defaultValue={m.next_due_at ?? ""}
                            className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                          />
                          <button
                            type="submit"
                            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
                          >
                            Atualizar vencimento
                          </button>
                        </form>
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
                        Sem mensalidade associada ainda.
                      </p>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-zinc-200 bg-white/70 p-6 text-sm text-zinc-600 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
                Nenhum aluno cadastrado ainda.
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
