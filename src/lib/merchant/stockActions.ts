"use server";

import { redirect } from "next/navigation";
import { getDashboardUserOrRedirect } from "@/lib/auth/guard";
import type { Database } from "@/lib/supabase/database.types";

const STOCK_BASE = "/dashboard/modulos/estoque";

function clampInt(value: FormDataEntryValue | null, min: number, max: number): number | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const normalized = s.replace(",", ".");
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  const clamped = Math.max(min, Math.min(max, n));
  return Math.round(clamped * 1000) / 1000;
}

function parseLooseDecimal(value: string | null | undefined, decimals: number): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

type RawBatchRow = {
  product_id?: unknown;
  track_stock?: unknown;
  stock_quantity?: unknown;
  price?: unknown;
  cost_price?: unknown;
};

function normalizeBatchRows(raw: string): Array<{
  product_id: string;
  track_stock: boolean;
  stock_quantity: number;
  price: number;
  cost_price: number;
}> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  const rows: Array<{
    product_id: string;
    track_stock: boolean;
    stock_quantity: number;
    price: number;
    cost_price: number;
  }> = [];

  for (const row of parsed as RawBatchRow[]) {
    const productId = typeof row?.product_id === "string" ? row.product_id.trim() : "";
    const trackStock = Boolean(row?.track_stock);
    const stockQuantity = parseLooseDecimal(
      typeof row?.stock_quantity === "string" ? row.stock_quantity : String(row?.stock_quantity ?? ""),
      3,
    );
    const price = parseLooseDecimal(
      typeof row?.price === "string" ? row.price : String(row?.price ?? ""),
      2,
    );
    const costPrice = parseLooseDecimal(
      typeof row?.cost_price === "string" ? row.cost_price : String(row?.cost_price ?? ""),
      2,
    );

    if (!productId || stockQuantity == null || price == null || costPrice == null) {
      return [];
    }

    if (stockQuantity < 0 || price < 0 || costPrice < 0) {
      return [];
    }

    rows.push({
      product_id: productId,
      track_stock: trackStock,
      stock_quantity: trackStock ? stockQuantity : 0,
      price,
      cost_price: costPrice,
    });
  }

  return rows;
}

export async function saveProductStock(formData: FormData): Promise<void> {
  const productId = String(formData.get("product_id") ?? "").trim();
  const track = formData.get("track_stock") === "on";
  const qty = clampInt(formData.get("stock_quantity"), 0, 1_000_000);

  if (!productId) {
    redirect(STOCK_BASE + "?error=invalid_product");
  }

  const { supabase, user, merchant } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  if (!isOwner) {
    redirect("/dashboard");
  }

  const update: { track_stock: boolean; stock_quantity?: number } = { track_stock: track };
  if (qty != null) update.stock_quantity = qty;

  const { error } = await supabase
    .from("products")
    .update(update)
    .eq("merchant_id", merchant.id)
    .eq("id", productId);

  if (error) {
    console.error("saveProductStock: update failed", {
      code: error.code,
      message: error.message,
      details: (error as { details?: string | null }).details,
    });
    redirect(STOCK_BASE + "?error=save_failed");
  }

  redirect(STOCK_BASE + "?saved=1");
}

export async function saveProductStockBatch(formData: FormData): Promise<void> {
  const payload = String(formData.get("items_json") ?? "").trim();

  const rows = normalizeBatchRows(payload);
  if (rows.length === 0) {
    redirect(STOCK_BASE + "?error=invalid_batch");
  }

  const { supabase, user, merchant } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  if (!isOwner) {
    redirect("/dashboard");
  }

  const productIds = rows.map((row) => row.product_id);
  const { data: existingProducts } = await supabase
    .from("products")
    .select("id")
    .eq("merchant_id", merchant.id)
    .in("id", productIds);

  if ((existingProducts ?? []).length !== rows.length) {
    redirect(STOCK_BASE + "?error=invalid_product");
  }

  for (const row of rows) {
    const update: Database["public"]["Tables"]["products"]["Update"] = {
      track_stock: row.track_stock,
      stock_quantity: row.stock_quantity,
      price: row.price,
      cost_price: row.cost_price,
    };

    const { error } = await supabase
      .from("products")
      .update(update)
      .eq("merchant_id", merchant.id)
      .eq("id", row.product_id);

    if (error) {
      console.error("saveProductStockBatch: update failed", {
        productId: row.product_id,
        code: error.code,
        message: error.message,
        details: (error as { details?: string | null }).details,
      });
      redirect(STOCK_BASE + "?error=save_failed");
    }
  }

  redirect(STOCK_BASE + `?saved=batch&count=${rows.length}`);
}
