import { getMerchantOwnerOrRedirect } from "@/lib/auth/guard";
import { getBusinessCategoryLabel } from "@/lib/merchant/helpers";

export default async function ModulePlaceholderPage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { merchant } = await getMerchantOwnerOrRedirect();
  const { module } = await params;

  const categoryLabel = getBusinessCategoryLabel(merchant.business_category);

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
            Módulo: {module}
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {categoryLabel
              ? `Tipo de negócio: ${categoryLabel}.`
              : "Selecione o tipo de negócio no painel."}
          </p>

          <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            Página placeholder (pronta pra evolução). Aqui vamos conectar as telas
            reais (itens, pedidos, reservas, etc.) no próximo passo.
          </div>
        </div>
      </main>
    </div>
  );
}
