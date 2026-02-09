"use server";

import { redirect } from "next/navigation";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";

async function requireDashboardSales() {
  const { supabase, user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const ok =
    isOwner ||
    (membership
      ? hasMemberPermission(membership.role, membership.permissions, "dashboard_sales")
      : false);

  if (!ok) {
    redirect("/dashboard");
  }

  return { supabase, user, merchant, membership, isOwner };
}

function normalizeUrl(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  try {
    const url = new URL(v);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function updateMerchantPaymentSettings(formData: FormData) {
  const pixKey = String(formData.get("payment_pix_key") ?? "").trim();
  const pixDesc = String(formData.get("payment_pix_description") ?? "").trim();
  const cardUrlRaw = String(formData.get("payment_card_url") ?? "");
  const cardDesc = String(formData.get("payment_card_description") ?? "").trim();
  const cashDesc = String(formData.get("payment_cash_description") ?? "").trim();
  const disclaimerRaw = String(formData.get("payment_disclaimer") ?? "").trim();

  const payment_pix_key = pixKey ? pixKey.slice(0, 120) : null;
  const payment_pix_description = pixDesc ? pixDesc.slice(0, 200) : null;
  const payment_card_url = normalizeUrl(cardUrlRaw);
  const payment_card_description = cardDesc ? cardDesc.slice(0, 200) : null;
  const payment_cash_description = cashDesc ? cashDesc.slice(0, 200) : null;
  const payment_disclaimer = disclaimerRaw ? disclaimerRaw.slice(0, 300) : null;

  const { supabase, merchant } = await requireDashboardSales();

  const { error } = await supabase
    .from("merchants")
    .update({
      payment_pix_key,
      payment_pix_description,
      payment_card_url,
      payment_card_description,
      payment_cash_description,
      payment_disclaimer,
    })
    .eq("id", merchant.id);

  if (error) {
    redirect("/dashboard/modulos/vendas?error=save_failed");
  }

  redirect("/dashboard/modulos/vendas?saved=1");
}
