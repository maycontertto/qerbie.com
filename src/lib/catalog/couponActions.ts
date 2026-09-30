"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";

const PATH = "/dashboard/modulos/cupons";

async function requireSalesAccess() {
  const { supabase, user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const canManage = isOwner || (membership
    ? hasMemberPermission(membership.role, membership.permissions, "dashboard_sales")
    : false);
  if (!canManage) redirect("/dashboard");
  return { supabase, merchant };
}

function parseMoney(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim().replace(/\s/g, "");
  if (!raw) return 0;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : null;
}

function parseDate(value: FormDataEntryValue | null): string | null | false {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? false : date.toISOString();
}

function readCoupon(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim().toUpperCase().replace(/\s+/g, "");
  const description = String(formData.get("description") ?? "").trim().slice(0, 240);
  const discountType = String(formData.get("discount_type") ?? "percent");
  const discountValue = parseMoney(formData.get("discount_value"));
  const minimumSubtotal = parseMoney(formData.get("minimum_subtotal"));
  const validFrom = parseDate(formData.get("valid_from"));
  const validUntil = parseDate(formData.get("valid_until"));
  if (!/^[A-Z0-9_-]{3,32}$/.test(code) || !["percent", "fixed"].includes(discountType)) return null;
  if (discountValue == null || discountValue <= 0 || (discountType === "percent" && discountValue > 100)) return null;
  if (minimumSubtotal == null || validFrom === false || validUntil === false) return null;
  if (validFrom && validUntil && new Date(validUntil) <= new Date(validFrom)) return null;
  return { code, description: description || null, discount_type: discountType, discount_value: discountValue, minimum_subtotal: minimumSubtotal, valid_from: validFrom, valid_until: validUntil };
}

export async function createCoupon(formData: FormData): Promise<void> {
  const { supabase, merchant } = await requireSalesAccess();
  const coupon = readCoupon(formData);
  if (!coupon) redirect(`${PATH}?error=invalid`);
  const { error } = await supabase.from("coupons").insert({ ...coupon, merchant_id: merchant.id, is_active: true });
  if (error) {
    console.error("createCoupon failed", { code: error.code });
    redirect(`${PATH}?error=${error.code === "23505" ? "duplicate" : "save_failed"}`);
  }
  revalidatePath(PATH);
  redirect(`${PATH}?saved=1`);
}

export async function updateCoupon(formData: FormData): Promise<void> {
  const { supabase, merchant } = await requireSalesAccess();
  const id = String(formData.get("coupon_id") ?? "").trim();
  const coupon = readCoupon(formData);
  if (!id || !coupon) redirect(`${PATH}?error=invalid`);
  const { error } = await supabase.from("coupons").update({
    ...coupon,
    is_active: formData.get("is_active") === "on",
  }).eq("merchant_id", merchant.id).eq("id", id);
  if (error) {
    console.error("updateCoupon failed", { code: error.code });
    redirect(`${PATH}?error=${error.code === "23505" ? "duplicate" : "save_failed"}`);
  }
  revalidatePath(PATH);
  redirect(`${PATH}?saved=1`);
}
