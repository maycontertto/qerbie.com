export const dynamic = "force-dynamic";

import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import Link from "next/link";
import { CaixaClient } from "./CaixaClient";

export default async function CaixaPage() {
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
            <Link
              href="/dashboard"
              className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
            >
              ← Voltar ao painel
            </Link>
            <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Caixa</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Você não tem permissão para acessar este módulo.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
        >
          ← Voltar ao painel
        </Link>

        <div className="mt-4">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Caixa</h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Tela de balcão: use leitor de código de barras e finalize a venda.
          </p>
        </div>

        <div className="mt-8">
          <CaixaClient />
        </div>
      </main>
    </div>
  );
}
