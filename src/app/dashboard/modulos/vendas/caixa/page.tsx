export const dynamic = "force-dynamic";

import { getSalesUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import Link from "next/link";
import { CaixaClient } from "./CaixaClient";

export default async function CaixaPage() {
  const { user, merchant, membership } = await getSalesUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const canManage = isOwner || Boolean(membership && hasMemberPermission(membership.role, membership.permissions, "manage_attendants"));
  return (
    <div className="min-h-screen">
      <main className="w-full py-6">
        <Link href={isOwner ? "/dashboard" : "/atendente"} className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50">← Voltar</Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Caixa</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Tela de balcão: use o leitor de código de barras e finalize a venda.</p>
          </div>
          {canManage ? <Link href="/dashboard/modulos/vendas/caixas" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">Caixas e computadores</Link> : null}
        </div>
        <div className="mt-6"><CaixaClient merchantId={merchant.id} merchantName={merchant.name} operatorName={user.email ?? "Operador"} initialRegisterId={membership?.cash_register_device_id ?? null} /></div>
      </main>
    </div>
  );
}
