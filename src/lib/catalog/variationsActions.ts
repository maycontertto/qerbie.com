"use server";

import { redirect } from "next/navigation";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import type { OptionGroupSelectionType } from "@/lib/supabase/database.types";

function moneyToNumber(raw: FormDataEntryValue | null): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const normalized = s.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

function clampInt(raw: FormDataEntryValue | null, min: number, max: number): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const n = Math.trunc(Number(s));
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, n));
}

async function requireCatalogPermission() {
  const { supabase, user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const canCatalog =
    isOwner ||
    (membership
      ? hasMemberPermission(membership.role, membership.permissions, "dashboard_products")
      : false);
  if (!canCatalog) redirect("/dashboard");
  return { supabase, merchant };
}

export async function createProductOptionGroup(formData: FormData): Promise<void> {
  const { supabase, merchant } = await requireCatalogPermission();
  const productId = String(formData.get("product_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const selectionType = String(formData.get("selection_type") ?? "single") as OptionGroupSelectionType;
  const isRequired = formData.get("is_required") === "on";
  const minSel = clampInt(formData.get("min_selections"), 0, 50) ?? 0;
  const maxSel = clampInt(formData.get("max_selections"), 1, 50) ?? 1;

  if (!productId || !name) redirect("/dashboard/modulos/variacoes?error=invalid");

  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("merchant_id", merchant.id)
    .eq("id", productId)
    .maybeSingle();

  if (!product) redirect("/dashboard/modulos/variacoes?error=invalid");

  const { error } = await supabase.from("product_option_groups").insert({
    merchant_id: merchant.id,
    product_id: productId,
    name: name.slice(0, 120),
    selection_type: selectionType === "multiple" ? "multiple" : "single",
    is_required: isRequired,
    min_selections: minSel,
    max_selections: Math.max(maxSel, minSel === 0 ? 1 : minSel),
    display_order: 0,
  });

  if (error) {
    console.error("createProductOptionGroup failed", { code: error.code, message: error.message });
    redirect(`/dashboard/modulos/variacoes?productId=${encodeURIComponent(productId)}&error=save_failed`);
  }

  redirect(`/dashboard/modulos/variacoes?productId=${encodeURIComponent(productId)}&saved=1`);
}

export async function updateProductOptionGroup(formData: FormData): Promise<void> {
  const { supabase, merchant } = await requireCatalogPermission();
  const id = String(formData.get("id") ?? "").trim();
  const productId = String(formData.get("product_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const selectionType = String(formData.get("selection_type") ?? "single") as OptionGroupSelectionType;
  const isRequired = formData.get("is_required") === "on";
  const minSel = clampInt(formData.get("min_selections"), 0, 50);
  const maxSel = clampInt(formData.get("max_selections"), 1, 50);

  if (!id || !productId) redirect("/dashboard/modulos/variacoes?error=invalid");

  const update: {
    name?: string;
    selection_type?: OptionGroupSelectionType;
    is_required?: boolean;
    min_selections?: number;
    max_selections?: number;
  } = {
    is_required: isRequired,
    selection_type: selectionType === "multiple" ? "multiple" : "single",
  };

  if (name) update.name = name.slice(0, 120);
  if (minSel != null) update.min_selections = minSel;
  if (maxSel != null) update.max_selections = maxSel;

  const { error } = await supabase
    .from("product_option_groups")
    .update(update)
    .eq("merchant_id", merchant.id)
    .eq("id", id);

  if (error) {
    console.error("updateProductOptionGroup failed", { code: error.code, message: error.message });
    redirect(`/dashboard/modulos/variacoes?productId=${encodeURIComponent(productId)}&error=save_failed`);
  }

  redirect(`/dashboard/modulos/variacoes?productId=${encodeURIComponent(productId)}&saved=1`);
}

export async function createProductOption(formData: FormData): Promise<void> {
  const { supabase, merchant } = await requireCatalogPermission();
  const groupId = String(formData.get("option_group_id") ?? "").trim();
  const productId = String(formData.get("product_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const priceModifier = moneyToNumber(formData.get("price_modifier")) ?? 0;

  if (!groupId || !productId || !name) redirect("/dashboard/modulos/variacoes?error=invalid");

  const { data: group } = await supabase
    .from("product_option_groups")
    .select("id")
    .eq("merchant_id", merchant.id)
    .eq("id", groupId)
    .maybeSingle();

  if (!group) redirect(`/dashboard/modulos/variacoes?productId=${encodeURIComponent(productId)}&error=invalid`);

  const { error } = await supabase.from("product_options").insert({
    merchant_id: merchant.id,
    option_group_id: groupId,
    name: name.slice(0, 120),
    price_modifier: priceModifier,
    is_active: true,
    display_order: 0,
  });

  if (error) {
    console.error("createProductOption failed", { code: error.code, message: error.message });
    redirect(`/dashboard/modulos/variacoes?productId=${encodeURIComponent(productId)}&error=save_failed`);
  }
  redirect(`/dashboard/modulos/variacoes?productId=${encodeURIComponent(productId)}&saved=1`);
}

export async function updateProductOption(formData: FormData): Promise<void> {
  const { supabase, merchant } = await requireCatalogPermission();
  const id = String(formData.get("id") ?? "").trim();
  const productId = String(formData.get("product_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const priceModifier = moneyToNumber(formData.get("price_modifier"));
  const isActive = formData.get("is_active") === "on";

  if (!id || !productId) redirect("/dashboard/modulos/variacoes?error=invalid");

  const update: {
    name?: string;
    price_modifier?: number;
    is_active?: boolean;
  } = {
    is_active: isActive,
  };

  if (name) update.name = name.slice(0, 120);
  if (priceModifier != null) update.price_modifier = priceModifier;

  const { error } = await supabase
    .from("product_options")
    .update(update)
    .eq("merchant_id", merchant.id)
    .eq("id", id);

  if (error) {
    console.error("updateProductOption failed", { code: error.code, message: error.message });
    redirect(`/dashboard/modulos/variacoes?productId=${encodeURIComponent(productId)}&error=save_failed`);
  }
  redirect(`/dashboard/modulos/variacoes?productId=${encodeURIComponent(productId)}&saved=1`);
}
