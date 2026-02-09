"use server";

import { redirect } from "next/navigation";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import type { ExchangeRequestStatus } from "@/lib/supabase/database.types";

async function requireOpsPermission() {
  const { supabase, user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const canOps =
    isOwner ||
    (membership
      ? hasMemberPermission(membership.role, membership.permissions, "dashboard_orders")
      : false);
  if (!canOps) redirect("/dashboard");
  return { supabase, merchant };
}

export async function createExchangeRequest(formData: FormData): Promise<void> {
  const { supabase, merchant } = await requireOpsPermission();
  const orderId = String(formData.get("order_id") ?? "").trim();
  const customerNameRaw = String(formData.get("customer_name") ?? "").trim();
  const contactRaw = String(formData.get("contact") ?? "").trim();
  const reasonRaw = String(formData.get("reason") ?? "").trim();
  const notesRaw = String(formData.get("notes") ?? "").trim();

  const customerName = customerNameRaw ? customerNameRaw.slice(0, 120) : null;
  const contact = contactRaw ? contactRaw.slice(0, 200) : null;
  const reason = reasonRaw ? reasonRaw.slice(0, 800) : null;
  const notes = notesRaw ? notesRaw.slice(0, 1200) : null;

  if (!reason && !orderId && !customerName) redirect("/dashboard/modulos/trocas?error=invalid");

  let safeOrderId: string | null = null;
  if (orderId) {
    const { data: order } = await supabase
      .from("orders")
      .select("id")
      .eq("merchant_id", merchant.id)
      .eq("id", orderId)
      .maybeSingle();
    safeOrderId = order?.id ?? null;
  }

  const { error } = await supabase.from("merchant_exchange_requests").insert({
    merchant_id: merchant.id,
    order_id: safeOrderId,
    customer_name: customerName,
    contact,
    reason,
    notes,
    status: "open",
  });

  if (error) {
    console.error("createExchangeRequest failed", { code: error.code, message: error.message });
    redirect("/dashboard/modulos/trocas?error=save_failed");
  }
  redirect("/dashboard/modulos/trocas?saved=1");
}

export async function updateExchangeStatus(formData: FormData): Promise<void> {
  const { supabase, merchant } = await requireOpsPermission();
  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim() as ExchangeRequestStatus;

  if (!id) redirect("/dashboard/modulos/trocas?error=invalid");

  const allowed: ExchangeRequestStatus[] = ["open", "in_progress", "done", "cancelled"];
  if (!allowed.includes(status)) redirect("/dashboard/modulos/trocas?error=invalid");

  const { error } = await supabase
    .from("merchant_exchange_requests")
    .update({ status })
    .eq("merchant_id", merchant.id)
    .eq("id", id);

  if (error) {
    console.error("updateExchangeStatus failed", { code: error.code, message: error.message });
    redirect("/dashboard/modulos/trocas?error=save_failed");
  }
  redirect("/dashboard/modulos/trocas?saved=1");
}
