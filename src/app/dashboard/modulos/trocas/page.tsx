import Link from "next/link";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { createExchangeRequest, updateExchangeStatus } from "@/lib/merchant/exchangeActions";
import type { ExchangeRequestStatus } from "@/lib/supabase/database.types";

function statusLabel(s: ExchangeRequestStatus): string {
  switch (s) {
    case "open":
      return "Aberta";
    case "in_progress":
      return "Em andamento";
    case "done":
      return "Concluída";
    case "cancelled":
      return "Cancelada";
  }
}

export default async function TrocasModulePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;
  const { user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const canOps =
    isOwner ||
    (membership
      ? hasMemberPermission(membership.role, membership.permissions, "dashboard_orders")
      : false);

  if (!canOps) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
            >
              ← Voltar ao painel
            </Link>
            <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Trocas</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Você não tem permissão para acessar este módulo.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const supabase = await createClient();

  const [{ data: requests }, { data: orders }] = await Promise.all([
    supabase
      .from("merchant_exchange_requests")
      .select("id, order_id, customer_name, contact, reason, notes, status, created_at")
      .eq("merchant_id", merchant.id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("orders")
      .select("id, order_number, status, created_at")
      .eq("merchant_id", merchant.id)
      .order("created_at", { ascending: false })
      .limit(80),
  ]);

  const orderLabelById = new Map<string, string>();
  for (const o of orders ?? []) {
    const label = o.order_number ? `Pedido #${o.order_number}` : `Pedido ${o.id.slice(0, 8)}`;
    orderLabelById.set(o.id, label);
  }

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
          <Link
            href="/dashboard"
            className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
          >
            ← Voltar ao painel
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Trocas</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Registre pedidos de troca/devolução e acompanhe o status.
          </p>
        </div>

        {banner && (
          <div
            className={`mt-6 rounded-2xl border p-4 text-sm ${
              banner.kind === "error"
                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
                : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
            }`}
          >
            {banner.message}
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[420px_1fr]">
          <aside className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Nova solicitação</h2>
            <form action={createExchangeRequest} className="mt-4 space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Pedido (opcional)
              </label>
              <select
                name="order_id"
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              >
                <option value="">Sem vínculo</option>
                {(orders ?? []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {orderLabelById.get(o.id)}
                  </option>
                ))}
              </select>

              <input
                name="customer_name"
                placeholder="Cliente (opcional)"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              <input
                name="contact"
                placeholder="Contato (opcional)"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              <textarea
                name="reason"
                rows={3}
                placeholder="Motivo (ex: numeração, defeito, cor)"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              <textarea
                name="notes"
                rows={3}
                placeholder="Observações (opcional)"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Criar
              </button>
            </form>
          </aside>

          <section className="space-y-3">
            {requests?.length ? (
              requests.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {r.order_id ? (orderLabelById.get(r.order_id) ?? "Pedido") : "Troca (sem pedido)"}
                      </h3>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {r.customer_name ? r.customer_name : "Cliente não informado"}
                        {r.contact ? ` • ${r.contact}` : ""}
                      </p>
                      {r.reason ? (
                        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{r.reason}</p>
                      ) : null}
                      {r.notes ? (
                        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{r.notes}</p>
                      ) : null}
                    </div>
                    <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                      {statusLabel(r.status as ExchangeRequestStatus)}
                    </span>
                  </div>

                  <form action={updateExchangeStatus} className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <input type="hidden" name="id" value={r.id} />
                    <select
                      name="status"
                      defaultValue={String(r.status)}
                      className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                    >
                      <option value="open">Aberta</option>
                      <option value="in_progress">Em andamento</option>
                      <option value="done">Concluída</option>
                      <option value="cancelled">Cancelada</option>
                    </select>
                    <button
                      type="submit"
                      className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    >
                      Atualizar
                    </button>
                  </form>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                Nenhuma solicitação registrada ainda.
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
