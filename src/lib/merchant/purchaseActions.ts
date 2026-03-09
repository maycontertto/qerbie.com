"use server";

import { redirect } from "next/navigation";
import { getDashboardUserOrRedirect } from "@/lib/auth/guard";

const PURCHASES_BASE = "/dashboard/modulos/compras";

function parseLooseDecimal(value: unknown, decimals: number): number | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

type RawPurchaseItem = {
  product_id?: unknown;
  quantity?: unknown;
  unit_cost?: unknown;
};

function normalizeItems(raw: string): Array<{ product_id: string; quantity: number; unit_cost: number }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  const grouped = new Map<string, { quantity: number; totalCost: number }>();

  for (const row of parsed as RawPurchaseItem[]) {
    const productId = typeof row?.product_id === "string" ? row.product_id.trim() : "";
    const qty = parseLooseDecimal(typeof row?.quantity === "string" ? row.quantity : "", 3);
    const unitCost = parseLooseDecimal(typeof row?.unit_cost === "string" ? row.unit_cost : "", 2);

    const isBlank = !productId && qty == null && unitCost == null;
    if (isBlank) continue;

    if (!productId || qty == null || unitCost == null || qty <= 0 || unitCost < 0) {
      return [];
    }

    const prev = grouped.get(productId) ?? { quantity: 0, totalCost: 0 };
    grouped.set(productId, {
      quantity: prev.quantity + qty,
      totalCost: prev.totalCost + qty * unitCost,
    });
  }

  return Array.from(grouped.entries()).map(([product_id, agg]) => ({
    product_id,
    quantity: Math.round(agg.quantity * 1000) / 1000,
    unit_cost: agg.quantity > 0 ? Math.round((agg.totalCost / agg.quantity) * 100) / 100 : 0,
  }));
}

export async function createPurchaseEntry(formData: FormData): Promise<void> {
  const { supabase, user, merchant } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;

  if (!isOwner) {
    redirect(PURCHASES_BASE + "?error=not_owner");
  }

  if (merchant.business_category !== "mercado") {
    redirect(PURCHASES_BASE + "?error=unsupported_category");
  }

  const supplierId = String(formData.get("supplier_id") ?? "").trim() || null;
  const supplierName = String(formData.get("supplier_name") ?? "").trim() || null;
  const invoiceNumber = String(formData.get("invoice_number") ?? "").trim();
  const issueDate = String(formData.get("issue_date") ?? "").trim() || null;
  const entryDate = String(formData.get("entry_date") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const itemsJson = String(formData.get("items_json") ?? "").trim();

  if (!invoiceNumber) {
    redirect(PURCHASES_BASE + "?error=invalid_invoice_number");
  }

  const items = normalizeItems(itemsJson);
  if (items.length === 0) {
    redirect(PURCHASES_BASE + "?error=invalid_items");
  }

  const { error } = await supabase.rpc("record_purchase_entry", {
    p_merchant_id: merchant.id,
    p_supplier_id: supplierId,
    p_supplier_name: supplierName,
    p_invoice_number: invoiceNumber,
    p_issue_date: issueDate,
    p_entry_date: entryDate,
    p_notes: notes,
    p_items: items,
  });

  if (error) {
    const message = String(error.message ?? "").toLowerCase();
    if (message.includes("invalid_supplier")) redirect(PURCHASES_BASE + "?error=invalid_supplier");
    if (message.includes("invalid_product")) redirect(PURCHASES_BASE + "?error=invalid_product");
    if (message.includes("invalid_items")) redirect(PURCHASES_BASE + "?error=invalid_items");
    if (message.includes("invalid_invoice_number")) redirect(PURCHASES_BASE + "?error=invalid_invoice_number");
    if (message.includes("not_owner")) redirect(PURCHASES_BASE + "?error=not_owner");

    console.error("createPurchaseEntry failed", {
      code: error.code,
      message: error.message,
      details: (error as { details?: string | null }).details,
    });
    redirect(PURCHASES_BASE + "?error=save_failed");
  }

  redirect(PURCHASES_BASE + "?saved=1");
}
