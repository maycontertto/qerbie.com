"use server";

import { redirect } from "next/navigation";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";

function cleanText(value: FormDataEntryValue | null, maxLen: number): string | null {
  const raw = value == null ? "" : String(value).trim();
  if (!raw) return null;
  return raw.slice(0, maxLen);
}

function cleanEmail(value: FormDataEntryValue | null): string | null {
  const email = cleanText(value, 120);
  if (!email) return null;
  // validação leve (evita bloquear casos reais)
  if (!email.includes("@") || !email.includes(".")) return null;
  return email;
}

function cleanUrl(value: FormDataEntryValue | null): string | null {
  const url = cleanText(value, 300);
  if (!url) return null;
  // Exige http/https para não gerar links quebrados
  if (!/^https?:\/\//i.test(url)) return null;
  return url;
}

export async function saveSupportContact(formData: FormData): Promise<void> {
  const whatsappUrl = cleanUrl(formData.get("support_whatsapp_url"));
  const hours = cleanText(formData.get("support_hours"), 200);
  const email = cleanEmail(formData.get("support_email"));
  const phone = cleanText(formData.get("support_phone"), 60);

  const { supabase, user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const ok =
    isOwner ||
    (membership
      ? hasMemberPermission(membership.role, membership.permissions, "dashboard_support")
      : false);
  if (!ok) {
    redirect("/dashboard");
  }

  const { error } = await supabase
    .from("merchants")
    .update({
      support_whatsapp_url: whatsappUrl,
      support_hours: hours,
      support_email: email,
      support_phone: phone,
    })
    .eq("id", merchant.id);

  if (error) {
    console.error("saveSupportContact: update failed", {
      code: error.code,
      message: error.message,
      details: (error as { details?: string | null }).details,
    });
    redirect("/dashboard/modulos/suporte?error=save_failed");
  }

  redirect("/dashboard/modulos/suporte?saved=1");
}
