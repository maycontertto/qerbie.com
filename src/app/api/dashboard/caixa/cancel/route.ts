import { NextResponse } from "next/server";
import { getDashboardContextForApi } from "../_helpers";

export async function POST(req: Request) {
  const ctx = await getDashboardContextForApi();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!ctx.canSales) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { orderId?: unknown; reason?: unknown };
  try {
    body = (await req.json()) as { orderId?: unknown; reason?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const orderId = String(body.orderId ?? "").trim();
  const reason = String(body.reason ?? "").trim().slice(0, 300);
  if (!orderId || reason.length < 3) {
    return NextResponse.json({ error: "reason_required" }, { status: 400 });
  }

  const { data: order } = await ctx.supabase
    .from("orders")
    .select("id,status")
    .eq("id", orderId)
    .eq("merchant_id", ctx.merchant.id)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (order.status === "cancelled") return NextResponse.json({ error: "already_cancelled" }, { status: 409 });

  const { error } = await ctx.supabase
    .from("orders")
    .update({ status: "cancelled", cancellation_reason: reason, cancelled_at: new Date().toISOString() })
    .eq("id", order.id)
    .eq("merchant_id", ctx.merchant.id);
  if (error) return NextResponse.json({ error: "cancel_failed", detail: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}