import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BILLING_PLAN } from "@/lib/billing/constants";
import { sendEmailWithResend } from "@/lib/email/resend";

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  const secretFromQuery = url.searchParams.get("secret") ?? "";
  const ok = Boolean(secret) && (auth === `Bearer ${secret}` || secretFromQuery === secret);

  if (!ok) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();

  // Fetch subscriptions and merchants email
  const { data: subs, error } = await admin
    .from("merchant_subscriptions")
    .select("merchant_id,status,trial_ends_at,current_period_end,grace_until,plan_amount_cents")
    .in("status", ["trialing", "active", "past_due", "suspended"]);

  if (error) {
    console.error("cron billing fetch failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  let suspended = 0;
  let pastDue = 0;
  let emailed = 0;

  const maybeSendNotice = async (merchantId: string, stage: string, subject: string, text: string) => {
    const { data: current } = await admin
      .from("merchant_subscriptions")
      .select("last_notice_stage,last_notice_at")
      .eq("merchant_id", merchantId)
      .maybeSingle();

    const lastStage = current?.last_notice_stage ?? null;
    const lastAt = current?.last_notice_at ? new Date(current.last_notice_at) : null;

    if (lastStage === stage && lastAt && now.getTime() - lastAt.getTime() < 20 * 60 * 60 * 1000) {
      return;
    }

    const { data: merchant } = await admin
      .from("merchants")
      .select("id,name,owner_user_id")
      .eq("id", merchantId)
      .maybeSingle();

    if (!merchant?.owner_user_id) return;

    const { data: owner } = await admin.auth.admin.getUserById(merchant.owner_user_id);
    const email = owner?.user?.email ?? null;
    if (!email) return;

    const out = await sendEmailWithResend({ to: email, subject, text });
    if (out.ok) {
      emailed++;
      await admin
        .from("merchant_subscriptions")
        .update({ last_notice_stage: stage, last_notice_at: nowIso })
        .eq("merchant_id", merchantId);
    }
  };

  for (const s of subs ?? []) {
    const trialEndsAt = new Date(s.trial_ends_at);
    const periodEnd = s.current_period_end ? new Date(s.current_period_end) : trialEndsAt;
    const graceUntil = s.grace_until ? new Date(s.grace_until) : addDays(periodEnd, BILLING_PLAN.graceDays);

    const shouldPastDue = now >= periodEnd;
    const shouldSuspend = now > graceUntil;

    // Notices (optional): 3 days before, 1 day before, and on due day.
    const msDay = 24 * 60 * 60 * 1000;
    const daysToPeriodEnd = Math.ceil((periodEnd.getTime() - now.getTime()) / msDay);

    if (daysToPeriodEnd === 3) {
      await maybeSendNotice(
        s.merchant_id,
        "due_in_3",
        "Qerbie: vencimento em 3 dias",
        "Sua assinatura do Qerbie vence em 3 dias. Acesse o painel e clique em Pagamento para gerar o Pix.",
      );
    }

    if (daysToPeriodEnd === 1) {
      await maybeSendNotice(
        s.merchant_id,
        "due_in_1",
        "Qerbie: vencimento amanhã",
        "Sua assinatura do Qerbie vence amanhã. Acesse o painel e clique em Pagamento para gerar o Pix.",
      );
    }

    if (daysToPeriodEnd === 0) {
      await maybeSendNotice(
        s.merchant_id,
        "due_today",
        "Qerbie: assinatura vence hoje",
        "Sua assinatura do Qerbie vence hoje. Acesse o painel e clique em Pagamento para gerar o Pix.",
      );
    }

    if (shouldSuspend && s.status !== "suspended") {
      await admin
        .from("merchant_subscriptions")
        .update({ status: "suspended", grace_until: graceUntil.toISOString() })
        .eq("merchant_id", s.merchant_id);
      suspended++;
      continue;
    }

    if (shouldPastDue && s.status === "active") {
      await admin
        .from("merchant_subscriptions")
        .update({ status: "past_due", grace_until: graceUntil.toISOString() })
        .eq("merchant_id", s.merchant_id);
      pastDue++;
    }

    if (!shouldPastDue && s.status === "past_due") {
      // If paid, webhook should set active. We don't auto-revert here.
    }
  }

  return NextResponse.json({ ok: true, suspended, pastDue, emailed, checked: subs?.length ?? 0 });
}
