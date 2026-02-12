import { NextResponse } from "next/server";
import { getDashboardContextForApi } from "../_helpers";

type CheckoutItem = {
  productId: string;
  quantity: number;
};

type PaymentMethod = "cash" | "pix" | "card" | "other";

function asPaymentMethod(value: unknown): PaymentMethod | null {
  const s = String(value ?? "").trim().toLowerCase();
  if (s === "cash" || s === "pix" || s === "card" || s === "other") return s;
  return null;
}

function clampInt(value: unknown, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function POST(req: Request) {
  const ctx = await getDashboardContextForApi();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!ctx.canSales) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { items?: CheckoutItem[]; paymentMethod?: unknown; paymentNotes?: unknown };
  try {
    body = (await req.json()) as { items?: CheckoutItem[]; paymentMethod?: unknown; paymentNotes?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const paymentMethod = asPaymentMethod(body.paymentMethod) ?? "cash";
  const paymentNotesRaw = typeof body.paymentNotes === "string" ? body.paymentNotes : "";
  const paymentNotes = paymentNotesRaw.trim().slice(0, 200) || null;

  const items: CheckoutItem[] = Array.isArray(body.items)
    ? body.items
        .map((i) => ({
          productId: String((i as { productId?: unknown }).productId ?? "").trim(),
          quantity: clampInt((i as { quantity?: unknown }).quantity, 1, 99),
        }))
        .filter((i) => i.productId)
    : [];

  if (items.length === 0) {
    return NextResponse.json({ error: "empty_cart" }, { status: 400 });
  }

  const productIds = Array.from(new Set(items.map((i) => i.productId)));

  const { data: products, error: productsError } = await ctx.supabase
    .from("products")
    .select("id, name, price, is_active")
    .eq("merchant_id", ctx.merchant.id)
    .in("id", productIds);

  if (productsError || !products) {
    return NextResponse.json(
      { error: "products_fetch_failed", detail: productsError?.message ?? "" },
      { status: 500 },
    );
  }

  const productById = new Map(products.map((p) => [p.id, p] as const));
  for (const id of productIds) {
    const p = productById.get(id);
    if (!p || !p.is_active) {
      return NextResponse.json({ error: "invalid_product" }, { status: 400 });
    }
  }

  const subtotal = round2(
    items.reduce((sum, i) => {
      const p = productById.get(i.productId);
      const price = Number(p?.price ?? 0);
      return sum + price * i.quantity;
    }, 0),
  );

  const discount = 0;
  const total = round2(subtotal);

  const todayUtc = new Date().toISOString().slice(0, 10);
  let lastError: string | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: last } = await ctx.supabase
      .from("orders")
      .select("order_number")
      .eq("merchant_id", ctx.merchant.id)
      .eq("created_day", todayUtc)
      .order("order_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextNumber = (last?.order_number ?? 0) + 1;

    const sessionToken = `pos-${crypto.randomUUID()}`;

    const { data: order, error: orderError } = await ctx.supabase
      .from("orders")
      .insert({
        merchant_id: ctx.merchant.id,
        table_id: null,
        order_number: nextNumber,
        session_token: sessionToken,
        order_type: "takeaway",
        status: "completed",
        customer_name: null,
        customer_notes: null,
        subtotal,
        discount,
        total,
        payment_method: paymentMethod,
        payment_notes: paymentNotes,
        completed_at: new Date().toISOString(),
        completed_by_user_id: ctx.user.id,
      })
      .select("id, order_number, total")
      .maybeSingle();

    if (orderError || !order) {
      lastError = orderError?.message ?? "order_insert_failed";
      continue;
    }

    const orderItemsRows = items.map((i) => {
      const p = productById.get(i.productId)!;
      const unitPrice = round2(Number(p.price ?? 0));
      const lineTotal = round2(unitPrice * i.quantity);

      return {
        merchant_id: ctx.merchant.id,
        order_id: order.id,
        product_id: p.id,
        product_name: p.name,
        quantity: i.quantity,
        unit_price: unitPrice,
        options_total: 0,
        line_total: lineTotal,
        notes: null,
      };
    });

    const { error: itemsError } = await ctx.supabase.from("order_items").insert(orderItemsRows);

    if (itemsError) {
      return NextResponse.json(
        { error: "order_items_insert_failed", detail: itemsError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      orderNumber: order.order_number,
      total: order.total,
    });
  }

  return NextResponse.json(
    { error: "order_create_failed", detail: lastError },
    { status: 500 },
  );
}
