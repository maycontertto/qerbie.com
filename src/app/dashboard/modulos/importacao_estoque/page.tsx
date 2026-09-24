import Link from "next/link";
import { redirect } from "next/navigation";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_MENU_NAME, DEFAULT_MENU_SLUG } from "@/lib/catalog/templates";
import { ImportStockForm } from "./ImportStockForm";

export const dynamic = "force-dynamic";

function makeSlug(base: string): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}

export default async function ImportacaoEstoquePage({
  searchParams,
}: {
  searchParams: Promise<{
    imported?: string;
    import_created?: string;
    import_updated?: string;
    import_skipped?: string;
    error?: string;
  }>;
}) {
  const { user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const canProducts = isOwner || Boolean(
    membership && hasMemberPermission(membership.role, membership.permissions, "dashboard_products"),
  );
  if (!canProducts) redirect("/dashboard");

  const supabase = await createClient({}, { withAuth: true });
  let { data: menu } = await supabase
    .from("menus")
    .select("id, slug")
    .eq("merchant_id", merchant.id)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!menu && isOwner) {
    const { data } = await supabase.from("menus").insert({
      merchant_id: merchant.id,
      name: DEFAULT_MENU_NAME,
      description: null,
      slug: DEFAULT_MENU_SLUG,
      is_active: true,
      display_order: 0,
    }).select("id, slug").maybeSingle();
    menu = data;
    if (!menu) {
      const { data: retry } = await supabase.from("menus").insert({
        merchant_id: merchant.id,
        name: DEFAULT_MENU_NAME,
        description: null,
        slug: makeSlug(DEFAULT_MENU_SLUG),
        is_active: true,
        display_order: 0,
      }).select("id, slug").maybeSingle();
      menu = retry;
    }
  }

  if (!menu) redirect("/dashboard/modulos/produtos");

  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase.from("menu_categories").select("id, name").eq("merchant_id", merchant.id).eq("menu_id", menu.id).order("display_order", { ascending: true }),
    supabase.from("products").select("name, barcode, internal_code").eq("merchant_id", merchant.id).eq("menu_id", menu.id),
  ]);

  const { imported, import_created, import_updated, import_skipped, error } = await searchParams;
  const result = imported
    ? `Importação concluída: ${Number(import_created ?? 0)} produto(s) criado(s), ${Number(import_updated ?? 0)} atualizado(s) e ${Number(import_skipped ?? 0)} ignorado(s).`
    : null;
  const errorMessage = error === "invalid_import_file"
    ? "Não foi possível ler a planilha. Use o modelo padrão e confirme que há produtos com nome válido."
    : error === "import_requires_owner"
      ? "A importação de estoque só pode ser confirmada pelo proprietário da loja."
      : null;

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/dashboard" className="text-sm font-medium text-zinc-600 hover:underline dark:text-zinc-300">← Voltar ao painel</Link>
            <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Importação de estoque</h1>
            <p className="mt-1 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">Migre o cadastro de produtos e o saldo inicial de outra planilha ou sistema para o Qerbie.</p>
          </div>
          <Link href="/dashboard/modulos/produtos" className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900">Abrir cadastro de produtos</Link>
        </div>

        {result ? <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100" role="status">{result}</div> : null}
        {errorMessage ? <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200" role="alert">{errorMessage}</div> : null}

        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Preparar uma importação</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Baixe o modelo ou use uma planilha existente. Confira a prévia e escolha como tratar os produtos que já estão no catálogo.</p>
          </div>

          <div className="mb-6 flex flex-wrap gap-3">
            <a href="/api/dashboard/catalog/import-template?format=xlsx" className="inline-flex items-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200">Baixar modelo Excel</a>
            <a href="/api/dashboard/catalog/import-template?format=csv" className="inline-flex items-center rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800">Baixar modelo CSV</a>
          </div>

          {isOwner ? (
            <ImportStockForm
              menuId={menu.id}
              returnTo="/dashboard/modulos/importacao_estoque"
              defaultCategoryId={categories?.[0]?.id ?? ""}
              existingProducts={(products ?? []).map((product) => ({
                name: product.name,
                barcode: product.barcode,
                internalCode: product.internal_code,
              }))}
            />
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Somente o proprietário da loja pode importar ou alterar o estoque em quantidade.</div>
          )}
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Colunas que você pode importar</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">Nome, código de barras, código interno, categoria, unidade, preço de venda, custo, quantidade, descrição e classificação fiscal opcional.</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900 dark:bg-blue-950/30">
            <h3 className="font-semibold text-blue-950 dark:text-blue-100">Sobre os campos fiscais</h3>
            <p className="mt-2 text-sm leading-6 text-blue-900 dark:text-blue-200">NCM, CEST, CFOP, origem, CST/CSOSN e alíquotas são opcionais. Os valores dependem do produto e da operação; valide com a contabilidade antes de usar.</p>
          </div>
        </section>

        <p className="mt-6 text-xs leading-5 text-zinc-500 dark:text-zinc-400">Esta importação não lê XML nem registra notas fiscais. O fluxo de entrada de notas será organizado separadamente.</p>
      </div>
    </main>
  );
}
