import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchMercadoPagoPayment,
  searchApprovedMercadoPagoPaymentByExternalReference,
} from "@/lib/billing/mercadopago";

type SyncPaymentResult =
  | { ok: true; applied: boolean; merchantId?: string }
  | { ok: false; reason: string };

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

async function activateSubscriptionFromApprovedAt(input: {
  admin: ReturnType<typeof createAdminClient>;
  merchantId: string;
  approvedAt: Date;
}) {
  const { data: existingSub } = await input.admin
    .from("merchant_subscriptions")
    .select("trial_ends_at,current_period_end")
    .eq("merchant_id", input.merchantId)
    .maybeSingle();

  const trialEndsAt = existingSub?.trial_ends_at ? new Date(existingSub.trial_ends_at) : input.approvedAt;
  const currentPeriodEnd = existingSub?.current_period_end ? new Date(existingSub.current_period_end) : null;
  const baseStart = currentPeriodEnd && currentPeriodEnd > input.approvedAt ? currentPeriodEnd : input.approvedAt;
  const periodStart = input.approvedAt > trialEndsAt ? input.approvedAt : baseStart;
  const periodEnd = addDays(periodStart, 30);

  await input.admin
    .from("merchant_subscriptions")
    .update({
      status: "active",
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      grace_until: null,
      last_payment_at: input.approvedAt.toISOString(),
      last_notice_stage: null,
      last_notice_at: null,
    })
    .eq("merchant_id", input.merchantId);
}

export async function syncMercadoPagoApprovedPayment(paymentId: string): Promise<SyncPaymentResult> {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    return { ok: false, reason: "missing_access_token" };
  }

  const payment = await fetchMercadoPagoPayment({ accessToken, paymentId });
  if (payment.status !== "approved") {
    return { ok: false, reason: `payment_${payment.status}` };
  }

  const externalReference = (payment.external_reference ?? "").trim();
  if (!externalReference) {
    return { ok: false, reason: "no_external_reference" };
  }

  const admin = createAdminClient();
  const { data: invoice } = await admin
    .from("billing_invoices")
    .select("id, merchant_id, status, due_at, amount_cents")
    .eq("external_reference", externalReference)
    .maybeSingle();

  if (!invoice) {
    return { ok: false, reason: "invoice_not_found" };
  }

  if (invoice.status === "paid") {
    return { ok: true, applied: false, merchantId: invoice.merchant_id };
  }

  const approvedAt = payment.date_approved ? new Date(payment.date_approved) : new Date();

  await admin
    .from("billing_invoices")
    .update({ status: "paid", paid_at: approvedAt.toISOString() })
    .eq("id", invoice.id);

  await activateSubscriptionFromApprovedAt({
    admin,
    merchantId: invoice.merchant_id,
    approvedAt,
  });

  return { ok: true, applied: true, merchantId: invoice.merchant_id };
}

export async function syncLatestMercadoPagoInvoiceForMerchant(
  merchantId: string,
): Promise<SyncPaymentResult> {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    return { ok: false, reason: "missing_access_token" };
  }

  const admin = createAdminClient();
  const { data: invoice } = await admin
    .from("billing_invoices")
    .select("id,merchant_id,status,external_reference,provider_preference_id,paid_at")
    .eq("merchant_id", merchantId)
    .eq("provider", "mercadopago")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!invoice) {
    return { ok: false, reason: "invoice_not_found" };
  }

  if (invoice.status === "paid") {
    if (!invoice.paid_at) {
      return { ok: false, reason: "invoice_paid_without_date" };
    }

    await activateSubscriptionFromApprovedAt({
      admin,
      merchantId: invoice.merchant_id,
      approvedAt: new Date(invoice.paid_at),
    });

    return { ok: true, applied: false, merchantId: invoice.merchant_id };
  }

  if (!invoice.provider_preference_id) {
    return { ok: false, reason: "manual_payment_link" };
  }

  const externalReference = String(invoice.external_reference ?? "").trim();
  if (!externalReference) {
    return { ok: false, reason: "no_external_reference" };
  }

  const payment = await searchApprovedMercadoPagoPaymentByExternalReference({
    accessToken,
    externalReference,
  });

  if (!payment) {
    return { ok: false, reason: "approved_payment_not_found" };
  }

  return syncMercadoPagoApprovedPayment(String(payment.id));
}
