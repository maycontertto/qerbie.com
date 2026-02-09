import Link from "next/link";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import {
  createProductOption,
  createProductOptionGroup,
  updateProductOption,
  updateProductOptionGroup,
} from "@/lib/catalog/variationsActions";
import type { OptionGroupSelectionType } from "@/lib/supabase/database.types";

function selectionLabel(t: OptionGroupSelectionType): string {
  return t === "multiple" ? "Múltipla" : "Única";
}

export default async function VariacoesModulePage({
  searchParams,
}: {
  searchParams: Promise<{ productId?: string; saved?: string; error?: string }>;
}) {
  const { productId, saved, error } = await searchParams;
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
            <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Variações</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Você não tem permissão para acessar este módulo.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select("id, name, is_active")
    .eq("merchant_id", merchant.id)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  const selectedProductId = (productId ?? "").trim() || (products?.[0]?.id ?? "");

  const { data: groups } = selectedProductId
    ? await supabase
        .from("product_option_groups")
        .select(
          "id, product_id, name, selection_type, is_required, min_selections, max_selections, display_order, updated_at",
        )
        .eq("merchant_id", merchant.id)
        .eq("product_id", selectedProductId)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true })
    : { data: null };

  const groupIds = (groups ?? []).map((g) => g.id);
  const { data: options } = groupIds.length
    ? await supabase
        .from("product_options")
        .select("id, option_group_id, name, price_modifier, is_active, display_order, updated_at")
        .eq("merchant_id", merchant.id)
        .in("option_group_id", groupIds)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true })
    : { data: null };

  const optionsByGroup = new Map<string, typeof options>();
  for (const o of options ?? []) {
    const arr = optionsByGroup.get(o.option_group_id) ?? [];
    arr.push(o);
    optionsByGroup.set(o.option_group_id, arr);
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
            >
              ← Voltar ao painel
            </Link>
            <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Variações</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Configure tamanhos e cores por produto.
            </p>
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Estoque por produto: <Link className="underline" href="/dashboard/modulos/estoque">Estoque</Link>
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

        <div className="mt-8 grid gap-6 lg:grid-cols-[420px_1fr]">
          <aside className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Produto</h2>
            <form method="get" className="mt-4 space-y-3">
              <select
                name="productId"
                defaultValue={selectedProductId}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              >
                {(products ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Abrir variações
              </button>
            </form>

            <div className="mt-6 border-t border-zinc-200 pt-5 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Novo grupo</h2>
              <form action={createProductOptionGroup} className="mt-4 space-y-3">
                <input type="hidden" name="product_id" value={selectedProductId} />
                <input
                  name="name"
                  required
                  minLength={2}
                  placeholder="Ex: Tamanho"
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
                <select
                  name="selection_type"
                  defaultValue="single"
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                >
                  <option value="single">Seleção única</option>
                  <option value="multiple">Seleção múltipla</option>
                </select>
                <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">Obrigatório</span>
                  <input
                    type="checkbox"
                    name="is_required"
                    className="h-5 w-5 rounded border-zinc-300 dark:border-zinc-700"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    name="min_selections"
                    inputMode="numeric"
                    defaultValue="0"
                    placeholder="Mín"
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                  />
                  <input
                    name="max_selections"
                    inputMode="numeric"
                    defaultValue="1"
                    placeholder="Máx"
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Criar grupo
                </button>
              </form>
            </div>
          </aside>

          <section className="space-y-3">
            {selectedProductId ? (
              (groups ?? []).length ? (
                (groups ?? []).map((g) => (
                  <div
                    key={g.id}
                    className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{g.name}</h3>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          {selectionLabel(g.selection_type as OptionGroupSelectionType)}
                          {g.is_required ? " • Obrigatório" : ""}
                          {` • ${g.min_selections}-${g.max_selections}`}
                        </p>
                      </div>
                    </div>

                    <form action={updateProductOptionGroup} className="mt-4 grid gap-3 sm:grid-cols-2">
                      <input type="hidden" name="id" value={g.id} />
                      <input type="hidden" name="product_id" value={selectedProductId} />
                      <input
                        name="name"
                        defaultValue={g.name}
                        className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                      />
                      <select
                        name="selection_type"
                        defaultValue={String(g.selection_type)}
                        className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                      >
                        <option value="single">Seleção única</option>
                        <option value="multiple">Seleção múltipla</option>
                      </select>
                      <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">Obrigatório</span>
                        <input
                          type="checkbox"
                          name="is_required"
                          defaultChecked={Boolean(g.is_required)}
                          className="h-5 w-5 rounded border-zinc-300 dark:border-zinc-700"
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          name="min_selections"
                          inputMode="numeric"
                          defaultValue={String(g.min_selections ?? 0)}
                          placeholder="Mín"
                          className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                        />
                        <input
                          name="max_selections"
                          inputMode="numeric"
                          defaultValue={String(g.max_selections ?? 1)}
                          placeholder="Máx"
                          className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                        />
                      </div>
                      <div className="sm:col-span-2 flex justify-end">
                        <button
                          type="submit"
                          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                        >
                          Salvar grupo
                        </button>
                      </div>
                    </form>

                    <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Opções
                      </h4>

                      <form action={createProductOption} className="mt-3 grid gap-3 sm:grid-cols-[1fr_160px_120px]">
                        <input type="hidden" name="product_id" value={selectedProductId} />
                        <input type="hidden" name="option_group_id" value={g.id} />
                        <input
                          name="name"
                          required
                          minLength={1}
                          placeholder="Ex: 38"
                          className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                        />
                        <input
                          name="price_modifier"
                          inputMode="decimal"
                          placeholder="+ preço"
                          className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                        />
                        <button
                          type="submit"
                          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                        >
                          Adicionar
                        </button>
                      </form>

                      <div className="mt-4 space-y-2">
                        {(optionsByGroup.get(g.id) ?? []).length ? (
                          (optionsByGroup.get(g.id) ?? []).map((o) => (
                            <form
                              key={o.id}
                              action={updateProductOption}
                              className="grid items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 sm:grid-cols-[1fr_160px_140px_120px] dark:border-zinc-800 dark:bg-zinc-950"
                            >
                              <input type="hidden" name="id" value={o.id} />
                              <input type="hidden" name="product_id" value={selectedProductId} />
                              <input
                                name="name"
                                defaultValue={o.name}
                                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                              />
                              <input
                                name="price_modifier"
                                inputMode="decimal"
                                defaultValue={Number(o.price_modifier ?? 0).toFixed(2).replace(".", ",")}
                                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                              />
                              <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                                <span className="font-medium text-zinc-900 dark:text-zinc-50">Ativa</span>
                                <input
                                  type="checkbox"
                                  name="is_active"
                                  defaultChecked={Boolean(o.is_active)}
                                  className="h-5 w-5 rounded border-zinc-300 dark:border-zinc-700"
                                />
                              </label>
                              <button
                                type="submit"
                                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                              >
                                Salvar
                              </button>
                            </form>
                          ))
                        ) : (
                          <div className="text-sm text-zinc-600 dark:text-zinc-300">
                            Nenhuma opção cadastrada.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                  Nenhum grupo criado para este produto.
                </div>
              )
            ) : (
              <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                Cadastre um produto primeiro.
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
