"use server";

import { redirect } from "next/navigation";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { normalizeHexColor } from "@/lib/merchant/branding";

async function requireBrandingAccess() {
  const { supabase, user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const ok =
    isOwner ||
    (membership
      ? hasMemberPermission(membership.role, membership.permissions, "dashboard_branding")
      : false);
  if (!ok) {
    redirect("/dashboard/branding?error=not_allowed");
  }
  return { supabase, merchant };
}

export async function updateBranding(formData: FormData): Promise<void> {
  const displayName = (formData.get("display_name") as string | null)?.trim() ?? "";
  const logoUrl = (formData.get("logo_url") as string | null)?.trim() ?? "";
  const primaryColorRaw = (formData.get("primary_color") as string | null)?.trim() ?? "";
  const welcomeMessage = (formData.get("welcome_message") as string | null)?.trim() ?? "";

  const { supabase, merchant } = await requireBrandingAccess();

  const primaryColor = normalizeHexColor(primaryColorRaw || null);

  // If user typed something but it's invalid, show error.
  if (primaryColorRaw && !primaryColor) {
    redirect("/dashboard/branding?error=invalid_color");
  }

  const payload = {
    brand_display_name: displayName || null,
    brand_logo_url: logoUrl || null,
    brand_primary_color: primaryColor,
    customer_welcome_message: welcomeMessage || null,
  };

  const { error } = await supabase
    .from("merchants")
    .update(payload)
    .eq("id", merchant.id);

  if (error) {
    // Before applying migration 014, this will fail — keep the page usable.
    redirect("/dashboard/branding?error=save_failed");
  }

  redirect("/dashboard/branding?saved=1");
}

export async function uploadBrandLogo(formData: FormData): Promise<void> {
  const file = formData.get("logo_file");

  if (!(file instanceof File)) {
    redirect("/dashboard/branding?error=logo_missing");
  }

  if (!file.type.startsWith("image/")) {
    redirect("/dashboard/branding?error=logo_type");
  }

  // 5MB guardrail.
  if (file.size > 5 * 1024 * 1024) {
    redirect("/dashboard/branding?error=logo_too_large");
  }

  const { supabase, merchant } = await requireBrandingAccess();

  const ext = (file.name.split(".").pop() || "bin")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 10) || "bin";
  const path = `${merchant.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from("brand-logos")
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
      redirect("/dashboard/branding?error=bucket_missing");
    }
    redirect("/dashboard/branding?error=logo_upload_failed");
  }

  const { data } = supabase.storage.from("brand-logos").getPublicUrl(path);
  const publicUrl = data.publicUrl;

  const { error: updateError } = await supabase
    .from("merchants")
    .update({ brand_logo_url: publicUrl })
    .eq("id", merchant.id);

  if (updateError) {
    redirect("/dashboard/branding?error=save_failed");
  }

  redirect("/dashboard/branding?saved=1");
}
