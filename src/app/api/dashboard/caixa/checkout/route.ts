import { NextResponse } from "next/server";
import { getDashboardContextForApi } from "../_helpers";
import { verifyOfflinePrice } from "@/lib/merchant/offlinePriceToken";

type CheckoutItem = {
  productId: string;
  quantity: number;
  unitPrice?: number;
  offlinePriceToken?: string;
};

type PaymentMethod = "cash" | "pix" | "card" | "other";
type ReceiptType = "non_fiscal" | "fiscal_requested";

function asPaymentMethod(value: unknown): PaymentMethod | null {
  const s = String(value ?? "").trim().toLowerCase();
  if (s === "cash" || s === "pix" || s === "card" || s === "other") return s;
  return null;
}

function clampInt(value: unknown, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return min;
  const clamped = Math.max(min, Math.min(max, n));
  return Math.round(clamped * 1000) / 1000;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function hasValidTaxIdCheckDigits(value: string): boolean {
  if (/^(\d)\1+$/.test(value)) return false;
  const calculateDigit = (base: string, weights: number[]) => {
    const sum = base.split("").reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  if (value.length === 11) {
    const first = calculateDigit(value.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
    const second = calculateDigit(value.slice(0, 9) + first, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
    return value.endsWith(`${first}${second}`);
  }
  if (value.length === 14) {
    const first = calculateDigit(value.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    const second = calculateDigit(value.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    return value.endsWith(`${first}${second}`);
  }
  return false;
}

export async function POST(req: Request) {
  const ctx = await getDashboardContextForApi();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!ctx.canSales) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: {
    items?: CheckoutItem[];
    paymentMethod?: unknown;
    paymentNotes?: unknown;
    receiptType?: unknown;
    customerName?: unknown;
    customerTaxId?: unknown;
    registerDeviceId?: unknown;
    clientSaleId?: unknown;
    offlineSync?: unknown;
    cashSessionId?: unknown;
    saleCreatedAt?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const paymentMethod = asPaymentMethod(body.paymentMethod) ?? "cash";
  const paymentNotesRaw = typeof body.paymentNotes === "string" ? body.paymentNotes : "";
  const paymentNotes = paymentNotesRaw.trim().slice(0, 200) || null;
  const receiptType: ReceiptType = body.receiptType === "fiscal_requested" ? "fiscal_requested" : "non_fiscal";
  const customerName = typeof body.customerName === "string" ? body.customerName.trim().slice(0, 120) || null : null;
  const customerTaxIdDigits = String(body.customerTaxId ?? "").replace(/\D/g, "");
  const customerTaxId = customerTaxIdDigits || null;
  const offlineSync = body.offlineSync === true;
  const requestedSaleDate = new Date(String(body.saleCreatedAt ?? ""));
  const validSaleDate = offlineSync && Number.isFinite(requestedSaleDate.getTime())
    && requestedSaleDate.getTime() <= Date.now() + 5 * 60 * 1000
    && requestedSaleDate.getTime() >= Date.now() - 30 * 24 * 60 * 60 * 1000;
  const clientSaleId = String(body.clientSaleId ?? "").trim();
  const requestedRegisterId = String(body.registerDeviceId ?? "").trim();
  const assignedRegisterId = ctx.membership?.cash_register_device_id ?? null;
  const clientSaleIdValid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientSaleId);
  if (!clientSaleIdValid) return NextResponse.json({ error: "invalid_sale_id" }, { status: 400 });
  if (assignedRegisterId && requestedRegisterId && assignedRegisterId !== requestedRegisterId) {
    return NextResponse.json({ error: "register_not_assigned" }, { status: 403 });
  }
  let registerId: string | null = assignedRegisterId || requestedRegisterId || null;
  if (!registerId) {
    registerId = (await ctx.supabase.from("cash_register_devices").select("id").eq("merchant_id", ctx.merchant.id).eq("is_active", true).order("created_at").limit(1).maybeSingle()).data?.id ?? null;
  }
  if (!registerId) return NextResponse.json({ error: "cash_register_not_found" }, { status: 409 });
  const { data: register } = await ctx.supabase.from("cash_register_devices").select("id").eq("id", registerId).eq("merchant_id", ctx.merchant.id).eq("is_active", true).maybeSingle();
  if (!register) return NextResponse.json({ error: "cash_register_not_found" }, { status: 409 });

  const { data: duplicateSale } = await ctx.supabase
    .from("orders")
    .select("id,order_number,total")
    .eq("merchant_id", ctx.merchant.id)
    .eq("client_sale_id", clientSaleId)
    .maybeSingle();
  if (duplicateSale) return NextResponse.json({ ok: true, orderId: duplicateSale.id, orderNumber: duplicateSale.order_number, total: duplicateSale.total, duplicate: true });

  if (customerTaxId && !hasValidTaxIdCheckDigits(customerTaxId)) {
    return NextResponse.json({ error: "invalid_tax_id" }, { status: 400 });
  }

  const items: CheckoutItem[] = Array.isArray(body.items)
    ? body.items
        .map((i) => ({
          productId: String((i as { productId?: unknown }).productId ?? "").trim(),
          quantity: clampInt((i as { quantity?: unknown }).quantity, 0.001, 999),
          unitPrice: Number((i as { unitPrice?: unknown }).unitPrice),
          offlinePriceToken: String((i as { offlinePriceToken?: unknown }).offlinePriceToken ?? ""),
        }))
        .filter((i) => i.productId)
    : [];

  if (items.length === 0) {
    return NextResponse.json({ error: "empty_cart" }, { status: 400 });
  }
  if (offlineSync && items.some((item) => item.unitPrice == null || !Number.isFinite(item.unitPrice) || item.unitPrice < 0 || item.unitPrice > 1_000_000)) {
    return NextResponse.json({ error: "invalid_offline_price" }, { status: 400 });
  }
  if (offlineSync && items.some((item) => !verifyOfflinePrice(item.offlinePriceToken ?? "", ctx.merchant.id, item.productId, item.unitPrice ?? -1))) {
    return NextResponse.json({ error: "offline_price_verification_failed" }, { status: 400 });
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
    if (!p || (!p.is_active && !offlineSync)) {
      return NextResponse.json({ error: "invalid_product" }, { status: 400 });
    }
  }

  const subtotal = round2(items.reduce((sum, item) => {
    const price = offlineSync ? (item.unitPrice ?? 0) : Number(productById.get(item.productId)?.price ?? 0);
    return sum + price * item.quantity;
  }, 0));

  const discount = 0;
  const total = round2(subtotal);

  let cashSessionId: string | null = null;
  let cashRegisterAvailable = false;
  const { data: cashSession, error: cashSessionError } = await ctx.supabase
    .from("cash_register_sessions")
    .select("id")
    .eq("merchant_id", ctx.merchant.id)
    .eq("cash_register_device_id", registerId)
    .eq("status", "open")
    .limit(1)
    .maybeSingle();
  cashRegisterAvailable = !cashSessionError;
  if (offlineSync && typeof body.cashSessionId === "string" && body.cashSessionId) {
    const { data: originalSession } = await ctx.supabase.from("cash_register_sessions")
      .select("id").eq("merchant_id", ctx.merchant.id).eq("cash_register_device_id", registerId)
      .eq("id", body.cashSessionId).maybeSingle();
    if (originalSession) cashSessionId = originalSession.id;
  }
  if (cashRegisterAvailable && paymentMethod === "cash" && !cashSession && !offlineSync) {
    return NextResponse.json({ error: "cash_register_closed" }, { status: 409 });
  }
  cashSessionId = cashSessionId ?? cashSession?.id ?? null;

  const { error: receiptSchemaError } = await ctx.supabase.from("orders").select("receipt_type").limit(1);
  const receiptFeaturesAvailable = !receiptSchemaError;

  const todayUtc = (validSaleDate ? requestedSaleDate : new Date()).toISOString().slice(0, 10);
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
        customer_name: customerName,
        customer_notes: null,
        ...(receiptFeaturesAvailable
          ? {
              customer_tax_id: customerTaxId,
              receipt_type: receiptType,
              fiscal_status: receiptType === "fiscal_requested" ? "requested" : null,
            }
          : {}),
        subtotal,
        discount,
        total,
        payment_method: paymentMethod,
        payment_notes: paymentNotes,
        ...(cashRegisterAvailable ? { cash_session_id: cashSessionId } : {}),
        cash_register_device_id: registerId,
        cashier_user_id: ctx.user.id,
        client_sale_id: clientSaleId,
        ...(offlineSync ? { offline_synced_at: new Date().toISOString() } : {}),
        completed_at: new Date().toISOString(),
        completed_by_user_id: ctx.user.id,
        ...(validSaleDate ? { created_at: requestedSaleDate.toISOString() } : {}),
      })
      .select("id, order_number, total")
      .maybeSingle();

    if (orderError || !order) {
      lastError = orderError?.message ?? "order_insert_failed";
      continue;
    }

    const orderItemsRows = items.map((i) => {
      const p = productById.get(i.productId)!;
      const unitPrice = round2(offlineSync ? (i.unitPrice ?? 0) : Number(p.price ?? 0));
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
      receiptFeaturesAvailable,
    });
  }

  return NextResponse.json(
    { error: "order_create_failed", detail: lastError },
    { status: 500 },
  );
}
