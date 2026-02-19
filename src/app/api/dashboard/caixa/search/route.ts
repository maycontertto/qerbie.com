import { NextResponse } from "next/server";
import { getDashboardContextForApi } from "../_helpers";

function normalizeQuery(value: string | null): string {
  return String(value ?? "").trim().slice(0, 80);
}

function isLikelyBarcode(q: string): boolean {
  return /^\d{4,}$/.test(q);
}

export async function GET(req: Request) {
  const ctx = await getDashboardContextForApi();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!ctx.canSales) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = normalizeQuery(searchParams.get("q"));

  if (!q) {
    return NextResponse.json({ error: "missing_query" }, { status: 400 });
  }

  const base = ctx.supabase
    .from("products")
    .select("id, name, price, unit_label, barcode, is_active")
    .eq("merchant_id", ctx.merchant.id)
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(12);

  const query = isLikelyBarcode(q)
    ? base.or(`barcode.eq.${q},name.ilike.%${q}%`)
    : base.ilike("name", `%${q}%`);

  const { data: rows, error } = await query;

  if (error) {
    return NextResponse.json({ error: "search_failed", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    results: (rows ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price ?? 0),
      barcode: (p as { barcode?: string | null }).barcode ?? null,
      unitLabel: String((p as { unit_label?: string | null }).unit_label ?? "un"),
    })),
  });
}
