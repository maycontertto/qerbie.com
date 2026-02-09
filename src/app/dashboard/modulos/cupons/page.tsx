export const dynamic = "force-dynamic";

import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";

export default async function CuponsPromocoesPage() {
  const { user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const canSales =
    isOwner ||
    (membership
      ? hasMemberPermission(membership.role, membership.permissions, "dashboard_sales")
      : false);

  if (!canSales) {
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
              Cupons
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Você não tem permissão para acessar este módulo.
            </p>
          </div>
        </main>
      </div>
    );
  }
  return (
    <main className="max-w-4xl mx-auto p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Cupons &amp; Promoções</h1>
        <p className="text-sm text-muted-foreground">
          Crie campanhas e descontos para aumentar vendas e fidelizar clientes.
        </p>
      </div>

      <div className="mt-6 rounded-lg border p-4">
        <div className="text-sm font-medium">Em breve</div>
        <p className="mt-1 text-sm text-muted-foreground">
          Assim que você me enviar as funções que deseja aqui, eu implemento.
        </p>
      </div>
    </main>
  );
}
