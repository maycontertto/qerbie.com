import { NextResponse } from "next/server";
import { getDashboardContextForApi } from "../_helpers";

export async function GET(req: Request) {
  const ctx = await getDashboardContextForApi();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!ctx.canSales) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const barcode = (searchParams.get("barcode") ?? "").trim();
  if (!barcode) {
    return NextResponse.json({ error: "missing_barcode" }, { status: 400 });
  }

  const { data: product, error } = await ctx.supabase
    .from("products")
    .select("id, name, price, unit_label, is_active")
    .eq("merchant_id", ctx.merchant.id)
    .eq("barcode", barcode)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "lookup_failed", detail: error.message }, { status: 500 });
  }

  if (!product || !product.is_active) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    product: {
      id: product.id,
      name: product.name,
      price: Number(product.price ?? 0),
      unitLabel: String((product as { unit_label?: string | null }).unit_label ?? "un"),
    },
  });
}
