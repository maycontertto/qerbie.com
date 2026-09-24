export const dynamic = "force-dynamic";

import Link from "next/link";
import { getSalesUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { CaixasClient } from "./CaixasClient";

export default async function CaixasPage() {
  const { user, merchant, membership } = await getSalesUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const canManage = isOwner || Boolean(membership && hasMemberPermission(membership.role, membership.permissions, "manage_attendants"));
  const canSales = isOwner || Boolean(membership && hasMemberPermission(membership.role, membership.permissions, "dashboard_sales"));
  if (!canSales || !canManage) {
    return <main className="mx-auto max-w-3xl px-4 py-10"><Link href="/dashboard/modulos/vendas/caixa" className="text-sm underline">← Voltar ao caixa</Link><div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">Somente o proprietário ou um gerente autorizado pode cadastrar computadores e consultar a movimentação consolidada.</div></main>;
  }
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link href="/dashboard/modulos/vendas/caixa" className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50">← Voltar ao caixa</Link>
      <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Caixas e computadores</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">Cadastre os pontos de venda, vincule cada funcionário e acompanhe as vendas por caixa ou no total da loja.</p>
      <CaixasClient />
    </main>
  );
}
