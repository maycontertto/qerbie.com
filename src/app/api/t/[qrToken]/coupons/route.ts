import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { priceCoupon } from "@/lib/customer/couponPricing";

export async function POST(req: Request, ctx: { params: Promise<{ qrToken: string }> }) {
  const { qrToken } = await ctx.params;
  const session = (await cookies()).get("qerbie_session")?.value;
  if (!session || session.length > 256) return NextResponse.json({ error: "missing_session" }, { status: 401 });
  let body: { code?: unknown; menuId?: unknown; items?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_request" }, { status: 400 }); }
  const code = String(body.code ?? "").trim().toUpperCase().replace(/\s+/g, "");
  const menuId = String(body.menuId ?? "");
  const items = Array.isArray(body.items) ? body.items as Array<{ productId?: unknown; quantity?: unknown }> : [];
  if (!/^[A-Z0-9_-]{3,32}$/.test(code) || items.length < 1 || items.length > 100) return NextResponse.json({ error: "invalid_coupon" }, { status: 400 });

  const admin = createAdminClient();
  const { data: table } = await admin.from("merchant_tables").select("merchant_id").eq("qr_token", qrToken).eq("is_active", true).maybeSingle();
  if (!table) return NextResponse.json({ error: "invalid_qr" }, { status: 404 });
  const { data: merchant } = await admin.from("merchants").select("business_category").eq("id", table.merchant_id).maybeSingle();
  if (!merchant?.business_category) return NextResponse.json({ error: "catalog_unavailable" }, { status: 503 });
  const { data: menu } = await admin.from("menus").select("id").eq("id", menuId).eq("merchant_id", table.merchant_id).eq("business_category", merchant.business_category).eq("is_active", true).maybeSingle();
  if (!menu) return NextResponse.json({ error: "invalid_coupon" }, { status: 400 });

  const quantities = new Map<string, number>();
  for (const item of items) {
    const id = String(item.productId ?? "");
    const quantity = Number(item.quantity);
    if (!id || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    quantities.set(id, Math.min(99, (quantities.get(id) ?? 0) + quantity));
  }
  const { data: products, error: productsError } = await admin.from("products").select("id, price, is_active").eq("merchant_id", table.merchant_id).eq("business_category", merchant.business_category).eq("menu_id", menuId).in("id", [...quantities.keys()]);
  if (productsError) return NextResponse.json({ error: "products_unavailable" }, { status: 503 });
  if (!products || products.length !== quantities.size || products.some((product) => !product.is_active)) return NextResponse.json({ error: "invalid_coupon" }, { status: 400 });
  const subtotal = Math.round(products.reduce((sum, product) => sum + Number(product.price ?? 0) * (quantities.get(product.id) ?? 0), 0) * 100) / 100;
  const { data: coupon, error: couponError } = await admin.from("coupons").select("code, discount_type, discount_value, minimum_subtotal, valid_from, valid_until, is_active").eq("merchant_id", table.merchant_id).eq("code", code).maybeSingle();
  if (couponError) return NextResponse.json({ error: "coupons_unavailable" }, { status: 503 });
  const pricing = coupon ? priceCoupon(coupon, subtotal) : null;
  if (!coupon || !pricing) return NextResponse.json({ error: "invalid_coupon" }, { status: 400 });
  return NextResponse.json({ code: coupon.code, subtotal, discount: pricing.discount, total: Math.max(0, Math.round((subtotal - pricing.discount) * 100) / 100) }, { headers: { "Cache-Control": "no-store" } });
}
