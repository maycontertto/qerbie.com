import Link from "next/link";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import {
  cancelMerchantTable,
  createMerchantTable,
  createQuickServiceTable,
  ensureDemoTable,
} from "@/lib/merchant/tableActions";

export default async function MesasModulePage({
  searchParams,
}: {
  searchParams: Promise<{ qr?: string; error?: string }>;
}) {
  const { qr, error } = await searchParams;
  const { user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;

  const canTables =
    isOwner ||
    (membership
      ? hasMemberPermission(membership.role, membership.permissions, "dashboard_products") ||
        hasMemberPermission(membership.role, membership.permissions, "dashboard_orders")
      : false);

  if (!canTables) {
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
            <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Mesas</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Você não tem permissão para acessar este módulo.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const supabase = await createClient();

  const { data: tables } = await supabase
    .from("merchant_tables")
    .select("id, label, qr_token, status, capacity, is_active")
    .eq("merchant_id", merchant.id)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(500);

  const activeQrToken = qr ?? tables?.[0]?.qr_token ?? null;
  const activeTable = activeQrToken
    ? (tables ?? []).find((t) => t.qr_token === activeQrToken) ?? null
    : null;
  const activeIsQuick = Boolean(activeTable?.label?.toLowerCase().startsWith("atendimento"));

  const banner =
    error === "table_create_failed"
      ? "Falha ao criar atendimento. Tente mudar o nome."
      : error === "table_cancel_failed"
        ? "Falha ao cancelar atendimento."
        : error === "invalid_table"
          ? "Atendimento inválido."
          : error === "demo_table_failed"
            ? "Falha ao criar mesa de teste."
            : null;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
            >
              ← Voltar ao painel
            </Link>
            <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Mesas</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Gere QRs por mesa/balcão/fila e acompanhe o status.
            </p>
          </div>

          {activeQrToken ? (
            <a
              href={`/t/${encodeURIComponent(activeQrToken)}${activeIsQuick ? "?quick=1" : ""}`}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Abrir QR
            </a>
          ) : null}
        </div>

        {banner ? (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            {banner}
          </div>
        ) : null}

        <section className="mt-6 space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Criar QR</h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Crie atendimentos para abrir o cardápio no celular.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Atendimento rápido (QR)
                </h3>

                <form action={createQuickServiceTable} className="mt-3">
                  <input type="hidden" name="return_to" value="/dashboard/modulos/mesas" />
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    Gerar QR automático (Atendimento rápido)
                  </button>
                </form>

                <form action={ensureDemoTable} className="mt-3">
                  <input type="hidden" name="return_to" value="/dashboard/modulos/mesas" />
                  <button
                    type="submit"
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
                  >
                    Gerar QR automático (Mesa Teste)
                  </button>
                </form>

                <form action={createMerchantTable} className="mt-3 space-y-3">
                  <input type="hidden" name="return_to" value="/dashboard/modulos/mesas" />
                  <select
                    name="kind"
                    defaultValue="mesa"
                    className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                  >
                    <option value="mesa">Mesa</option>
                    <option value="balcao">Balcão</option>
                    <option value="fila">Fila</option>
                    <option value="outro">Outro</option>
                  </select>
                  <input
                    name="label"
                    type="text"
                    placeholder="Ex: Mesa 1 (ou deixe em branco)"
                    className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                  />
                  <input
                    name="capacity"
                    type="number"
                    min={1}
                    max={99}
                    defaultValue={4}
                    className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                  />
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    Criar atendimento
                  </button>
                </form>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Atendimentos</h3>
                {!tables?.length ? (
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                    Nenhum atendimento criado ainda.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {(tables ?? []).map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-zinc-900 dark:text-zinc-50">
                            {t.label}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {t.is_active ? "Ativa" : "Inativa"}
                            {typeof t.capacity === "number" ? ` • ${t.capacity} lugares` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {t.is_active ? (
                            <form action={cancelMerchantTable}>
                              <input type="hidden" name="return_to" value="/dashboard/modulos/mesas" />
                              <input type="hidden" name="table_id" value={t.id} />
                              <button
                                type="submit"
                                className="text-xs font-semibold text-zinc-600 hover:underline dark:text-zinc-300"
                              >
                                Cancelar
                              </button>
                            </form>
                          ) : null}
                          <a
                            href={`/t/${encodeURIComponent(t.qr_token)}${t.label.toLowerCase().startsWith("atendimento") ? "?quick=1" : ""}`}
                            className="text-xs font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
                          >
                            Abrir QR
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
