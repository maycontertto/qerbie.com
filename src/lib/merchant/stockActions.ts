"use server";

import { redirect } from "next/navigation";
import { getDashboardUserOrRedirect } from "@/lib/auth/guard";

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

export async function saveProductStock(formData: FormData): Promise<void> {
  const productId = String(formData.get("product_id") ?? "").trim();
  const track = formData.get("track_stock") === "on";
  const qty = clampInt(formData.get("stock_quantity"), 0, 1_000_000);

  if (!productId) {
    redirect("/dashboard/modulos/estoque?error=invalid_product");
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
    redirect("/dashboard/modulos/estoque?error=save_failed");
  }

  redirect("/dashboard/modulos/estoque?saved=1");
}
