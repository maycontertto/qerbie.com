import Link from "next/link";
import { getDashboardUserOrRedirect } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { createPurchaseEntry } from "@/lib/merchant/purchaseActions";
import { PurchaseItemsEditor } from "./PurchaseItemsEditor";

function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default async function ComprasModulePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;
  const { user, merchant } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;

  if (!isOwner) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <Link href="/dashboard" className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50">
              ← Voltar ao painel
            </Link>
            <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Compras</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Apenas o proprietário pode lançar entradas de nota e atualizar custo/estoque em lote.
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (merchant.business_category !== "mercado") {
    return (
      <div className="min-h-screen">
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <Link href="/dashboard" className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50">
              ← Voltar ao painel
            </Link>
            <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Compras</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Este módulo foi liberado primeiro para mercados. Depois podemos expandir para outros segmentos.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: products }, { data: suppliers }, { data: recentEntries }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, barcode, unit_label, stock_quantity, cost_price, is_active")
      .eq("merchant_id", merchant.id)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("merchant_suppliers")
      .select("id, name")
      .eq("merchant_id", merchant.id)
      .order("name", { ascending: true }),
    supabase
      .from("purchase_entries")
      .select("id, invoice_number, supplier_name, entry_date, item_count, total_amount, created_at")
      .eq("merchant_id", merchant.id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const banner =
    saved === "1"
      ? { kind: "success" as const, message: "Compra lançada e estoque atualizado com sucesso." }
      : error === "invalid_items"
        ? { kind: "error" as const, message: "Confira os itens da nota. Cada linha precisa ter produto, quantidade e custo." }
        : error === "invalid_invoice_number"
          ? { kind: "error" as const, message: "Informe o número da nota ou uma referência da compra." }
          : error === "invalid_supplier"
            ? { kind: "error" as const, message: "Fornecedor inválido." }
            : error === "invalid_product"
              ? { kind: "error" as const, message: "Um dos produtos informados não foi encontrado." }
              : error === "unsupported_category"
                ? { kind: "error" as const, message: "Este módulo ainda não está disponível para esse tipo de negócio." }
                : error === "not_owner"
                  ? { kind: "error" as const, message: "Somente o proprietário pode confirmar entradas de compra." }
                  : error === "save_failed"
                    ? { kind: "error" as const, message: "Não foi possível registrar a compra agora. Tente novamente." }
                    : null;

  const totalRecent = (recentEntries ?? []).reduce((sum, entry) => sum + Number(entry.total_amount ?? 0), 0);

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/dashboard" className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50">
              ← Voltar ao painel
            </Link>
            <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Compras / entrada de nota</h1>
            <p className="mt-1 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
              Lance a compra completa de uma vez para atualizar o estoque, registrar a nota e guardar o custo mais recente dos produtos.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/dashboard/modulos/produtos" className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
              Produtos
            </Link>
            <Link href="/dashboard/modulos/estoque" className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
              Estoque
            </Link>
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

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Produtos ativos</p>
            <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">{products?.length ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Fornecedores cadastrados</p>
            <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">{suppliers?.length ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Últimas entradas</p>
            <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">{formatBrl(totalRecent)}</p>
          </div>
        </div>

        {products?.length ? (
          <form action={createPurchaseEntry} className="mt-8 space-y-6">
            <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
              <div className="space-y-6">
                <div className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Dados da nota</h2>

                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Fornecedor existente</label>
                      <select
                        name="supplier_id"
                        defaultValue=""
                        className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                      >
                        <option value="">Selecionar depois / usar nome abaixo</option>
                        {(suppliers ?? []).map((supplier) => (
                          <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Novo fornecedor (opcional)</label>
                      <input
                        name="supplier_name"
                        type="text"
                        placeholder="Ex: Distribuidora Central"
                        className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                      />
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        Se preencher e o fornecedor não existir, ele será criado automaticamente.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Número da nota / referência</label>
                      <input
                        name="invoice_number"
                        type="text"
                        required
                        placeholder="Ex: 15482"
                        className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Data de emissão</label>
                        <input
                          name="issue_date"
                          type="date"
                          className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Data de entrada</label>
                        <input
                          name="entry_date"
                          type="date"
                          defaultValue={today}
                          className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Observações</label>
                      <textarea
                        name="notes"
                        rows={4}
                        placeholder="Observações da compra, vencimento, condição, conferência etc."
                        className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white/70 p-5 text-sm text-zinc-600 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-50">Como esse lançamento funciona</p>
                  <ul className="mt-3 space-y-2">
                    <li>• soma a quantidade ao estoque atual</li>
                    <li>• ativa controle de estoque no produto, se necessário</li>
                    <li>• atualiza o custo da última compra</li>
                    <li>• recalcula o custo médio</li>
                    <li>• registra histórico da entrada</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-6">
                <PurchaseItemsEditor
                  products={(products ?? []).map((product) => ({
                    id: product.id,
                    name: product.name,
                    barcode: (product as { barcode?: string | null }).barcode ?? null,
                    unitLabel: String((product as { unit_label?: string | null }).unit_label ?? "un"),
                    stockQuantity: Number((product as { stock_quantity?: number | null }).stock_quantity ?? 0),
                    costPrice: Number((product as { cost_price?: number | null }).cost_price ?? 0),
                  }))}
                />

                <div className="flex flex-wrap justify-end gap-3">
                  <Link
                    href="/dashboard/modulos/estoque"
                    className="rounded-xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Voltar ao estoque
                  </Link>
                  <button
                    type="submit"
                    className="rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    Confirmar entrada da compra
                  </button>
                </div>
              </div>
            </div>
          </form>
        ) : (
          <div className="mt-8 rounded-2xl border border-zinc-200 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Cadastre produtos primeiro</h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Para lançar a nota completa, o ideal é que os produtos já estejam no catálogo. Depois a entrada atualiza tudo em lote.
            </p>
            <Link href="/dashboard/modulos/produtos" className="mt-4 inline-flex text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-50">
              Ir para Produtos
            </Link>
          </div>
        )}

        <div className="mt-10 rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Últimas compras lançadas</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Histórico rápido das entradas registradas neste mercado.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {recentEntries?.length ? (
              recentEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/60"
                >
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Nota {entry.invoice_number}
                      {entry.supplier_name ? ` · ${entry.supplier_name}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Entrada em {entry.entry_date ? new Date(entry.entry_date).toLocaleDateString("pt-BR") : "—"}
                      {` · ${entry.item_count ?? 0} item(ns)`}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    {formatBrl(Number(entry.total_amount ?? 0))}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhuma compra lançada ainda.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
