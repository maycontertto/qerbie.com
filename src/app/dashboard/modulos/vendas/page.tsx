export const dynamic = "force-dynamic";

import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { updateMerchantPaymentSettings } from "@/lib/merchant/paymentActions";
import Link from "next/link";

export default async function VendasFaturamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;
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
              Vendas
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Você não tem permissão para acessar este módulo.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const banner =
    error === "save_failed"
      ? { kind: "error" as const, message: "Não foi possível salvar agora. Tente novamente." }
      : saved === "1"
        ? { kind: "success" as const, message: "Salvo." }
        : null;

  const defaultDisclaimer =
    "A Qerbie não processa pagamentos. As opções abaixo são apenas instruções combinadas diretamente entre cliente e estabelecimento.";

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
        >
          ← Voltar ao painel
        </Link>

        <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Vendas &amp; Formas de Pagamento
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Você configura aqui como o cliente deve pagar (Pix, link, dinheiro). Não existe processamento de pagamento pela Qerbie.
        </p>

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

        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Formas de pagamento
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            O cliente verá essas opções ao finalizar o pedido e também em “Meus pedidos”.
          </p>

          <form action={updateMerchantPaymentSettings} className="mt-4 space-y-5">
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Pix</div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Se preencher a chave, a opção de Pix aparece pro cliente.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Chave Pix
                  </label>
                  <input
                    name="payment_pix_key"
                    defaultValue={merchant.payment_pix_key ?? ""}
                    placeholder="Ex: 11999999999 ou sua@chave.com"
                    className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Descrição
                  </label>
                  <input
                    name="payment_pix_description"
                    defaultValue={merchant.payment_pix_description ?? ""}
                    placeholder="Ex: Pix para Qerbie Bar LTDA"
                    className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Link (cartão/checkout)</div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Use um link que você já tenha (ex: seu checkout). A Qerbie não integra pagamentos.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Link
                  </label>
                  <input
                    name="payment_card_url"
                    defaultValue={merchant.payment_card_url ?? ""}
                    placeholder="Ex: https://..."
                    className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Descrição
                  </label>
                  <input
                    name="payment_card_description"
                    defaultValue={merchant.payment_card_description ?? ""}
                    placeholder="Ex: Pague no nosso link com cartão"
                    className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Dinheiro</div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Se preencher a descrição, a opção de dinheiro aparece pro cliente.
              </p>
              <div className="mt-3">
                <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Descrição
                </label>
                <input
                  name="payment_cash_description"
                  defaultValue={merchant.payment_cash_description ?? ""}
                  placeholder="Ex: Pagamento em dinheiro no balcão"
                  className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Aviso (regras de pagamento)
              </label>
              <textarea
                name="payment_disclaimer"
                defaultValue={merchant.payment_disclaimer ?? defaultDisclaimer}
                rows={3}
                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              />
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Esse texto aparece pro cliente. Deixe claro que o pagamento é combinado diretamente com o estabelecimento.
              </p>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Salvar
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
