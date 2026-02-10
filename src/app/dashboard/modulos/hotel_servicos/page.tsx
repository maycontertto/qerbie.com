import Link from "next/link";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { createHotelService, updateHotelService } from "@/lib/merchant/hotelActions";

function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default async function HotelServicosModulePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;
  const { user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const canCatalog =
    isOwner ||
    (membership
      ? hasMemberPermission(membership.role, membership.permissions, "dashboard_products")
      : false);

  if (!canCatalog) {
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
            <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Serviços</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Você não tem permissão para acessar este módulo.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: services } = await supabase
    .from("merchant_hotel_services")
    .select("id, name, description, price, is_active, updated_at, track_stock, stock_quantity")
    .eq("merchant_id", merchant.id)
    .order("is_active", { ascending: false })
    .order("updated_at", { ascending: false });

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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
            >
              ← Voltar ao painel
            </Link>
            <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Serviços</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Room service, lavanderia e outros extras.
            </p>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Restaurante (pratos e bebidas):{" "}
              <Link className="underline" href="/dashboard/modulos/produtos">
                Produtos
              </Link>
            </p>
          </div>
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

        <div className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
          <aside className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Novo serviço</h2>
            <form action={createHotelService} className="mt-4 space-y-3">
              <input
                name="name"
                required
                minLength={2}
                placeholder="Ex: Lavanderia"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              <input
                name="price"
                inputMode="decimal"
                placeholder="Preço (opcional)"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              <input
                name="description"
                placeholder="Descrição (opcional)"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />

              {isOwner ? (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Estoque (opcional)
                  </p>
                  <div className="mt-2 grid gap-3">
                    <label className="flex items-center justify-between gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                      <span>Controlar estoque deste serviço</span>
                      <input name="track_stock" type="checkbox" className="h-4 w-4" />
                    </label>
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                        Quantidade
                      </label>
                      <input
                        name="stock_quantity"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        placeholder="Ex: 20"
                        className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                      />
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Apenas controle interno do dono. Não impede vendas se estiver desatualizado.
                    </p>
                  </div>
                </div>
              ) : null}
              <button
                type="submit"
                className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Criar
              </button>
            </form>
          </aside>

          <section className="space-y-3">
            {services?.length ? (
              services.map((s) => (
                <div
                  key={s.id}
                  className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {s.name}
                        {Boolean((s as { track_stock?: boolean }).track_stock) ? (
                          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            {` • Qtd: ${Number((s as { stock_quantity?: number }).stock_quantity ?? 0)}`}
                          </span>
                        ) : null}
                      </h3>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {s.price != null ? formatBrl(Number(s.price)) : "Sem preço"}
                      </p>
                      {s.description ? (
                        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{s.description}</p>
                      ) : null}
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        s.is_active
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                          : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}
                    >
                      {s.is_active ? "Ativo" : "Inativo"}
                    </span>
                  </div>

                  <form action={updateHotelService} className="mt-4 grid gap-3 sm:grid-cols-2">
                    <input type="hidden" name="id" value={s.id} />
                    <input
                      name="name"
                      defaultValue={s.name}
                      className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                    />
                    <input
                      name="price"
                      inputMode="decimal"
                      defaultValue={s.price != null ? String(s.price).replace(".", ",") : ""}
                      placeholder="Preço (opcional)"
                      className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                    />
                    <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                      <span className="font-medium text-zinc-900 dark:text-zinc-50">Ativo</span>
                      <input
                        type="checkbox"
                        name="is_active"
                        defaultChecked={Boolean(s.is_active)}
                        className="h-5 w-5 rounded border-zinc-300 dark:border-zinc-700"
                      />
                    </label>
                    <input
                      name="description"
                      defaultValue={s.description ?? ""}
                      placeholder="Descrição (opcional)"
                      className="sm:col-span-2 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                    />

                    {isOwner ? (
                      <div className="sm:col-span-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          Estoque (opcional)
                        </p>
                        <div className="mt-2 grid gap-3 sm:grid-cols-2">
                          <label className="flex items-center justify-between gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                            <span>Controlar estoque</span>
                            <input
                              name="track_stock"
                              type="checkbox"
                              defaultChecked={Boolean((s as { track_stock?: boolean }).track_stock)}
                              className="h-4 w-4"
                            />
                          </label>
                          <div>
                            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                              Quantidade
                            </label>
                            <input
                              name="stock_quantity"
                              type="number"
                              inputMode="numeric"
                              min={0}
                              defaultValue={String(
                                Number((s as { stock_quantity?: number }).stock_quantity ?? 0),
                              )}
                              className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                            />
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                          Se desativar o serviço, ele é removido do controle de estoque.
                        </p>
                      </div>
                    ) : null}
                    <div className="sm:col-span-2 flex justify-end">
                      <button
                        type="submit"
                        className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                      >
                        Salvar
                      </button>
                    </div>
                  </form>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                Nenhum serviço cadastrado ainda.
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
