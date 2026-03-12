import { createAdminClient } from "@/lib/supabase/admin";
import { fetchMercadoPagoPayment } from "@/lib/billing/mercadopago";

type SyncPaymentResult =
  | { ok: true; applied: boolean; merchantId?: string }
  | { ok: false; reason: string };

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
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

  const { data: existingSub } = await admin
    .from("merchant_subscriptions")
    .select("trial_ends_at,current_period_end")
    .eq("merchant_id", invoice.merchant_id)
    .maybeSingle();

  const trialEndsAt = existingSub?.trial_ends_at ? new Date(existingSub.trial_ends_at) : approvedAt;
  const currentPeriodEnd = existingSub?.current_period_end ? new Date(existingSub.current_period_end) : null;
  const baseStart = currentPeriodEnd && currentPeriodEnd > approvedAt ? currentPeriodEnd : approvedAt;
  const periodStart = approvedAt > trialEndsAt ? approvedAt : baseStart;
  const periodEnd = addDays(periodStart, 30);

  await admin
    .from("billing_invoices")
    .update({ status: "paid", paid_at: approvedAt.toISOString() })
    .eq("id", invoice.id);

  await admin
    .from("merchant_subscriptions")
    .update({
      status: "active",
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      grace_until: null,
      last_payment_at: approvedAt.toISOString(),
      last_notice_stage: null,
      last_notice_at: null,
    })
    .eq("merchant_id", invoice.merchant_id);

  return { ok: true, applied: true, merchantId: invoice.merchant_id };
}
