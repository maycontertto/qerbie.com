"use server";

import { redirect } from "next/navigation";
import * as XLSX from "xlsx";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import type { Database } from "@/lib/supabase/database.types";
import { getSuggestedCategories } from "@/lib/catalog/templates";

const MAX_PRODUCT_IMAGE_BYTES = 12 * 1024 * 1024;

function getFileExtension(file: File): string {
  return (
    (file.name.split(".").pop() || "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 10)
      .toLowerCase() || "bin"
  );
}

function isProbablyImageFile(file: File): boolean {
  if ((file.type || "").toLowerCase().startsWith("image/")) return true;
  const ext = getFileExtension(file);
  return ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"].includes(ext);
}

function guessImageContentType(file: File): string {
  const t = (file.type || "").toLowerCase();
  if (t.startsWith("image/")) return t;

  const ext = getFileExtension(file);
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "heic") return "image/heic";
  if (ext === "heif") return "image/heif";
  return "application/octet-stream";
}

function getRedirectBase(formData: FormData): "/dashboard/modulos/produtos" | "/dashboard/modulos/servicos" {
  const raw = (formData.get("redirect_to") as string | null)?.trim() ?? "";
  if (raw === "/dashboard/modulos/servicos") return raw;
  return "/dashboard/modulos/produtos";
}

function getSafeReturnTo(formData: FormData): string {
  const base = getRedirectBase(formData);
  const raw = (formData.get("return_to") as string | null)?.trim() ?? "";
  if (!raw) return base;

  // Defense-in-depth: only allow internal same-module returns.
  if (raw.startsWith(base)) return raw;
  return base;
}

function withQueryParam(url: string, key: string, value: string): string {
  const u = new URL(url, "http://local");
  u.searchParams.set(key, value);
  return `${u.pathname}${u.search}`;
}

async function requireProductsAccess() {
  const { supabase, user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const ok =
    isOwner ||
    (membership
      ? hasMemberPermission(membership.role, membership.permissions, "dashboard_products")
      : false);
  if (!ok) {
    redirect("/dashboard");
  }
  return { supabase, user, merchant, membership, isOwner };
}

function parsePriceBR(input: string): number {
  const normalized = input.trim().replace(/\./g, "").replace(",", ".");
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 100) / 100;
}

function clampDecimalFromForm(
  value: FormDataEntryValue | null,
  min: number,
  max: number,
  decimals: number,
): number | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const normalized = raw.replace(",", ".");
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  const clamped = Math.max(min, Math.min(max, n));
  const factor = 10 ** decimals;
  return Math.round(clamped * factor) / factor;
}

function normalizeUnitLabel(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!s) return "un";
  // Keep it flexible but avoid huge strings.
  return s.slice(0, 12);
}

function normalizeLookupText(raw: string | null | undefined): string {
  return String(raw ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeHeader(raw: string | null | undefined): string {
  return normalizeLookupText(raw).replace(/\s+/g, "_");
}

function parseOptionalPriceBR(input: string | null | undefined): number | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  return parsePriceBR(raw);
}

function parseOptionalBoolean(input: unknown): boolean | null {
  const raw = String(input ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (["1", "true", "sim", "s", "yes", "y", "ativo", "on"].includes(raw)) return true;
  if (["0", "false", "nao", "não", "n", "no", "inativo", "off"].includes(raw)) return false;
  return null;
}

type SpreadsheetImportMode = "create_update" | "create_only" | "update_only";

type SpreadsheetRow = {
  name: string;
  barcode: string | null;
  internalCode: string | null;
  categoryName: string | null;
  unitLabel: string | null;
  price: number | null;
  costPrice: number | null;
  stockQuantity: number | null;
  trackStock: boolean | null;
  isActive: boolean | null;
};

function readSpreadsheetRows(bytes: Uint8Array): SpreadsheetRow[] {
  const workbook = XLSX.read(bytes, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = firstSheetName ? workbook.Sheets[firstSheetName] : null;
  if (!sheet) return [];

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  return rawRows
    .map((row) => {
      const mapped = new Map<string, string>();
      for (const [key, value] of Object.entries(row)) {
        mapped.set(normalizeHeader(key), String(value ?? "").trim());
      }

      const name =
        mapped.get("nome") ||
        mapped.get("produto") ||
        mapped.get("item") ||
        mapped.get("name") ||
        "";

      const barcode =
        mapped.get("codigo_de_barras") ||
        mapped.get("codigo_barras") ||
        mapped.get("barcode") ||
        mapped.get("ean") ||
        null;

      const internalCode =
        mapped.get("codigo_interno") ||
        mapped.get("internal_code") ||
        mapped.get("sku") ||
        null;

      const categoryName =
        mapped.get("categoria") ||
        mapped.get("category") ||
        mapped.get("grupo") ||
        null;

      const unitLabel =
        mapped.get("unidade") ||
        mapped.get("unit") ||
        mapped.get("unit_label") ||
        null;

      const price = parseOptionalPriceBR(
        mapped.get("preco") || mapped.get("preco_de_venda") || mapped.get("price") || mapped.get("valor") || null,
      );
      const costPrice = parseOptionalPriceBR(
        mapped.get("custo") || mapped.get("cost") || mapped.get("cost_price") || null,
      );
      const stockQuantity = clampDecimalFromForm(
        mapped.get("estoque") || mapped.get("quantidade") || mapped.get("stock") || mapped.get("qty") || null,
        0,
        1_000_000,
        3,
      );
      const trackStock = parseOptionalBoolean(
        mapped.get("controlar_estoque") || mapped.get("track_stock") || mapped.get("estoque_ativo") || null,
      );
      const isActive = parseOptionalBoolean(mapped.get("ativo") || mapped.get("active") || null);

      return {
        name: name.trim(),
        barcode: barcode?.trim() || null,
        internalCode: internalCode?.trim() || null,
        categoryName: categoryName?.trim() || null,
        unitLabel: unitLabel?.trim() || null,
        price,
        costPrice,
        stockQuantity,
        trackStock,
        isActive,
      } satisfies SpreadsheetRow;
    })
    .filter((row) => row.name.length >= 2 || row.barcode || row.internalCode);
}

export interface UpdateProductFieldsInput {
  merchantId: string;
  productId: string;
  /** Somente os campos presentes (!== undefined) são alterados — atualização parcial. */
  name?: string;
  description?: string | null;
  price?: number;
  isActive?: boolean;
  isFeatured?: boolean;
}

export interface UpdateProductFieldsResult {
  ok: boolean;
  error?: "save_failed" | "not_found" | "no_fields";
}

/**
 * Atualização parcial de produto, reaproveitada pela ferramenta de IA
 * `update_product` (ai/tools/inventory.ts). Diferente de `updateProduct`
 * (Server Action do formulário humano, que sempre substitui o produto
 * inteiro), esta função só toca as colunas explicitamente informadas —
 * evita que a IA apague campos que o lojista não pediu para mudar.
 * Reaplica a mesma regra de negócio de `updateProduct`: desativar o produto
 * zera o estoque automaticamente.
 */
export async function updateProductFieldsCore(
  supabase: SupabaseClient<Database>,
  input: UpdateProductFieldsInput,
): Promise<UpdateProductFieldsResult> {
  const updateRow: Database["public"]["Tables"]["products"]["Update"] = {};
  if (input.name !== undefined) updateRow.name = input.name;
  if (input.description !== undefined) updateRow.description = input.description;
  if (input.price !== undefined) updateRow.price = input.price;
  if (input.isFeatured !== undefined) updateRow.is_featured = input.isFeatured;
  if (input.isActive !== undefined) {
    updateRow.is_active = input.isActive;
    if (!input.isActive) {
      updateRow.track_stock = false;
      updateRow.stock_quantity = 0;
    }
  }

  if (Object.keys(updateRow).length === 0) {
    return { ok: false, error: "no_fields" };
  }

  const { data, error } = await supabase
    .from("products")
    .update(updateRow)
    .eq("merchant_id", input.merchantId)
    .eq("id", input.productId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("updateProductFieldsCore: update failed", {
      code: error.code,
      message: error.message,
      details: (error as { details?: string | null }).details,
    });
    return { ok: false, error: "save_failed" };
  }

  if (!data) {
    return { ok: false, error: "not_found" };
  }

  return { ok: true };
}

export async function createMenuCategory(formData: FormData): Promise<void> {
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const description = (formData.get("description") as string | null)?.trim() ?? "";
  const menuId = (formData.get("menu_id") as string | null)?.trim() ?? "";

  const redirectBase = getRedirectBase(formData);

  const { supabase, merchant } = await requireProductsAccess();

  if (!menuId || name.length < 2) {
    redirect(`${redirectBase}?error=invalid_category`);
  }

  const { data, error } = await supabase
    .from("menu_categories")
    .insert({
      merchant_id: merchant.id,
      menu_id: menuId,
      name,
      description: description || null,
      is_active: true,
      display_order: 0,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    redirect(`${redirectBase}?error=category_create_failed`);
  }

  redirect(`${redirectBase}?category=${encodeURIComponent(data.id)}`);
}

export async function createSuggestedMenuCategories(formData: FormData): Promise<void> {
  const menuId = (formData.get("menu_id") as string | null)?.trim() ?? "";

  const redirectBase = getRedirectBase(formData);

  const { supabase, merchant } = await requireProductsAccess();

  if (!menuId) {
    redirect(`${redirectBase}?error=invalid_menu`);
  }

  const suggestions = getSuggestedCategories(merchant.business_category);

  const { data: existing } = await supabase
    .from("menu_categories")
    .select("name")
    .eq("merchant_id", merchant.id)
    .eq("menu_id", menuId);

  const existingNames = new Set((existing ?? []).map((c) => c.name.toLowerCase()));

  const toInsert = suggestions
    .filter((n) => !existingNames.has(n.toLowerCase()))
    .map((n, idx) => ({
      merchant_id: merchant.id,
      menu_id: menuId,
      name: n,
      description: null,
      is_active: true,
      display_order: idx,
    }));

  if (toInsert.length > 0) {
    await supabase.from("menu_categories").insert(toInsert);
  }

  redirect(redirectBase);
}

export async function createProduct(formData: FormData): Promise<void> {
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const barcode = (formData.get("barcode") as string | null)?.trim() ?? "";
  const internalCode = (formData.get("internal_code") as string | null)?.trim() ?? "";
  const description = (formData.get("description") as string | null)?.trim() ?? "";
  const priceRaw = (formData.get("price") as string | null)?.trim() ?? "";
  const costPriceRaw = (formData.get("cost_price") as string | null)?.trim() ?? "";
  const imageUrl = (formData.get("image_url") as string | null)?.trim() ?? "";
  const imageFile = formData.get("image_file");
  const menuId = (formData.get("menu_id") as string | null)?.trim() ?? "";
  const categoryId = (formData.get("category_id") as string | null)?.trim() ?? "";
  const unitLabelRaw = (formData.get("unit_label") as string | null)?.trim() ?? "";
  const requiresPrescription = (formData.get("requires_prescription") as string | null) === "on";
  const requiresDocument = (formData.get("requires_document") as string | null) === "on";
  const trackStock = (formData.get("track_stock") as string | null) === "on";
  const stockQty = clampDecimalFromForm(formData.get("stock_quantity"), 0, 1_000_000, 3);

  const returnTo = getSafeReturnTo(formData);
  const redirectBase = getRedirectBase(formData);

  const { supabase, merchant, isOwner } = await requireProductsAccess();

  if (!menuId || name.length < 2) {
    redirect(withQueryParam(returnTo, "error", "invalid_product"));
  }

  // Validate optional image file early so we don't create the product if it's invalid.
  if (imageFile instanceof File && imageFile.size > 0) {
    if (!isProbablyImageFile(imageFile)) {
      redirect(withQueryParam(returnTo, "error", "image_type"));
    }
    if (imageFile.size > MAX_PRODUCT_IMAGE_BYTES) {
      redirect(withQueryParam(returnTo, "error", "image_too_large"));
    }
  }

  const price = parsePriceBR(priceRaw || "0");
  const costPrice = parsePriceBR(costPriceRaw || "0");

  const insertRow: Database["public"]["Tables"]["products"]["Insert"] = {
    merchant_id: merchant.id,
    menu_id: menuId,
    category_id: categoryId || null,
    internal_code: internalCode || null,
    barcode: barcode || null,
    name,
    description: description || null,
    image_url: imageUrl || null,
    price,
    cost_price: costPrice,
    avg_cost: costPrice,
    unit_label: normalizeUnitLabel(unitLabelRaw),
    is_active: true,
    is_featured: false,
    requires_prescription: requiresPrescription,
    requires_document: requiresDocument,
    display_order: 0,
  };

  // Estoque é controle apenas do dono.
  if (isOwner) {
    insertRow.track_stock = trackStock;
    insertRow.stock_quantity = trackStock ? (stockQty ?? 0) : 0;
  }

  const { data, error } = await supabase
    .from("products")
    .insert(insertRow)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    redirect(withQueryParam(returnTo, "error", "product_create_failed"));
  }

  // Optional: if a file was provided, upload it and persist the public URL.
  if (imageFile instanceof File && imageFile.size > 0) {
    const ext = getFileExtension(imageFile);
    const path = `${merchant.id}/${data.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const bytes = new Uint8Array(await imageFile.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(path, bytes, {
        upsert: true,
        contentType: guessImageContentType(imageFile),
      });

    if (uploadError) {
      redirect(`${redirectBase}/${encodeURIComponent(data.id)}?error=image_upload_failed`);
    }

    const { data: urlData } = supabase.storage
      .from("product-images")
      .getPublicUrl(path);

    await supabase
      .from("products")
      .update({ image_url: urlData.publicUrl })
      .eq("id", data.id)
      .eq("merchant_id", merchant.id);
  }

  redirect(withQueryParam(returnTo, "created", "1"));
}

export async function createQuickProduct(formData: FormData): Promise<void> {
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const barcode = (formData.get("barcode") as string | null)?.trim() ?? "";
  const internalCode = (formData.get("internal_code") as string | null)?.trim() ?? "";
  const priceRaw = (formData.get("price") as string | null)?.trim() ?? "";
  const costPriceRaw = (formData.get("cost_price") as string | null)?.trim() ?? "";
  const menuId = (formData.get("menu_id") as string | null)?.trim() ?? "";
  const categoryId = (formData.get("category_id") as string | null)?.trim() ?? "";
  const unitLabelRaw = (formData.get("unit_label") as string | null)?.trim() ?? "";
  const trackStock = (formData.get("track_stock") as string | null) === "on";
  const stockQty = clampDecimalFromForm(formData.get("stock_quantity"), 0, 1_000_000, 3);

  const returnTo = getSafeReturnTo(formData);

  const { supabase, merchant, isOwner } = await requireProductsAccess();

  if (!menuId || name.length < 2) {
    redirect(withQueryParam(returnTo, "error", "invalid_product"));
  }

  const price = parsePriceBR(priceRaw || "0");
  const costPrice = parsePriceBR(costPriceRaw || "0");

  const insertRow: Database["public"]["Tables"]["products"]["Insert"] = {
    merchant_id: merchant.id,
    menu_id: menuId,
    category_id: categoryId || null,
    internal_code: internalCode || null,
    barcode: barcode || null,
    name,
    description: null,
    image_url: null,
    price,
    cost_price: costPrice,
    avg_cost: costPrice,
    unit_label: normalizeUnitLabel(unitLabelRaw),
    is_active: true,
    is_featured: false,
    requires_prescription: false,
    requires_document: false,
    display_order: 0,
  };

  if (isOwner) {
    insertRow.track_stock = trackStock;
    insertRow.stock_quantity = trackStock ? (stockQty ?? 0) : 0;
  }

  const { error } = await supabase.from("products").insert(insertRow);

  if (error) {
    console.error("createQuickProduct failed", {
      code: error.code,
      message: error.message,
      details: (error as { details?: string | null }).details,
    });
    redirect(withQueryParam(returnTo, "error", "quick_product_create_failed"));
  }

  redirect(withQueryParam(returnTo, "quick", "1"));
}

export async function importProductsSpreadsheet(formData: FormData): Promise<void> {
  const file = formData.get("spreadsheet_file");
  const menuId = (formData.get("menu_id") as string | null)?.trim() ?? "";
  const defaultCategoryId = (formData.get("default_category_id") as string | null)?.trim() ?? "";
  const rawMode = (formData.get("import_mode") as string | null)?.trim() ?? "create_update";
  const mode: SpreadsheetImportMode =
    rawMode === "create_only" || rawMode === "update_only" ? rawMode : "create_update";

  const returnTo = getSafeReturnTo(formData);

  if (!(file instanceof File) || file.size === 0 || !menuId) {
    redirect(withQueryParam(returnTo, "error", "invalid_import_file"));
  }

  const { supabase, merchant, isOwner } = await requireProductsAccess();
  if (!isOwner) {
    redirect("/dashboard");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const rows = readSpreadsheetRows(bytes);

  if (rows.length === 0) {
    redirect(withQueryParam(returnTo, "error", "invalid_import_file"));
  }

  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase
      .from("menu_categories")
      .select("id, name")
      .eq("merchant_id", merchant.id)
      .eq("menu_id", menuId),
    supabase
      .from("products")
      .select("id, name, barcode, internal_code")
      .eq("merchant_id", merchant.id)
      .eq("menu_id", menuId),
  ]);

  const categoryByNormalizedName = new Map(
    (categories ?? []).map((category) => [normalizeLookupText(category.name), category.id]),
  );

  const missingCategoryNames = Array.from(
    new Set(
      rows
        .map((row) => row.categoryName)
        .filter((value): value is string => Boolean(value?.trim()))
        .filter((value) => !categoryByNormalizedName.has(normalizeLookupText(value))),
    ),
  );

  if (missingCategoryNames.length > 0) {
    const { data: insertedCategories } = await supabase
      .from("menu_categories")
      .insert(
        missingCategoryNames.map((name, index) => ({
          merchant_id: merchant.id,
          menu_id: menuId,
          name,
          description: null,
          is_active: true,
          display_order: (categories?.length ?? 0) + index,
        })),
      )
      .select("id, name");

    for (const category of insertedCategories ?? []) {
      categoryByNormalizedName.set(normalizeLookupText(category.name), category.id);
    }
  }

  const productByBarcode = new Map<string, { id: string }>();
  const productByInternalCode = new Map<string, { id: string }>();
  const productByName = new Map<string, { id: string }>();

  for (const product of products ?? []) {
    if (product.barcode) productByBarcode.set(product.barcode, { id: product.id });
    if (product.internal_code) productByInternalCode.set(product.internal_code, { id: product.id });
    productByName.set(normalizeLookupText(product.name), { id: product.id });
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const fallbackCategoryId = defaultCategoryId || null;

  for (const row of rows) {
    const normalizedName = normalizeLookupText(row.name);
    const existing =
      (row.barcode ? productByBarcode.get(row.barcode) : undefined) ??
      (row.internalCode ? productByInternalCode.get(row.internalCode) : undefined) ??
      (normalizedName ? productByName.get(normalizedName) : undefined);

    const matchedCategoryId = row.categoryName
      ? categoryByNormalizedName.get(normalizeLookupText(row.categoryName))
      : undefined;
    const categoryId = matchedCategoryId || fallbackCategoryId;

    if (existing) {
      if (mode === "create_only") {
        skipped += 1;
        continue;
      }

      const updateRow: Database["public"]["Tables"]["products"]["Update"] = {
        name: row.name || undefined,
        barcode: row.barcode ?? undefined,
        internal_code: row.internalCode ?? undefined,
        category_id: categoryId,
        unit_label: row.unitLabel ? normalizeUnitLabel(row.unitLabel) : undefined,
        price: row.price ?? undefined,
        cost_price: row.costPrice ?? undefined,
        is_active: row.isActive ?? undefined,
      };

      if (row.trackStock != null) {
        updateRow.track_stock = row.trackStock;
        updateRow.stock_quantity = row.trackStock ? (row.stockQuantity ?? 0) : 0;
      } else if (row.stockQuantity != null) {
        updateRow.track_stock = true;
        updateRow.stock_quantity = row.stockQuantity;
      }

      const { error } = await supabase
        .from("products")
        .update(updateRow)
        .eq("merchant_id", merchant.id)
        .eq("id", existing.id);

      if (error) {
        console.error("importProductsSpreadsheet update failed", {
          code: error.code,
          message: error.message,
          details: (error as { details?: string | null }).details,
          rowName: row.name,
        });
        skipped += 1;
        continue;
      }

      updated += 1;
      continue;
    }

    if (mode === "update_only") {
      skipped += 1;
      continue;
    }

    const insertRow: Database["public"]["Tables"]["products"]["Insert"] = {
      merchant_id: merchant.id,
      menu_id: menuId,
      category_id: categoryId,
      name: row.name,
      barcode: row.barcode,
      internal_code: row.internalCode,
      description: null,
      image_url: null,
      price: row.price ?? 0,
      cost_price: row.costPrice ?? 0,
      avg_cost: row.costPrice ?? 0,
      unit_label: normalizeUnitLabel(row.unitLabel ?? "un"),
      is_active: row.isActive ?? true,
      is_featured: false,
      requires_prescription: false,
      requires_document: false,
      display_order: 0,
      track_stock: row.trackStock ?? row.stockQuantity != null,
      stock_quantity: row.trackStock === false ? 0 : (row.stockQuantity ?? 0),
      stock_min_quantity: 0,
    };

    const { data, error } = await supabase.from("products").insert(insertRow).select("id").maybeSingle();

    if (error || !data) {
      console.error("importProductsSpreadsheet insert failed", {
        code: error?.code,
        message: error?.message,
        details: (error as { details?: string | null } | null)?.details,
        rowName: row.name,
      });
      skipped += 1;
      continue;
    }

    created += 1;
    if (row.barcode) productByBarcode.set(row.barcode, { id: data.id });
    if (row.internalCode) productByInternalCode.set(row.internalCode, { id: data.id });
    if (normalizedName) productByName.set(normalizedName, { id: data.id });
  }

  let nextUrl = withQueryParam(returnTo, "imported", "1");
  nextUrl = withQueryParam(nextUrl, "import_created", String(created));
  nextUrl = withQueryParam(nextUrl, "import_updated", String(updated));
  nextUrl = withQueryParam(nextUrl, "import_skipped", String(skipped));
  redirect(nextUrl);
}

export async function updateProduct(formData: FormData): Promise<void> {
  const productId = (formData.get("product_id") as string | null)?.trim() ?? "";
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const barcode = (formData.get("barcode") as string | null)?.trim() ?? "";
  const description = (formData.get("description") as string | null)?.trim() ?? "";
  const priceRaw = (formData.get("price") as string | null)?.trim() ?? "";
  const imageUrl = (formData.get("image_url") as string | null)?.trim() ?? "";
  const categoryId = (formData.get("category_id") as string | null)?.trim() ?? "";
  const unitLabelRaw = (formData.get("unit_label") as string | null)?.trim() ?? "";
  const isActive = (formData.get("is_active") as string | null) === "on";
  const isFeatured = (formData.get("is_featured") as string | null) === "on";
  const requiresPrescription = (formData.get("requires_prescription") as string | null) === "on";
  const requiresDocument = (formData.get("requires_document") as string | null) === "on";
  const trackStock = (formData.get("track_stock") as string | null) === "on";
  const stockQty = clampDecimalFromForm(formData.get("stock_quantity"), 0, 1_000_000, 3);

  const redirectBase = getRedirectBase(formData);

  const { supabase, merchant, isOwner } = await requireProductsAccess();

  if (!productId || name.length < 2) {
    redirect(`${redirectBase}?error=invalid_product`);
  }

  const price = parsePriceBR(priceRaw || "0");

  const updateRow: Database["public"]["Tables"]["products"]["Update"] = {
    name,
    description: description || null,
    price,
    image_url: imageUrl || null,
    unit_label: unitLabelRaw ? normalizeUnitLabel(unitLabelRaw) : undefined,
    category_id: categoryId || null,
    barcode: barcode || null,
    is_active: isActive,
    is_featured: isFeatured,
    requires_prescription: requiresPrescription,
    requires_document: requiresDocument,
  };

  // Se o item for desativado, remove do estoque automaticamente.
  if (!isActive) {
    updateRow.track_stock = false;
    updateRow.stock_quantity = 0;
  } else if (isOwner) {
    // Estoque só pode ser alterado pelo dono.
    updateRow.track_stock = trackStock;
    updateRow.stock_quantity = trackStock ? (stockQty ?? 0) : 0;
  }

  const { error } = await supabase
    .from("products")
    .update(updateRow)
    .eq("id", productId)
    .eq("merchant_id", merchant.id);

  if (error) {
    redirect(`${redirectBase}/${encodeURIComponent(productId)}?error=save_failed`);
  }

  redirect(`${redirectBase}/${encodeURIComponent(productId)}?saved=1`);
}

export async function uploadProductImage(formData: FormData): Promise<void> {
  const productId = (formData.get("product_id") as string | null)?.trim() ?? "";
  const file = formData.get("image_file");

  const redirectBase = getRedirectBase(formData);

  if (!productId) {
    redirect(`${redirectBase}?error=invalid_product`);
  }

  if (!(file instanceof File)) {
    redirect(`${redirectBase}/${encodeURIComponent(productId)}?error=image_missing`);
  }

  if (!isProbablyImageFile(file)) {
    redirect(`${redirectBase}/${encodeURIComponent(productId)}?error=image_type`);
  }

  // Guardrail to avoid oversized uploads.
  if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
    redirect(`${redirectBase}/${encodeURIComponent(productId)}?error=image_too_large`);
  }

  const { supabase, merchant } = await requireProductsAccess();

  // Ensure the product belongs to this merchant (defense-in-depth beyond RLS).
  const { data: product } = await supabase
    .from("products")
    .select("id, merchant_id")
    .eq("id", productId)
    .eq("merchant_id", merchant.id)
    .maybeSingle();

  if (!product) {
    redirect(`${redirectBase}?error=invalid_product`);
  }

  const ext = getFileExtension(file);
  const path = `${merchant.id}/${productId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(path, bytes, {
      upsert: true,
      contentType: guessImageContentType(file),
    });

  if (uploadError) {
    const message =
      typeof (uploadError as { message?: unknown } | null)?.message === "string"
        ? (uploadError as { message: string }).message
        : "";
    const msg = message.toLowerCase();
    if (msg.includes("bucket") && msg.includes("not")) {
      redirect(`${redirectBase}/${encodeURIComponent(productId)}?error=bucket_missing`);
    }
    redirect(`${redirectBase}/${encodeURIComponent(productId)}?error=image_upload_failed`);
  }

  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  const publicUrl = data.publicUrl;

  const { error: updateError } = await supabase
    .from("products")
    .update({ image_url: publicUrl })
    .eq("id", productId)
    .eq("merchant_id", merchant.id);

  if (updateError) {
    redirect(`${redirectBase}/${encodeURIComponent(productId)}?error=save_failed`);
  }

  redirect(`${redirectBase}/${encodeURIComponent(productId)}?saved=1`);
}

export async function deleteProduct(formData: FormData): Promise<void> {
  const productId = (formData.get("product_id") as string | null)?.trim() ?? "";
  const redirectBase = getRedirectBase(formData);
  const returnTo = getSafeReturnTo(formData);
  if (!productId) redirect(redirectBase);

  const { supabase, merchant, isOwner } = await requireProductsAccess();
  if (!isOwner) {
    redirect("/dashboard");
  }

  await supabase.from("products").delete().eq("id", productId).eq("merchant_id", merchant.id);
  redirect(withQueryParam(returnTo, "removed", "1"));
}
