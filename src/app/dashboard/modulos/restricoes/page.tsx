import Link from "next/link";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";

export default async function PharmacyRestrictionsPage() {
  const { user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const canManage = isOwner || Boolean(
    membership && hasMemberPermission(membership.role, membership.permissions, "dashboard_products"),
  );

  if (!canManage) {
    return <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Restrições de produtos</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Você não tem permissão para gerenciar o catálogo.</p>
    </main>;
  }

  const supabase = await createClient({}, { withAuth: true });
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, barcode, is_active, requires_prescription, requires_document")
    .eq("merchant_id", merchant.id)
    .order("name", { ascending: true })
    .limit(500);

  const restrictedProducts = (products ?? []).filter(
    (product) => product.requires_prescription || product.requires_document,
  );

  return <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
    <Link href="/dashboard" className="text-sm font-medium text-zinc-600 hover:underline dark:text-zinc-300">← Voltar ao painel</Link>
    <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Restrições de produtos</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-300">
          Marque nos detalhes do produto quando a venda exigir receita ou outro documento. Os itens configurados aparecem nesta lista.
        </p>
      </div>
      <Link href="/dashboard/modulos/produtos" className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900">
        Abrir cadastro de produtos
      </Link>
    </div>

    {error ? <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
      Não foi possível carregar os produtos. Atualize a página e tente novamente.
    </div> : <section className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Itens com exigência configurada ({restrictedProducts.length})</h2>
      </div>
      {restrictedProducts.length ? <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {restrictedProducts.map((product) => <li key={product.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="font-medium text-zinc-900 dark:text-zinc-50">{product.name}</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {[product.requires_prescription ? "Exige receita" : null, product.requires_document ? "Exige documento" : null, product.barcode ? `Código ${product.barcode}` : null, !product.is_active ? "Inativo" : null].filter(Boolean).join(" · ")}
            </p>
          </div>
          <Link href={`/dashboard/modulos/produtos/${product.id}`} className="text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-300">Editar exigências</Link>
        </li>)}
      </ul> : <div className="p-6 text-sm text-zinc-600 dark:text-zinc-300">
        Nenhum produto tem receita ou documento obrigatório configurado. Abra um produto no cadastro para definir essas exigências.
      </div>}
    </section>}
  </main>;
}
