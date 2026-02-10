import Link from "next/link";
import { getDashboardUserOrRedirect } from "@/lib/auth/guard";
import { BILLING_PLAN, formatBrlFromCents } from "@/lib/billing/constants";
import { createOrGetMonthlyInvoice } from "@/lib/billing/actions";

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function formatDatePtBr(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(date);
}

export default async function PagamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ pay?: string; mode?: string; error?: string; status?: string }>;
}) {
  const { supabase, user, merchant } = await getDashboardUserOrRedirect({ allowSuspended: true });
  const { pay, mode, error, status } = await searchParams;

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
  const isTrial = now < trialEndsAt;
  const isPastDue = now >= periodEnd;

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
          : status === "success"
            ? {
                kind: "success" as const,
                message: "Pagamento aprovado. Pode levar alguns segundos para liberar automaticamente.",
              }
            : status === "failure"
              ? { kind: "error" as const, message: "Pagamento não aprovado." }
              : null;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
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

          <div className="mt-6 space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between gap-3">
              <span className="text-zinc-600 dark:text-zinc-300">Status</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-50">{sub?.status ?? "trialing"}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-zinc-600 dark:text-zinc-300">Fim do teste grátis</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-50">{formatDatePtBr(trialEndsAt)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-zinc-600 dark:text-zinc-300">Vencimento</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-50">{formatDatePtBr(periodEnd)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-zinc-600 dark:text-zinc-300">Carência</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-50">até {formatDatePtBr(graceUntil)}</span>
            </div>
            {isTrial ? (
              <p className="pt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Você está no teste grátis. O pagamento só é exigido após {formatDatePtBr(trialEndsAt)}.
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
              <form action={createOrGetMonthlyInvoice}>
                <button
                  type="submit"
                  className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  Gerar link de pagamento
                </button>
              </form>
            ) : (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Apenas o proprietário pode gerar a cobrança.
              </span>
            )}
          </div>

          <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
            Se você já tem um link fixo do Mercado Pago, ele pode ser usado como fallback em
            <span className="font-semibold"> NEXT_PUBLIC_BILLING_FALLBACK_PAYMENT_URL</span>.
          </p>
        </div>
      </main>
    </div>
  );
}
