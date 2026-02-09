"use server";

import { revalidatePath } from "next/cache";
import { getMerchantMemberOrRedirect } from "@/lib/auth/guard";

const ALLOWED_STATUSES = [
  "confirmed",
  "preparing",
  "ready",
  "completed",
  "cancelled",
] as const;

type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

function isAllowedStatus(value: string): value is AllowedStatus {
  return (ALLOWED_STATUSES as readonly string[]).includes(value);
}

export async function setOrderStatus(formData: FormData): Promise<void> {
  const orderId = (formData.get("order_id") as string | null)?.trim() ?? "";
  const next = (formData.get("status") as string | null)?.trim() ?? "";

  if (!orderId || !next || !isAllowedStatus(next)) {
    return;
  }

  const { supabase, merchant, membership, user } = await getMerchantMemberOrRedirect();

  const isOwner = user.id === merchant.owner_user_id;
  const isManager = membership?.role === "admin";

  // Staff rules: atendente pode avançar o pedido, mas não cancelar.
  if (!isOwner && !isManager && next === "cancelled") {
    return;
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: next };

  if (next === "confirmed") patch.confirmed_at = now;
  if (next === "ready") patch.ready_at = now;
  if (next === "completed") patch.completed_at = now;
  if (next === "cancelled") patch.cancelled_at = now;

  if (next === "completed") {
    patch.completed_by_user_id = user.id;
  }

  await supabase
    .from("orders")
    .update(patch)
    .eq("id", orderId)
    .eq("merchant_id", merchant.id);

  revalidatePath("/dashboard/modulos/pedidos");
  revalidatePath("/atendente/pedidos");
}
