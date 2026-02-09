import { getMerchantMemberOrRedirect } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TirarPedidoPage() {
  const { merchant } = await getMerchantMemberOrRedirect();
  const supabase = await createClient();

  const { data: tables } = await supabase
    .from("merchant_tables")
    .select("id, label, qr_token, is_active")
    .eq("merchant_id", merchant.id)
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div>
          <a
            href="/atendente"
            className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
          >
            ← Voltar
          </a>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Tirar pedido
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Escolha a mesa para abrir o cardápio.
          </p>
        </div>

        <div className="mt-6 space-y-3">
          {(tables ?? []).length === 0 && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              Nenhuma mesa ativa cadastrada.
            </div>
          )}

          {(tables ?? []).map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div>
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {t.label}
                </div>
                <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Token: <span className="font-mono">{t.qr_token}</span>
                </div>
              </div>

              <a
                href={`/t/${encodeURIComponent(t.qr_token)}`}
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Abrir cardápio
              </a>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
