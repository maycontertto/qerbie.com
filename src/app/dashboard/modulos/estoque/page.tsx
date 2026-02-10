import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { saveProductStock } from "@/lib/merchant/stockActions";
import Link from "next/link";

export default async function EstoqueModulePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;
  const { user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const canProducts = isOwner;

  if (!canProducts) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <a
              href="/dashboard"
              className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
            >
              ← Voltar ao painel
            </a>
            <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Estoque
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Apenas o dono do negócio pode acessar este módulo.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select("id, name, is_active, track_stock, stock_quantity, updated_at")
    .eq("merchant_id", merchant.id)
    .eq("track_stock", true)
    .order("is_active", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(200);

  const banner =
    saved === "1"
      ? { kind: "success" as const, message: "Estoque salvo." }
      : error === "invalid_product"
        ? { kind: "error" as const, message: "Produto inválido." }
        : error === "save_failed"
          ? { kind: "error" as const, message: "Não foi possível salvar agora. Tente novamente." }
          : null;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <a
              href="/dashboard"
              className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
            >
              ← Voltar ao painel
            </a>
            <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Estoque
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Defina se o item controla estoque e a quantidade disponível.
            </p>
          </div>

          <Link
            href="/dashboard/modulos/produtos"
            className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
          >
            Ir para Produtos
          </Link>
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

        <div className="mt-8 space-y-3">
          {products?.length ? (
            products.map((p) => {
              const active = Boolean(p.is_active);
              const track = Boolean((p as { track_stock?: boolean }).track_stock);
              const qty = Number((p as { stock_quantity?: number }).stock_quantity ?? 0);

              return (
                <div
                  key={p.id}
                  className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                          {p.name}
                        </h2>
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium ${
                            active
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                              : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                          }`}
                        >
                          {active ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        Quantidade: <span className="font-semibold">{track ? qty : "—"}</span>
                      </p>
                    </div>
                  </div>

                  <form action={saveProductStock} className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px_140px]">
                    <input type="hidden" name="product_id" value={p.id} />

                    <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                      <div>
                        <p className="font-semibold text-zinc-900 dark:text-zinc-50">Controlar estoque</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">Se desativado, o item fica sem quantidade.</p>
                      </div>
                      <input
                        type="checkbox"
                        name="track_stock"
                        defaultChecked={track}
                        className="h-5 w-5 rounded border-zinc-300 dark:border-zinc-700"
                      />
                    </label>

                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                      <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Quantidade
                      </label>
                      <input
                        name="stock_quantity"
                        inputMode="numeric"
                        defaultValue={String(qty)}
                        disabled={!track}
                        className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                      />
                    </div>

                    <button
                      type="submit"
                      className="h-fit rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    >
                      Salvar
                    </button>
                  </form>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              Nenhum item com controle de estoque.
              Ative em <Link className="underline" href="/dashboard/modulos/produtos">Produtos</Link> marcando “Controlar estoque”.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
