import Link from "next/link";
import { getDashboardUserOrRedirect } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { PurchaseEntryForm } from "./PurchaseEntryForm";

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
      .select("id, name, barcode, internal_code, unit_label, stock_quantity, cost_price, is_active")
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
          <PurchaseEntryForm
            today={today}
            suppliers={(suppliers ?? []).map((supplier) => ({ id: supplier.id, name: supplier.name }))}
            products={(products ?? []).map((product) => ({
              id: product.id,
              name: product.name,
              barcode: (product as { barcode?: string | null }).barcode ?? null,
              internalCode: (product as { internal_code?: string | null }).internal_code ?? null,
              unitLabel: String((product as { unit_label?: string | null }).unit_label ?? "un"),
              stockQuantity: Number((product as { stock_quantity?: number | null }).stock_quantity ?? 0),
              costPrice: Number((product as { cost_price?: number | null }).cost_price ?? 0),
            }))}
          />
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
