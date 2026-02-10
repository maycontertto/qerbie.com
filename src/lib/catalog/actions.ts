"use server";

import { redirect } from "next/navigation";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import type { Database } from "@/lib/supabase/database.types";
import { getSuggestedCategories } from "@/lib/catalog/templates";

function getRedirectBase(formData: FormData): "/dashboard/modulos/produtos" | "/dashboard/modulos/servicos" {
  const raw = (formData.get("redirect_to") as string | null)?.trim() ?? "";
  if (raw === "/dashboard/modulos/servicos") return raw;
  return "/dashboard/modulos/produtos";
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

function clampIntFromForm(
  value: FormDataEntryValue | null,
  min: number,
  max: number,
): number | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const n = Math.trunc(Number(s));
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, n));
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
  const description = (formData.get("description") as string | null)?.trim() ?? "";
  const priceRaw = (formData.get("price") as string | null)?.trim() ?? "";
  const imageUrl = (formData.get("image_url") as string | null)?.trim() ?? "";
  const imageFile = formData.get("image_file");
  const menuId = (formData.get("menu_id") as string | null)?.trim() ?? "";
  const categoryId = (formData.get("category_id") as string | null)?.trim() ?? "";
  const requiresPrescription = (formData.get("requires_prescription") as string | null) === "on";
  const requiresDocument = (formData.get("requires_document") as string | null) === "on";
  const trackStock = (formData.get("track_stock") as string | null) === "on";
  const stockQty = clampIntFromForm(formData.get("stock_quantity"), 0, 1_000_000);

  const redirectBase = getRedirectBase(formData);

  const { supabase, merchant, isOwner } = await requireProductsAccess();

  if (!menuId || name.length < 2) {
    redirect(`${redirectBase}?error=invalid_product`);
  }

  const price = parsePriceBR(priceRaw || "0");

  const insertRow: Database["public"]["Tables"]["products"]["Insert"] = {
    merchant_id: merchant.id,
    menu_id: menuId,
    category_id: categoryId || null,
    name,
    description: description || null,
    image_url: imageUrl || null,
    price,
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
    redirect(`${redirectBase}?error=product_create_failed`);
  }

  // Optional: if a file was provided, upload it and persist the public URL.
  if (imageFile instanceof File && imageFile.size > 0) {
    if (!imageFile.type.startsWith("image/")) {
      redirect(`${redirectBase}/${encodeURIComponent(data.id)}?error=image_type`);
    }

    if (imageFile.size > 8 * 1024 * 1024) {
      redirect(`${redirectBase}/${encodeURIComponent(data.id)}?error=image_too_large`);
    }

    const ext =
      (imageFile.name.split(".").pop() || "bin")
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 10) || "bin";
    const path = `${merchant.id}/${data.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const bytes = new Uint8Array(await imageFile.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(path, bytes, {
        upsert: true,
        contentType: imageFile.type || "application/octet-stream",
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

  redirect(`${redirectBase}/${encodeURIComponent(data.id)}`);
}

export async function updateProduct(formData: FormData): Promise<void> {
  const productId = (formData.get("product_id") as string | null)?.trim() ?? "";
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const description = (formData.get("description") as string | null)?.trim() ?? "";
  const priceRaw = (formData.get("price") as string | null)?.trim() ?? "";
  const imageUrl = (formData.get("image_url") as string | null)?.trim() ?? "";
  const categoryId = (formData.get("category_id") as string | null)?.trim() ?? "";
  const isActive = (formData.get("is_active") as string | null) === "on";
  const isFeatured = (formData.get("is_featured") as string | null) === "on";
  const requiresPrescription = (formData.get("requires_prescription") as string | null) === "on";
  const requiresDocument = (formData.get("requires_document") as string | null) === "on";
  const trackStock = (formData.get("track_stock") as string | null) === "on";
  const stockQty = clampIntFromForm(formData.get("stock_quantity"), 0, 1_000_000);

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
    category_id: categoryId || null,
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

  if (!file.type.startsWith("image/")) {
    redirect(`${redirectBase}/${encodeURIComponent(productId)}?error=image_type`);
  }

  // 8MB guardrail to avoid oversized uploads.
  if (file.size > 8 * 1024 * 1024) {
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

  const ext = (file.name.split(".").pop() || "bin").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) || "bin";
  const path = `${merchant.id}/${productId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(path, bytes, {
      upsert: true,
      contentType: file.type || "application/octet-stream",
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
  if (!productId) redirect(redirectBase);

  const { supabase, merchant, isOwner } = await requireProductsAccess();
  if (!isOwner) {
    redirect("/dashboard");
  }

  await supabase.from("products").delete().eq("id", productId).eq("merchant_id", merchant.id);
  redirect(redirectBase);
}

export async function createTestProduct(formData: FormData): Promise<void> {
  const menuId = (formData.get("menu_id") as string | null)?.trim() ?? "";
  const preferredCategoryId =
    (formData.get("category_id") as string | null)?.trim() ?? "";

  const { supabase, merchant } = await requireProductsAccess();

  if (!menuId) {
    redirect("/dashboard/modulos/produtos?error=invalid_menu");
  }

  let categoryId = preferredCategoryId;
  if (categoryId) {
    const { data: existing } = await supabase
      .from("menu_categories")
      .select("id")
      .eq("merchant_id", merchant.id)
      .eq("menu_id", menuId)
      .eq("id", categoryId)
      .maybeSingle();
    if (!existing) categoryId = "";
  }

  if (!categoryId) {
    const { data: first } = await supabase
      .from("menu_categories")
      .select("id")
      .eq("merchant_id", merchant.id)
      .eq("menu_id", menuId)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    categoryId = first?.id ?? "";
  }

  if (!categoryId) {
    const { data: created, error: categoryError } = await supabase
      .from("menu_categories")
      .insert({
        merchant_id: merchant.id,
        menu_id: menuId,
        name: "Destaques",
        description: "Sugestões e itens populares",
        is_active: true,
        display_order: 0,
      })
      .select("id")
      .maybeSingle();

    if (categoryError || !created) {
      redirect("/dashboard/modulos/produtos?error=category_create_failed");
    }

    categoryId = created.id;
  }

  const { data: product, error } = await supabase
    .from("products")
    .insert({
      merchant_id: merchant.id,
      menu_id: menuId,
      category_id: categoryId,
      name: "Produto de teste",
      description: "Item criado para testar o fluxo do cliente via QR.",
      image_url: null,
      price: 9.9,
      is_active: true,
      is_featured: true,
      display_order: 0,
    })
    .select("id")
    .maybeSingle();

  if (error || !product) {
    redirect("/dashboard/modulos/produtos?error=product_create_failed");
  }

  redirect(`/dashboard/modulos/produtos/${encodeURIComponent(product.id)}`);
}
