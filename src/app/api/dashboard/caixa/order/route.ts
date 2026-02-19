import { NextResponse } from "next/server";
import { getDashboardContextForApi } from "../_helpers";

function parseOrderNumber(raw: string | null): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const digits = s.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits);
  if (!Number.isFinite(n) || n <= 0 || n > 9_999_999) return null;
  return Math.floor(n);
}

export async function GET(req: Request) {
  const ctx = await getDashboardContextForApi();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!ctx.canSales) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const orderNumber = parseOrderNumber(searchParams.get("orderNumber"));

  if (!orderNumber) {
    return NextResponse.json({ error: "missing_order_number" }, { status: 400 });
  }

  const { data: merchant } = await ctx.supabase
    .from("merchants")
    .select("name")
    .eq("id", ctx.merchant.id)
    .maybeSingle();

  const { data: order, error: orderError } = await ctx.supabase
    .from("orders")
    .select("id, order_number, created_at, status, subtotal, discount, total, payment_method, payment_notes")
    .eq("merchant_id", ctx.merchant.id)
    .eq("order_number", orderNumber)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (orderError) {
    return NextResponse.json({ error: "order_fetch_failed", detail: orderError.message }, { status: 500 });
  }

  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: items, error: itemsError } = await ctx.supabase
    .from("order_items")
    .select("product_id, product_name, quantity, unit_price, line_total")
    .eq("merchant_id", ctx.merchant.id)
    .eq("order_id", order.id)
    .order("created_at", { ascending: true });

  if (itemsError) {
    return NextResponse.json({ error: "order_items_fetch_failed", detail: itemsError.message }, { status: 500 });
  }

  const productIds = Array.from(
    new Set((items ?? []).map((i) => String(i.product_id ?? "").trim()).filter(Boolean)),
  );

  const { data: products } = productIds.length
    ? await ctx.supabase
        .from("products")
        .select("id, unit_label")
        .eq("merchant_id", ctx.merchant.id)
        .in("id", productIds)
    : { data: [] as Array<{ id: string; unit_label: string | null }> };

  const unitByProductId = new Map(
    (products ?? []).map((p) => [p.id, (p as { unit_label?: string | null }).unit_label ?? null] as const),
  );

  return NextResponse.json({
    ok: true,
    merchantName: merchant?.name ?? "",
    order: {
      id: order.id,
      orderNumber: Number(order.order_number ?? 0),
      createdAt: String(order.created_at ?? ""),
      status: String(order.status ?? ""),
      subtotal: Number(order.subtotal ?? 0),
      discount: Number(order.discount ?? 0),
      total: Number(order.total ?? 0),
      paymentMethod: order.payment_method ? String(order.payment_method) : null,
      paymentNotes: order.payment_notes ? String(order.payment_notes) : null,
      items: (items ?? []).map((i) => {
        const productId = String(i.product_id ?? "").trim();
        return {
          productId: productId || null,
          name: String(i.product_name ?? ""),
          quantity: Number(i.quantity ?? 0),
          unitPrice: Number(i.unit_price ?? 0),
          lineTotal: Number(i.line_total ?? 0),
          unitLabel: String(unitByProductId.get(productId) ?? "un"),
        };
      }),
    },
  });
}
