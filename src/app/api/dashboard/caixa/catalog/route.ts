import { NextResponse } from "next/server";
import { getDashboardContextForApi } from "../_helpers";
import { signOfflinePrice } from "@/lib/merchant/offlinePriceToken";

export async function GET() {
  const ctx = await getDashboardContextForApi();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!ctx.canSales) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const pageSize = 1000;
  const products: Array<{ id: string; name: string; price: number; barcode: string | null; unitLabel: string; offlinePriceToken?: string | null }> = [];
  for (let start = 0; start < 10000; start += pageSize) {
    const { data, error } = await ctx.supabase.from("products")
      .select("id,name,price,barcode,unit_label,is_active")
      .eq("merchant_id", ctx.merchant.id).eq("is_active", true)
      .order("name", { ascending: true }).range(start, start + pageSize - 1);
    if (error) return NextResponse.json({ error: "catalog_unavailable" }, { status: 503 });
    for (const product of data ?? []) {
      const price = Number(product.price ?? 0);
      let offlinePriceToken: string | null = null;
      try { offlinePriceToken = signOfflinePrice(ctx.merchant.id, product.id, price); } catch { /* offline sync requires a configured signing secret */ }
      products.push({ id: product.id, name: product.name, price, barcode: product.barcode, unitLabel: product.unit_label ?? "un", offlinePriceToken });
    }
    if (!data || data.length < pageSize) break;
  }
  return NextResponse.json({ ok: true, products, updatedAt: new Date().toISOString() });
}
