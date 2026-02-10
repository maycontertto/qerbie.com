import Link from "next/link";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";

function formatBrlCents(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    (cents ?? 0) / 100,
  );
}

export default async function AcademiaFinanceiroPage() {
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
            <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Histórico & Faturamento</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Você não tem permissão para acessar este módulo.</p>
          </div>
        </main>
      </div>
    );
  }

  const supabase = await createClient();

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data: payments } = await supabase
    .from("gym_payments")
    .select("id, amount_cents, paid_at, note")
    .eq("merchant_id", merchant.id)
    .gte("paid_at", since.toISOString())
    .order("paid_at", { ascending: false })
    .limit(200);

  const totalCents = (payments ?? []).reduce((acc, p) => acc + Number(p.amount_cents ?? 0), 0);

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div>
          <Link href="/dashboard" className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50">
            ← Voltar ao painel
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Histórico & Faturamento</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Últimos 30 dias (registro manual).</p>
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Total (30 dias)</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{formatBrlCents(totalCents)}</p>
        </div>

        <section className="mt-6 space-y-3">
          {payments?.length ? (
            payments.map((p) => (
              <div
                key={p.id}
                className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {formatBrlCents(Number(p.amount_cents ?? 0))}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{new Date(p.paid_at).toLocaleString("pt-BR")}</p>
                    {p.note ? <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{p.note}</p> : null}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-zinc-200 bg-white/70 p-6 text-sm text-zinc-600 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
              Nenhum pagamento registrado ainda.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
