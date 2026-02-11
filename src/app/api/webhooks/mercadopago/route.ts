import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchMercadoPagoPayment } from "@/lib/billing/mercadopago";
import { BILLING_PLAN } from "@/lib/billing/constants";

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function POST(request: Request) {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({ ok: false, error: "missing_access_token" }, { status: 500 });
  }

  // Mercado Pago can send GET/POST with query params; we parse both body and URL.
  const url = new URL(request.url);

  let paymentId: string | null = null;

  // Common query: ?type=payment&data.id=123
  paymentId = url.searchParams.get("data.id") || url.searchParams.get("id");

  // Try body JSON
  if (!paymentId) {
    try {
      const bodyUnknown: unknown = await request.json().catch(() => null);
      const body = bodyUnknown as null | { data?: { id?: unknown }; id?: unknown };
      paymentId = body?.data?.id ? String(body.data.id) : body?.id ? String(body.id) : null;
    } catch {
      // ignore
    }
  }

  if (!paymentId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const payment = await fetchMercadoPagoPayment({ accessToken, paymentId });

  if (payment.status !== "approved") {
    return NextResponse.json({ ok: true, status: payment.status });
  }

  const externalReference = (payment.external_reference ?? "").trim();
  if (!externalReference) {
    return NextResponse.json({ ok: true, ignored: true, reason: "no_external_reference" });
  }

  // Optional: basic amount sanity check (don't hard-fail to avoid edge cases)
  const paidAmount = Number(payment.transaction_amount ?? 0);
  const expectedAmount = BILLING_PLAN.amountCents / 100;
  if (paidAmount > 0 && Math.abs(paidAmount - expectedAmount) > 0.01) {
    console.warn("mercadopago amount mismatch", { paidAmount, expectedAmount, paymentId });
  }

  const admin = createAdminClient();

  const { data: invoice } = await admin
    .from("billing_invoices")
    .select("id, merchant_id, status")
    .eq("external_reference", externalReference)
    .maybeSingle();

  if (!invoice) {
    return NextResponse.json({ ok: true, ignored: true, reason: "invoice_not_found" });
  }

  if (invoice.status === "paid") {
    return NextResponse.json({ ok: true, already: true });
  }

  const approvedAt = payment.date_approved ? new Date(payment.date_approved) : new Date();
  const periodEnd = addDays(approvedAt, 30);

  await admin
    .from("billing_invoices")
    .update({ status: "paid", paid_at: approvedAt.toISOString() })
    .eq("id", invoice.id);

  await admin
    .from("merchant_subscriptions")
    .update({
      status: "active",
      current_period_start: approvedAt.toISOString(),
      current_period_end: periodEnd.toISOString(),
      grace_until: null,
      last_payment_at: approvedAt.toISOString(),
    })
    .eq("merchant_id", invoice.merchant_id);

  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  // Some Mercado Pago configurations send GET notifications.
  return POST(request);
}
