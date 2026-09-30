"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";

const MENUS_PATH = "/dashboard/modulos/menus";

async function requireMenuAccess() {
  const { supabase, user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const canManage = isOwner || (membership
    ? hasMemberPermission(membership.role, membership.permissions, "dashboard_products")
    : false);
  if (!canManage) redirect("/dashboard");
  return { supabase, merchant };
}

function toSlug(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "menu";
}

export async function createMenu(formData: FormData): Promise<void> {
  const { supabase, merchant } = await requireMenuAccess();
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const description = String(formData.get("description") ?? "").trim().slice(0, 500);
  if (name.length < 2) redirect(`${MENUS_PATH}?error=invalid`);

  const baseSlug = toSlug(name);
  const { data: existing } = await supabase.from("menus").select("slug")
    .eq("merchant_id", merchant.id).ilike("slug", `${baseSlug}%`).limit(30);
  const slugs = new Set((existing ?? []).map((menu) => menu.slug));
  let slug = baseSlug;
  if (slugs.has(slug)) slug = `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;

  const { error } = await supabase.from("menus").insert({
    merchant_id: merchant.id,
    name,
    description: description || null,
    slug,
    is_active: true,
    display_order: 0,
  });
  if (error) {
    console.error("createMenu failed", { code: error.code });
    redirect(`${MENUS_PATH}?error=save_failed`);
  }
  revalidatePath(MENUS_PATH);
  revalidatePath("/dashboard/modulos/produtos");
  redirect(`${MENUS_PATH}?saved=1`);
}

export async function updateMenu(formData: FormData): Promise<void> {
  const { supabase, merchant } = await requireMenuAccess();
  const id = String(formData.get("menu_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const description = String(formData.get("description") ?? "").trim().slice(0, 500);
  const isActive = formData.get("is_active") === "on";
  if (!id || name.length < 2) redirect(`${MENUS_PATH}?error=invalid`);

  const { data: existing } = await supabase.from("menus").select("id,slug")
    .eq("merchant_id", merchant.id).eq("id", id).maybeSingle();
  if (!existing) redirect(`${MENUS_PATH}?error=invalid`);

  let slug = toSlug(name);
  const { data: duplicate } = await supabase.from("menus").select("id")
    .eq("merchant_id", merchant.id).eq("slug", slug).neq("id", id).maybeSingle();
  if (duplicate) slug = `${slug}-${crypto.randomUUID().slice(0, 8)}`;

  const { error } = await supabase.from("menus").update({
    name,
    description: description || null,
    slug,
    is_active: isActive,
  }).eq("merchant_id", merchant.id).eq("id", id);
  if (error) {
    console.error("updateMenu failed", { code: error.code });
    redirect(`${MENUS_PATH}?error=save_failed`);
  }
  revalidatePath(MENUS_PATH);
  revalidatePath("/dashboard/modulos/produtos");
  redirect(`${MENUS_PATH}?saved=1`);
}
