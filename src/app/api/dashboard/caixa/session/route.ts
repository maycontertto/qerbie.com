import { NextResponse } from "next/server";
import { getDashboardContextForApi } from "../_helpers";

function money(value: unknown): number | null {
  const parsed = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1_000_000) return null;
  return Math.round(parsed * 100) / 100;
}

async function getSessionSummary(ctx: NonNullable<Awaited<ReturnType<typeof getDashboardContextForApi>>>) {
  const { data: session, error: sessionError } = await ctx.supabase
    .from("cash_register_sessions")
    .select("id,opened_at,opening_amount,opening_notes,status")
    .eq("merchant_id", ctx.merchant.id)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sessionError) throw sessionError;

  if (!session) return { session: null };

  const [{ data: movements }, { data: cashOrders }, { count: orderCount }] = await Promise.all([
    ctx.supabase
      .from("cash_register_movements")
      .select("id,movement_type,amount,reason,receipt_path,created_at")
      .eq("session_id", session.id)
      .order("created_at", { ascending: false })
      .limit(12),
    ctx.supabase
      .from("orders")
      .select("total")
      .eq("cash_session_id", session.id)
      .eq("payment_method", "cash")
      .neq("status", "cancelled"),
    ctx.supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("cash_session_id", session.id)
      .neq("status", "cancelled"),
  ]);

  const cashSales = (cashOrders ?? []).reduce((sum, order) => sum + Number(order.total ?? 0), 0);
  const withdrawals = (movements ?? [])
    .filter((movement) => movement.movement_type === "withdrawal")
    .reduce((sum, movement) => sum + Number(movement.amount ?? 0), 0);
  const deposits = (movements ?? [])
    .filter((movement) => movement.movement_type === "deposit")
    .reduce((sum, movement) => sum + Number(movement.amount ?? 0), 0);
  const expectedAmount = Number(session.opening_amount ?? 0) + cashSales + deposits - withdrawals;

  const signedMovements = await Promise.all(
    (movements ?? []).map(async (movement) => {
      if (!movement.receipt_path) return { ...movement, receiptUrl: null };
      const { data } = await ctx.supabase.storage
        .from("cash-receipts")
        .createSignedUrl(movement.receipt_path, 3600);
      return { ...movement, receiptUrl: data?.signedUrl ?? null };
    }),
  );

  return {
    session: {
      id: session.id,
      openedAt: session.opened_at,
      openingAmount: Number(session.opening_amount ?? 0),
      openingNotes: session.opening_notes,
      cashSales,
      withdrawals,
      deposits,
      expectedAmount: Math.round(expectedAmount * 100) / 100,
      orderCount: orderCount ?? 0,
      movements: signedMovements.map((movement) => ({
        id: movement.id,
        type: movement.movement_type,
        amount: Number(movement.amount ?? 0),
        reason: movement.reason,
        createdAt: movement.created_at,
        receiptUrl: movement.receiptUrl,
      })),
    },
  };
}

export async function GET() {
  const ctx = await getDashboardContextForApi();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!ctx.canSales) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    return NextResponse.json({ ok: true, ...(await getSessionSummary(ctx)) });
  } catch {
    return NextResponse.json({ error: "cash_register_unavailable" }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const ctx = await getDashboardContextForApi();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!ctx.canSales) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const form = await req.formData();
  const action = String(form.get("action") ?? "");

  if (action === "open") {
    const openingAmount = money(form.get("amount"));
    const notes = String(form.get("notes") ?? "").trim().slice(0, 300) || null;
    if (openingAmount === null) return NextResponse.json({ error: "invalid_amount" }, { status: 400 });

    const { error } = await ctx.supabase.from("cash_register_sessions").insert({
      merchant_id: ctx.merchant.id,
      opened_by_user_id: ctx.user.id,
      opening_amount: openingAmount,
      opening_notes: notes,
    });
    if (error) return NextResponse.json({ error: "open_failed", detail: error.message }, { status: 409 });
  } else {
    const { data: session } = await ctx.supabase
      .from("cash_register_sessions")
      .select("id")
      .eq("merchant_id", ctx.merchant.id)
      .eq("status", "open")
      .limit(1)
      .maybeSingle();
    if (!session) return NextResponse.json({ error: "cash_register_closed" }, { status: 409 });

    if (action === "withdrawal" || action === "deposit") {
      const amount = money(form.get("amount"));
      const reason = String(form.get("reason") ?? "").trim().slice(0, 300);
      const receipt = form.get("receipt");
      if (!amount || reason.length < 3) {
        return NextResponse.json({ error: "invalid_movement" }, { status: 400 });
      }
      if (action === "withdrawal" && (!(receipt instanceof File) || receipt.size === 0)) {
        return NextResponse.json({ error: "receipt_required" }, { status: 400 });
      }

      let receiptPath: string | null = null;
      if (receipt instanceof File && receipt.size > 0) {
        if (receipt.size > 5 * 1024 * 1024) {
          return NextResponse.json({ error: "receipt_too_large" }, { status: 400 });
        }
        const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
        if (!allowed.includes(receipt.type)) {
          return NextResponse.json({ error: "invalid_receipt_type" }, { status: 400 });
        }
        const extension = receipt.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "bin";
        receiptPath = `${ctx.merchant.id}/${session.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await ctx.supabase.storage
          .from("cash-receipts")
          .upload(receiptPath, receipt, { contentType: receipt.type, upsert: false });
        if (uploadError) {
          return NextResponse.json({ error: "receipt_upload_failed", detail: uploadError.message }, { status: 500 });
        }
      }

      const { error } = await ctx.supabase.from("cash_register_movements").insert({
        merchant_id: ctx.merchant.id,
        session_id: session.id,
        movement_type: action,
        amount,
        reason,
        receipt_path: receiptPath,
        created_by_user_id: ctx.user.id,
      });
      if (error) return NextResponse.json({ error: "movement_failed", detail: error.message }, { status: 500 });
    } else if (action === "close") {
      const countedAmount = money(form.get("amount"));
      const notes = String(form.get("notes") ?? "").trim().slice(0, 300) || null;
      if (countedAmount === null) return NextResponse.json({ error: "invalid_amount" }, { status: 400 });

      const summary = await getSessionSummary(ctx);
      const expectedAmount = summary.session?.expectedAmount ?? 0;
      const { error } = await ctx.supabase
        .from("cash_register_sessions")
        .update({
          status: "closed",
          closed_by_user_id: ctx.user.id,
          closed_at: new Date().toISOString(),
          expected_amount: expectedAmount,
          counted_amount: countedAmount,
          difference_amount: Math.round((countedAmount - expectedAmount) * 100) / 100,
          closing_notes: notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.id)
        .eq("status", "open");
      if (error) return NextResponse.json({ error: "close_failed", detail: error.message }, { status: 500 });
    } else {
      return NextResponse.json({ error: "invalid_action" }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true, ...(await getSessionSummary(ctx)) });
}