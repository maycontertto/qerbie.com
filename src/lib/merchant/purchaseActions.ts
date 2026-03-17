"use server";

import { redirect } from "next/navigation";
import { getDashboardUserOrRedirect } from "@/lib/auth/guard";
import { DEFAULT_MENU_NAME, DEFAULT_MENU_SLUG } from "@/lib/catalog/templates";
import type { Database } from "@/lib/supabase/database.types";
import { supportsPurchaseEntries } from "@/lib/merchant/purchaseCategories";

const PURCHASES_BASE = "/dashboard/modulos/compras";

export type QuickPurchaseProductInput = {
  name: string;
  barcode?: string | null;
  internalCode?: string | null;
  categoryId?: string | null;
  unitLabel?: string | null;
  price?: string | null;
  costPrice?: string | null;
};

export type QuickPurchaseProductResult =
  | {
      ok: true;
      created: boolean;
      product: {
        id: string;
        name: string;
        barcode: string | null;
        internalCode: string | null;
        unitLabel: string;
        stockQuantity: number;
        costPrice: number;
      };
      message: string;
    }
  | {
      ok: false;
      error:
        | "not_owner"
        | "unsupported_category"
        | "invalid_name"
        | "invalid_price"
        | "invalid_category"
        | "save_failed";
      message: string;
    };

type QuickPurchaseProductItem = {
  id: string;
  name: string;
  barcode: string | null;
  internalCode: string | null;
  unitLabel: string;
  stockQuantity: number;
  costPrice: number;
};

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

function parseMoneyInput(value: string | null | undefined): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  return parseLooseDecimal(raw, 2);
}

function normalizeUnitLabel(raw: string | null | undefined): string {
  const normalized = String(raw ?? "")
    .trim()
    .toLowerCase();

  if (!normalized) return "un";
  return normalized.slice(0, 12);
}

function makeSlug(base: string): string {
  const normalized = base
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const suffix = Math.random().toString(36).slice(2, 8);
  return `${normalized || "menu"}-${suffix}`;
}

async function ensurePrimaryMenu(
  supabase: Awaited<ReturnType<typeof getDashboardUserOrRedirect>>["supabase"],
  merchantId: string,
): Promise<string | null> {
  const { data: menu } = await supabase
    .from("menus")
    .select("id, slug")
    .eq("merchant_id", merchantId)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (menu?.id) return menu.id;

  const tryInsert = async (slug: string) => {
    const { data } = await supabase
      .from("menus")
      .insert({
        merchant_id: merchantId,
        name: DEFAULT_MENU_NAME,
        description: null,
        slug,
        is_active: true,
        display_order: 0,
      })
      .select("id")
      .maybeSingle();

    return data?.id ?? null;
  };

  return (await tryInsert(DEFAULT_MENU_SLUG)) ?? (await tryInsert(makeSlug(DEFAULT_MENU_SLUG)));
}

function toProductOption(
  row: Database["public"]["Tables"]["products"]["Row"],
): QuickPurchaseProductItem {
  return {
    id: row.id,
    name: row.name,
    barcode: row.barcode,
    internalCode: row.internal_code,
    unitLabel: row.unit_label,
    stockQuantity: Number(row.stock_quantity ?? 0),
    costPrice: Number(row.cost_price ?? 0),
  };
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

  if (!supportsPurchaseEntries(merchant.business_category)) {
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

export async function createQuickPurchaseProduct(
  input: QuickPurchaseProductInput,
): Promise<QuickPurchaseProductResult> {
  const { supabase, user, merchant } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;

  if (!isOwner) {
    return {
      ok: false,
      error: "not_owner",
      message: "Somente o proprietário pode criar produtos por este atalho.",
    };
  }

  if (!supportsPurchaseEntries(merchant.business_category)) {
    return {
      ok: false,
      error: "unsupported_category",
      message: "Este atalho de compras não está disponível para o seu segmento.",
    };
  }

  const name = String(input.name ?? "").trim();
  const barcode = String(input.barcode ?? "").trim() || null;
  const internalCode = String(input.internalCode ?? "").trim() || null;
  const categoryId = String(input.categoryId ?? "").trim() || null;
  const unitLabel = normalizeUnitLabel(input.unitLabel);
  const price = parseMoneyInput(input.price);
  const costPrice = parseMoneyInput(input.costPrice);

  if (name.length < 2) {
    return {
      ok: false,
      error: "invalid_name",
      message: "Informe um nome válido para o produto.",
    };
  }

  if (price == null || costPrice == null || price < 0 || costPrice < 0) {
    return {
      ok: false,
      error: "invalid_price",
      message: "Preço e custo precisam ser números válidos.",
    };
  }

  if (categoryId) {
    const { data: category } = await supabase
      .from("menu_categories")
      .select("id")
      .eq("id", categoryId)
      .eq("merchant_id", merchant.id)
      .maybeSingle();

    if (!category) {
      return {
        ok: false,
        error: "invalid_category",
        message: "A categoria selecionada não pertence a este negócio.",
      };
    }
  }

  if (barcode) {
    const { data: existingByBarcode } = await supabase
      .from("products")
      .select("*")
      .eq("merchant_id", merchant.id)
      .eq("barcode", barcode)
      .maybeSingle();

    if (existingByBarcode) {
      return {
        ok: true,
        created: false,
        product: toProductOption(existingByBarcode),
        message: "Já existia um produto com esse código de barras. O item foi vinculado automaticamente.",
      };
    }
  }

  if (internalCode) {
    const { data: existingByInternalCode } = await supabase
      .from("products")
      .select("*")
      .eq("merchant_id", merchant.id)
      .eq("internal_code", internalCode)
      .maybeSingle();

    if (existingByInternalCode) {
      return {
        ok: true,
        created: false,
        product: toProductOption(existingByInternalCode),
        message: "Já existia um produto com esse código interno. O item foi vinculado automaticamente.",
      };
    }
  }

  const menuId = await ensurePrimaryMenu(supabase, merchant.id);
  if (!menuId) {
    return {
      ok: false,
      error: "save_failed",
      message: "Não foi possível preparar o catálogo padrão para criar o produto.",
    };
  }

  const insertRow: Database["public"]["Tables"]["products"]["Insert"] = {
    merchant_id: merchant.id,
    menu_id: menuId,
    category_id: categoryId,
    name,
    barcode,
    internal_code: internalCode,
    description: null,
    image_url: null,
    price,
    cost_price: costPrice,
    avg_cost: costPrice,
    unit_label: unitLabel,
    is_active: true,
    is_featured: false,
    requires_prescription: false,
    requires_document: false,
    track_stock: true,
    stock_quantity: 0,
    stock_min_quantity: 0,
    display_order: 0,
  };

  const { data, error } = await supabase
    .from("products")
    .insert(insertRow)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    console.error("createQuickPurchaseProduct failed", {
      code: error?.code,
      message: error?.message,
      details: (error as { details?: string | null } | null)?.details,
    });

    return {
      ok: false,
      error: "save_failed",
      message: "Não foi possível criar o produto agora. Tente novamente.",
    };
  }

  return {
    ok: true,
    created: true,
    product: toProductOption(data),
    message: "Produto criado e vinculado à nota com sucesso.",
  };
}
