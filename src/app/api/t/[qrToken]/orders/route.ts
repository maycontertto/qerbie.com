import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

type OrderItemInput = {
  productId: string;
  quantity: number;
  notes?: string | null;
};

type CreateOrderBody = {
  menuId?: string | null;
  orderType?: "dine_in" | "takeaway" | "delivery" | null;
  deliveryAddress?: string | null;
  customerNotes?: string | null;
  items: OrderItemInput[];
};

type DeliverySettingsRow = {
  delivery_enabled: boolean;
  delivery_fee: number | null;
  delivery_eta_minutes: number | null;
};

function clampInt(value: unknown, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ qrToken: string }> },
) {
  const { qrToken } = await ctx.params;

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("qerbie_session")?.value ?? "";
  const customerName = cookieStore.get("qerbie_customer_name")?.value ?? null;

  if (!sessionToken) {
    return NextResponse.json(
      { error: "missing_session" },
      { status: 401 },
    );
  }

  let body: CreateOrderBody;
  try {
    body = (await req.json()) as CreateOrderBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  const items = rawItems
    .map((i) => ({
      productId: String(i.productId ?? ""),
      quantity: clampInt(i.quantity, 1, 99),
      notes: i.notes ? String(i.notes) : null,
    }))
    .filter((i) => i.productId);

  if (items.length === 0) {
    return NextResponse.json({ error: "empty_cart" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: table, error: tableError } = await supabase
    .from("merchant_tables")
    .select("id, merchant_id, label")
    .eq("qr_token", qrToken)
    .maybeSingle();

  if (tableError || !table) {
    return NextResponse.json({ error: "invalid_qr" }, { status: 404 });
  }

  const merchantId = table.merchant_id;

  // Resolve menu
  let menuId = (body.menuId ?? "").trim();
  if (menuId) {
    const { data: menuOk } = await supabase
      .from("menus")
      .select("id")
      .eq("merchant_id", merchantId)
      .eq("is_active", true)
      .eq("id", menuId)
      .maybeSingle();
    if (!menuOk) menuId = "";
  }

  if (!menuId) {
    const { data: firstMenu } = await supabase
      .from("menus")
      .select("id")
      .eq("merchant_id", merchantId)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    menuId = firstMenu?.id ?? "";
  }

  if (!menuId) {
    return NextResponse.json({ error: "no_menu" }, { status: 400 });
  }

  // Fetch products (server-trusted pricing)
  const productIds = Array.from(new Set(items.map((i) => i.productId)));
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, price, is_active")
    .eq("merchant_id", merchantId)
    .eq("menu_id", menuId)
    .in("id", productIds);

  if (productsError || !products) {
    return NextResponse.json({ error: "products_fetch_failed" }, { status: 500 });
  }

  const productById = new Map(products.map((p) => [p.id, p] as const));
  for (const id of productIds) {
    const p = productById.get(id);
    if (!p || !p.is_active) {
      return NextResponse.json({ error: "invalid_product" }, { status: 400 });
    }
  }

  function round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  const subtotal = round2(
    items.reduce((sum, i) => {
      const p = productById.get(i.productId);
      const price = Number(p?.price ?? 0);
      return sum + price * i.quantity;
    }, 0),
  );

  const discount = 0;

  const orderTypeRaw = String(body.orderType ?? "dine_in");
  const orderType =
    orderTypeRaw === "delivery" || orderTypeRaw === "takeaway" || orderTypeRaw === "dine_in"
      ? orderTypeRaw
      : "dine_in";

  let deliveryAddress: string | null = null;
  let deliveryFee = 0;
  let deliveryEtaMinutes: number | null = null;

  if (orderType === "delivery") {
    const { data: delivery, error: deliveryError } = await supabase
      .from("merchants")
      .select("delivery_enabled, delivery_fee, delivery_eta_minutes")
      .eq("id", merchantId)
      .maybeSingle();

    const deliveryRow = delivery as DeliverySettingsRow | null;
    const enabled = Boolean(deliveryRow?.delivery_enabled);
    if (deliveryError || !enabled) {
      return NextResponse.json({ error: "delivery_disabled" }, { status: 400 });
    }

    deliveryAddress = (body.deliveryAddress ?? "").trim();
    if (!deliveryAddress || deliveryAddress.length < 5) {
      return NextResponse.json({ error: "delivery_address_missing" }, { status: 400 });
    }

    const fee = Number(deliveryRow?.delivery_fee ?? 0);
    deliveryFee = Number.isFinite(fee) && fee > 0 ? round2(fee) : 0;

    const eta = Number(deliveryRow?.delivery_eta_minutes ?? NaN);
    deliveryEtaMinutes = Number.isFinite(eta) ? clampInt(eta, 1, 240) : null;
  }

  const total = round2(subtotal + deliveryFee);

  // order_number allocation with a small retry loop
  const todayUtc = new Date().toISOString().slice(0, 10);
  let lastError: string | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: last } = await supabase
      .from("orders")
      .select("order_number")
      .eq("merchant_id", merchantId)
      .eq("created_day", todayUtc)
      .order("order_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextNumber = (last?.order_number ?? 0) + 1;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        merchant_id: merchantId,
        table_id: table.id,
        order_number: nextNumber,
        session_token: sessionToken,
        order_type: orderType,
        status: "pending",
        customer_name: customerName,
        customer_notes: body.customerNotes ? String(body.customerNotes) : null,
        subtotal,
        discount,
        total,
        delivery_address: deliveryAddress,
        delivery_fee: deliveryFee || null,
        delivery_eta_minutes: deliveryEtaMinutes,
      })
      .select("id, order_number, total")
      .maybeSingle();

    if (orderError || !order) {
      lastError = orderError?.message ?? "order_insert_failed";
      // Could be unique collision, retry.
      continue;
    }

    const orderItemsRows = items.map((i) => {
      const p = productById.get(i.productId)!;
      const unitPrice = round2(Number(p.price ?? 0));
      const lineTotal = round2(unitPrice * i.quantity);

      return {
        merchant_id: merchantId,
        order_id: order.id,
        product_id: p.id,
        product_name: p.name,
        quantity: i.quantity,
        unit_price: unitPrice,
        options_total: 0,
        line_total: lineTotal,
        notes: i.notes ?? null,
      };
    });

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItemsRows);

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
      table: orderType === "delivery" ? "Entrega" : table.label,
    });
  }

  return NextResponse.json(
    { error: "order_create_failed", detail: lastError },
    { status: 500 },
  );
}
