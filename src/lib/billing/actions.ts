"use server";

import { redirect } from "next/navigation";
import { getDashboardUserOrRedirect } from "@/lib/auth/guard";
import { BILLING_PLAN } from "@/lib/billing/constants";
import { createMercadoPagoCheckoutPreference } from "@/lib/billing/mercadopago";
import { syncLatestMercadoPagoInvoiceForMerchant } from "@/lib/billing/sync";
import { isPlatformDemoUser } from "@/lib/billing/demo";
import { createAdminClient } from "@/lib/supabase/admin";

function randomId(): string {
  // Node/Next runtime
  return crypto.randomUUID();
}

function toIsoDateTime(value: string | Date): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function createOrGetMonthlyInvoice(): Promise<void> {
  const { supabase, user, merchant } = await getDashboardUserOrRedirect({ allowSuspended: true });
  const isOwner = user.id === merchant.owner_user_id;
  if (!isOwner) {
    redirect("/dashboard?error=not_owner");
  }

  const { data: sub } = await supabase
    .from("merchant_subscriptions")
    .select("merchant_id,status,trial_ends_at,current_period_end,grace_until,plan_amount_cents,currency")
    .eq("merchant_id", merchant.id)
    .maybeSingle();

  const amountCents = Number(sub?.plan_amount_cents ?? BILLING_PLAN.amountCents);

  const { data: existing } = await supabase
    .from("billing_invoices")
    .select("id,status,payment_url,external_reference,provider_preference_id,due_at")
    .eq("merchant_id", merchant.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const trialEndsAt = sub?.trial_ends_at ? new Date(sub.trial_ends_at) : addDays(new Date(merchant.created_at), BILLING_PLAN.trialDays);
  const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : trialEndsAt;

  const dueAt = periodEnd;

  const invoiceId = randomId();
  const externalReference = invoiceId;

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  const appUrl = process.env.APP_URL?.replace(/\/+$/, "");

  // Fallback: user-provided payment link (manual)
  const fallbackPaymentUrl =
    process.env.NEXT_PUBLIC_BILLING_FALLBACK_PAYMENT_URL ?? "https://mpago.la/2227ERU";

  const hasFallbackPaymentUrl = Boolean(fallbackPaymentUrl?.trim());

  if (existing?.payment_url) {
    const isProviderInvoice = Boolean(existing.provider_preference_id);
    const mode = isProviderInvoice ? "mercadopago" : "fallback";

    // Se for invoice de fallback e o link mudou, atualiza para evitar ficar preso em links antigos.
    if (!isProviderInvoice && hasFallbackPaymentUrl && existing.payment_url !== fallbackPaymentUrl) {
      const admin = createAdminClient();
      const { error: updErr } = await admin
        .from("billing_invoices")
        .update({ payment_url: fallbackPaymentUrl })
        .eq("id", existing.id)
        .eq("merchant_id", merchant.id);

      if (updErr) {
        console.error("createOrGetMonthlyInvoice: update fallback payment_url failed", updErr);
      }

      redirect(`/dashboard/pagamento?pay=${encodeURIComponent(fallbackPaymentUrl)}&mode=fallback`);
    }

    redirect(`/dashboard/pagamento?pay=${encodeURIComponent(existing.payment_url)}&mode=${mode}`);
  }

  if (!accessToken || !appUrl) {
    if (hasFallbackPaymentUrl) {
      const { error: invErr } = await supabase.from("billing_invoices").insert({
        id: invoiceId,
        merchant_id: merchant.id,
        amount_cents: amountCents,
        currency: "BRL",
        status: "pending",
        due_at: toIsoDateTime(dueAt),
        provider: "mercadopago",
        external_reference: externalReference,
        payment_url: fallbackPaymentUrl,
      });

      if (invErr) {
        console.error("create invoice failed", invErr);
        redirect("/dashboard/pagamento?error=invoice_create_failed");
      }
      redirect(`/dashboard/pagamento?pay=${encodeURIComponent(fallbackPaymentUrl)}&mode=fallback`);
    }

    redirect("/dashboard/pagamento?error=missing_billing_env");
  }

  try {
    const title = "Qerbie • Plano Mensal";
    const amount = amountCents / 100;

    const { preferenceId, paymentUrl } = await createMercadoPagoCheckoutPreference({
      accessToken,
      title,
      amount,
      externalReference,
      payerEmail: user.email,
      notificationUrl: `${appUrl}/api/webhooks/mercadopago`,
      successUrl: `${appUrl}/dashboard/pagamento?status=success`,
      failureUrl: `${appUrl}/dashboard/pagamento?status=failure`,
    });

    const { error: invErr } = await supabase.from("billing_invoices").insert({
      id: invoiceId,
      merchant_id: merchant.id,
      amount_cents: amountCents,
      currency: "BRL",
      status: "pending",
      due_at: toIsoDateTime(dueAt),
      provider: "mercadopago",
      external_reference: externalReference,
      provider_preference_id: preferenceId,
      payment_url: paymentUrl,
    });

    if (invErr) {
      console.error("create invoice failed", invErr);
      redirect("/dashboard/pagamento?error=invoice_create_failed");
    }

    redirect(`/dashboard/pagamento?pay=${encodeURIComponent(paymentUrl)}&mode=mercadopago`);
  } catch (e) {
    console.error("mercadopago preference error", e);

    if (hasFallbackPaymentUrl) {
      const { error: invErr } = await supabase.from("billing_invoices").insert({
        id: invoiceId,
        merchant_id: merchant.id,
        amount_cents: amountCents,
        currency: "BRL",
        status: "pending",
        due_at: toIsoDateTime(dueAt),
        provider: "mercadopago",
        external_reference: externalReference,
        payment_url: fallbackPaymentUrl,
      });

      if (invErr) {
        console.error("create invoice failed", invErr);
        redirect("/dashboard/pagamento?error=invoice_create_failed");
      }

      redirect(`/dashboard/pagamento?pay=${encodeURIComponent(fallbackPaymentUrl)}&mode=fallback`);
    }

    redirect("/dashboard/pagamento?error=payment_provider_failed");
  }
}

export async function retryLatestPaymentSync(): Promise<void> {
  const { user, merchant } = await getDashboardUserOrRedirect({ allowSuspended: true });
  const isOwner = user.id === merchant.owner_user_id;
  if (!isOwner) {
    redirect("/dashboard?error=not_owner");
  }

  const result = await syncLatestMercadoPagoInvoiceForMerchant(merchant.id);

  if (!result.ok) {
    redirect(`/dashboard/pagamento?recheck=${encodeURIComponent(result.reason)}`);
  }

  redirect(`/dashboard/pagamento?recheck=${result.applied ? "applied" : "updated"}`);
}

export async function markLatestInvoiceAsPaidManually(): Promise<void> {
  const { supabase, user, merchant } = await getDashboardUserOrRedirect({ allowSuspended: true });
  const isOwner = user.id === merchant.owner_user_id;
  if (!isOwner) {
    redirect("/dashboard?error=not_owner");
  }

  const { data: invoice } = await supabase
    .from("billing_invoices")
    .select("id,merchant_id,status")
    .eq("merchant_id", merchant.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!invoice) {
    redirect("/dashboard/pagamento?error=no_pending_invoice");
  }

  const admin = createAdminClient();
  const now = new Date();
  await admin
    .from("billing_invoices")
    .update({ status: "paid", paid_at: now.toISOString() })
    .eq("id", invoice.id);

  const { data: sub } = await admin
    .from("merchant_subscriptions")
    .select("trial_ends_at,current_period_end")
    .eq("merchant_id", merchant.id)
    .maybeSingle();

  const trialEndsAt = sub?.trial_ends_at ? new Date(sub.trial_ends_at) : now;
  const currentPeriodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null;
  const baseStart = currentPeriodEnd && currentPeriodEnd > now ? currentPeriodEnd : now;
  const periodStart = now > trialEndsAt ? now : baseStart;
  const periodEnd = addDays(periodStart, 30);

  await admin
    .from("merchant_subscriptions")
    .update({
      status: "active",
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      grace_until: null,
      last_payment_at: now.toISOString(),
      last_notice_stage: null,
      last_notice_at: null,
    })
    .eq("merchant_id", merchant.id);

  redirect("/dashboard/pagamento?manual_payment=success");
}

/**
 * Libera acesso gratuito por 100 anos, restrito a e-mails definidos em PLATFORM_DEMO_EMAILS.
 * Usado apenas para contas de demonstração do próprio dono da plataforma.
 */
export async function grantLifetimeDemoAccess(): Promise<void> {
  const { user, merchant } = await getDashboardUserOrRedirect({ allowSuspended: true });

  if (user.id !== merchant.owner_user_id || !isPlatformDemoUser(user.email)) {
    redirect("/dashboard/pagamento?error=demo_access_denied");
  }

  const admin = createAdminClient();
  const now = new Date();
  const farFuture = new Date(now.getFullYear() + 100, now.getMonth(), now.getDate());

  await admin
    .from("merchant_subscriptions")
    .update({
      status: "active",
      current_period_start: now.toISOString(),
      current_period_end: farFuture.toISOString(),
      grace_until: null,
      last_payment_at: now.toISOString(),
      last_notice_stage: null,
      last_notice_at: null,
    })
    .eq("merchant_id", merchant.id);

  redirect("/dashboard/pagamento?manual_payment=success");
}
