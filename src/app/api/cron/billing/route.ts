import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BILLING_PLAN } from "@/lib/billing/constants";

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

  for (const s of subs ?? []) {
    const trialEndsAt = new Date(s.trial_ends_at);
    const periodEnd = s.current_period_end ? new Date(s.current_period_end) : trialEndsAt;
    const graceUntil = s.grace_until ? new Date(s.grace_until) : addDays(periodEnd, BILLING_PLAN.graceDays);

    const shouldPastDue = now >= periodEnd;
    const shouldSuspend = now > graceUntil;

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

  return NextResponse.json({ ok: true, suspended, pastDue, checked: subs?.length ?? 0 });
}
