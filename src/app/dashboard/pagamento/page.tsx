import Link from "next/link";
import { getDashboardUserOrRedirect } from "@/lib/auth/guard";
import { BILLING_PLAN, formatBrlFromCents } from "@/lib/billing/constants";
import { createOrGetMonthlyInvoice, retryLatestPaymentSync, markLatestInvoiceAsPaidManually } from "@/lib/billing/actions";
import { syncMercadoPagoApprovedPayment } from "@/lib/billing/sync";

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function formatDatePtBr(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(date);
}

function formatDateTimePtBr(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

const INVOICE_STATUS_LABEL: Record<string, { label: string; className: string }> = {
  paid: {
    label: "Pago",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  },
  pending: {
    label: "Pendente",
    className:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  },
  expired: {
    label: "Expirado",
    className:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  },
  cancelled: {
    label: "Cancelado",
    className:
      "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  },
};

const SUBSCRIPTION_STATUS_LABEL: Record<string, { label: string; className: string }> = {
  trialing: {
    label: "Teste grátis",
    className:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  },
  active: {
    label: "Ativa",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  },
  past_due: {
    label: "Vencida",
    className:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  },
  suspended: {
    label: "Suspensa",
    className:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  },
  cancelled: {
    label: "Cancelada",
    className:
      "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  },
};

export default async function PagamentoPage({
  searchParams,
}: {
  searchParams: Promise<{
    pay?: string;
    mode?: string;
    error?: string;
    status?: string;
    payment_id?: string;
    collection_id?: string;
    recheck?: string;
  }>;
}) {
  const { supabase, user, merchant } = await getDashboardUserOrRedirect({ allowSuspended: true });
  const { pay, mode, error, status, payment_id, collection_id, recheck } = await searchParams;

  const callbackPaymentId = String(payment_id ?? collection_id ?? "").trim();
  const syncResult =
    status === "success" && callbackPaymentId
      ? await syncMercadoPagoApprovedPayment(callbackPaymentId)
      : null;

  const isOwner = user.id === merchant.owner_user_id;

  const { data: sub } = await supabase
    .from("merchant_subscriptions")
    .select("status,trial_ends_at,current_period_end,grace_until,plan_amount_cents")
    .eq("merchant_id", merchant.id)
    .maybeSingle();

  const amountCents = Number(sub?.plan_amount_cents ?? BILLING_PLAN.amountCents);

  const trialEndsAt = sub?.trial_ends_at
    ? new Date(sub.trial_ends_at)
    : addDays(new Date(merchant.created_at), BILLING_PLAN.trialDays);

  const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : trialEndsAt;
  const graceUntil = sub?.grace_until ? new Date(sub.grace_until) : addDays(periodEnd, BILLING_PLAN.graceDays);

  const now = new Date();
  const isTrial = (sub?.status ?? "trialing") === "trialing" && now < trialEndsAt;
  const isActive = sub?.status === "active" && now < periodEnd;
  const isPastDue = sub?.status === "past_due" || (sub?.status !== "active" && now >= periodEnd);

  const { data: invoices } = await supabase
    .from("billing_invoices")
    .select("id,amount_cents,currency,status,due_at,paid_at,provider,created_at,payment_url")
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false })
    .limit(12);

  const paidInvoices = (invoices ?? []).filter((inv) => inv.status === "paid");
  const totalPaidCents = paidInvoices.reduce((acc, inv) => acc + Number(inv.amount_cents ?? 0), 0);
  const lastPaidInvoice = paidInvoices[0] ?? null;

  const banner =
    error === "missing_billing_env"
      ? {
          kind: "error" as const,
          message:
            "Faltam variáveis de ambiente do billing (APP_URL / MERCADOPAGO_ACCESS_TOKEN). Configure e tente novamente.",
        }
      : error === "payment_provider_failed"
        ? { kind: "error" as const, message: "Não foi possível gerar o link de pagamento agora." }
        : error === "invoice_create_failed"
          ? { kind: "error" as const, message: "Não foi possível criar a cobrança agora." }
          : error === "no_pending_invoice"
            ? { kind: "error" as const, message: "Nenhuma cobrança pendente foi encontrada para confirmar manualmente." }
            : recheck === "applied"
              ? {
                  kind: "success" as const,
                  message: "Pagamento localizado e assinatura atualizada agora." }
              : recheck === "updated"
                ? {
                    kind: "success" as const,
                    message: "Assinatura reparada com base no último pagamento já registrado." }
                : recheck === "approved_payment_not_found"
                  ? {
                      kind: "error" as const,
                      message: "Ainda não foi encontrado pagamento aprovado para a última cobrança." }
                  : recheck === "manual_payment_link"
                    ? {
                        kind: "error" as const,
                        message: "Esse pagamento foi gerado por link manual e não dá para reconciliar automaticamente aqui." }
                    : recheck === "invoice_not_found"
                      ? {
                          kind: "error" as const,
                          message: "Nenhuma cobrança recente foi encontrada para reconciliação." }
                      : recheck === "missing_access_token"
                        ? {
                            kind: "error" as const,
                            message: "A integração do Mercado Pago não está configurada para revalidar pagamentos agora." }
                        : recheck === "no_external_reference"
                          ? {
                              kind: "error" as const,
                              message: "A última cobrança não tem identificador para reconsulta automática." }
                          : recheck === "invoice_paid_without_date"
                            ? {
                                kind: "error" as const,
                                message: "A cobrança está marcada como paga, mas sem data válida para reparar a assinatura." }
          : status === "success"
            ? {
                kind: "success" as const,
                message:
                  syncResult?.ok
                    ? "Pagamento aprovado e assinatura atualizada com sucesso."
                    : "Pagamento aprovado. Pode levar alguns segundos para liberar automaticamente.",
              }
            : status === "failure"
              ? { kind: "error" as const, message: "Pagamento não aprovado." }
              : searchParams.manual_payment === "success"
                ? {
                    kind: "success" as const,
                    message: "Pagamento confirmado manualmente e assinatura liberada com sucesso.",
                  }
              : null;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-zinc-200 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
          <div>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
            >
              ← Voltar ao painel
            </Link>
            <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Assinatura
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Plano mensal: {formatBrlFromCents(amountCents)} • 30 dias grátis no cadastro
            </p>
          </div>

          {banner && (
            <div
              className={`mt-6 rounded-lg border p-3 text-sm ${
                banner.kind === "error"
                  ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              }`}
            >
              {banner.message}
            </div>
          )}

          {mode === "fallback" ? (
            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
              Você está usando um link fixo do Mercado Pago. Ele funciona para o cliente escolher Pix/cartão/boleto,
              mas não libera automaticamente no sistema. Para liberar automático, configure
              <span className="font-semibold"> APP_URL</span> e
              <span className="font-semibold"> MERCADOPAGO_ACCESS_TOKEN</span>.
            </div>
          ) : null}

          {(() => {
            const statusKey = sub?.status ?? "trialing";
            const statusInfo = SUBSCRIPTION_STATUS_LABEL[statusKey] ?? SUBSCRIPTION_STATUS_LABEL.trialing;
            return (
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Status da assinatura</p>
                  <span
                    className={`mt-2 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusInfo.className}`}
                  >
                    {statusInfo.label}
                  </span>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {isTrial ? "Fim do teste grátis" : "Vencimento"}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    {formatDatePtBr(isTrial ? trialEndsAt : periodEnd)}
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Total pago até hoje</p>
                  <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    {formatBrlFromCents(totalPaidCents)}
                  </p>
                </div>
              </div>
            );
          })()}

          <div className="mt-3 space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between gap-3">
              <span className="text-zinc-600 dark:text-zinc-300">Carência</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-50">{isActive ? "não aplicável" : `até ${formatDatePtBr(graceUntil)}`}</span>
            </div>
            {lastPaidInvoice ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-600 dark:text-zinc-300">Último pagamento</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {lastPaidInvoice.paid_at ? formatDatePtBr(new Date(lastPaidInvoice.paid_at)) : "—"}
                </span>
              </div>
            ) : null}
            {isTrial ? (
              <p className="pt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Você está no teste grátis. O pagamento só é exigido após {formatDatePtBr(trialEndsAt)}.
              </p>
            ) : isActive ? (
              <p className="pt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Sua assinatura está em dia e já está liberada na plataforma.
              </p>
            ) : isPastDue ? (
              <p className="pt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Sua assinatura está vencida. Após a carência, o acesso funcional é bloqueado até a regularização.
              </p>
            ) : (
              <p className="pt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Sua assinatura está em dia.
              </p>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {pay ? (
              <a
                href={pay}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Acessar link para pagar
              </a>
            ) : null}

            {isOwner ? (
              <>
                <form action={createOrGetMonthlyInvoice}>
                  <button
                    type="submit"
                    className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Gerar link de pagamento
                  </button>
                </form>

                {!isActive ? (
                  <>
                    <form action={retryLatestPaymentSync}>
                      <button
                        type="submit"
                        className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900"
                      >
                        Já paguei, atualizar agora
                      </button>
                    </form>

                    <form action={markLatestInvoiceAsPaidManually}>
                      <button
                        type="submit"
                        className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
                      >
                        Confirmar pagamento manual
                      </button>
                    </form>
                  </>
                ) : null}
              </>
            ) : (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Apenas o proprietário pode gerar a cobrança.
              </span>
            )}
          </div>

          {!isActive ? (
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              Se o pagamento já foi feito antes desta correção, use <span className="font-semibold">Já paguei, atualizar agora</span>.
              <br />
              Se o pagamento foi recebido fora do sistema (PIX, transferência, etc) e não aparece automaticamente, use <span className="font-semibold">Confirmar pagamento manual</span>.
            </p>
          ) : null}

          <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
            Se você já tem um link fixo do Mercado Pago, ele pode ser usado como fallback em
            <span className="font-semibold"> NEXT_PUBLIC_BILLING_FALLBACK_PAYMENT_URL</span>.
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Histórico de pagamentos</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Últimas cobranças geradas para esta conta.
          </p>

          {invoices && invoices.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-140 border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    <th className="py-2 pr-4 font-medium">Criada em</th>
                    <th className="py-2 pr-4 font-medium">Valor</th>
                    <th className="py-2 pr-4 font-medium">Vencimento</th>
                    <th className="py-2 pr-4 font-medium">Pago em</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const statusInfo = INVOICE_STATUS_LABEL[inv.status] ?? INVOICE_STATUS_LABEL.pending;
                    return (
                      <tr
                        key={inv.id}
                        className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                      >
                        <td className="py-2.5 pr-4 text-zinc-700 dark:text-zinc-300">
                          {formatDateTimePtBr(new Date(inv.created_at))}
                        </td>
                        <td className="py-2.5 pr-4 font-semibold text-zinc-900 dark:text-zinc-50">
                          {formatBrlFromCents(Number(inv.amount_cents ?? 0))}
                        </td>
                        <td className="py-2.5 pr-4 text-zinc-700 dark:text-zinc-300">
                          {formatDatePtBr(new Date(inv.due_at))}
                        </td>
                        <td className="py-2.5 pr-4 text-zinc-700 dark:text-zinc-300">
                          {inv.paid_at ? formatDatePtBr(new Date(inv.paid_at)) : "—"}
                        </td>
                        <td className="py-2.5 pr-4">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusInfo.className}`}
                          >
                            {statusInfo.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
              Nenhuma cobrança gerada ainda. Use o botão "Gerar link de pagamento" acima para criar a primeira.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
