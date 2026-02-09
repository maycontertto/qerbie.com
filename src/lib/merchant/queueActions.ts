"use server";

import { redirect } from "next/navigation";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";

async function requireReceptionAccess() {
  const { supabase, user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const ok =
    isOwner ||
    (membership
      ? hasMemberPermission(membership.role, membership.permissions, "dashboard_orders")
      : false);

  if (!ok) {
    redirect("/dashboard");
  }

  return { supabase, merchant, isOwner };
}

function parseSmallInt(input: FormDataEntryValue | null, fallback: number | null): number | null {
  if (typeof input !== "string") return fallback;
  const n = Number(input.trim());
  if (!Number.isFinite(n)) return fallback;
  const asInt = Math.trunc(n);
  if (asInt < 0) return 0;
  if (asInt > 1000) return 1000;
  return asInt;
}

export async function createMerchantQueue(formData: FormData): Promise<void> {
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const avg = parseSmallInt(formData.get("avg_service_min"), null);

  const { supabase, merchant } = await requireReceptionAccess();

  if (name.length < 2) {
    redirect("/dashboard/modulos/recepcao?error=invalid_queue");
  }

  const { error } = await supabase.from("merchant_queues").insert({
    merchant_id: merchant.id,
    name,
    status: "open",
    is_active: true,
    avg_service_min: avg,
    display_order: 0,
  });

  if (error) {
    redirect("/dashboard/modulos/recepcao?error=queue_create_failed");
  }

  redirect("/dashboard/modulos/recepcao?saved=1");
}

export async function updateMerchantQueue(formData: FormData): Promise<void> {
  const queueId = (formData.get("queue_id") as string | null)?.trim() ?? "";
  const status = (formData.get("status") as string | null)?.trim() ?? "";
  const isActive = (formData.get("is_active") as string | null) === "on";
  const avg = parseSmallInt(formData.get("avg_service_min"), null);

  const { supabase, merchant } = await requireReceptionAccess();

  if (!queueId) {
    redirect("/dashboard/modulos/recepcao?error=invalid_queue");
  }

  const safeStatus = status === "open" || status === "paused" || status === "closed" ? status : "closed";

  const { error } = await supabase
    .from("merchant_queues")
    .update({ status: safeStatus, is_active: isActive, avg_service_min: avg })
    .eq("id", queueId)
    .eq("merchant_id", merchant.id);

  if (error) {
    redirect(`/dashboard/modulos/recepcao?queue=${encodeURIComponent(queueId)}&error=save_failed`);
  }

  redirect(`/dashboard/modulos/recepcao?queue=${encodeURIComponent(queueId)}&saved=1`);
}

export async function callNextTicket(formData: FormData): Promise<void> {
  const queueId = (formData.get("queue_id") as string | null)?.trim() ?? "";

  const { supabase, merchant } = await requireReceptionAccess();

  if (!queueId) {
    redirect("/dashboard/modulos/recepcao?error=invalid_queue");
  }

  const { data: nextTicket } = await supabase
    .from("queue_tickets")
    .select("id")
    .eq("merchant_id", merchant.id)
    .eq("queue_id", queueId)
    .eq("status", "waiting")
    .order("ticket_number", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!nextTicket) {
    redirect(`/dashboard/modulos/recepcao?queue=${encodeURIComponent(queueId)}&error=no_waiting`);
  }

  const { error } = await supabase
    .from("queue_tickets")
    .update({ status: "called", called_at: new Date().toISOString() })
    .eq("id", nextTicket.id)
    .eq("merchant_id", merchant.id);

  if (error) {
    redirect(`/dashboard/modulos/recepcao?queue=${encodeURIComponent(queueId)}&error=save_failed`);
  }

  redirect(`/dashboard/modulos/recepcao?queue=${encodeURIComponent(queueId)}&saved=1`);
}

export async function setTicketStatus(formData: FormData): Promise<void> {
  const queueId = (formData.get("queue_id") as string | null)?.trim() ?? "";
  const ticketId = (formData.get("ticket_id") as string | null)?.trim() ?? "";
  const status = (formData.get("status") as string | null)?.trim() ?? "";

  const { supabase, merchant } = await requireReceptionAccess();

  if (!queueId || !ticketId) {
    redirect("/dashboard/modulos/recepcao?error=invalid_ticket");
  }

  const allowed = new Set(["waiting", "called", "serving", "completed", "cancelled", "no_show"]);
  const safeStatus = allowed.has(status) ? status : "waiting";

  const patch: Record<string, unknown> = { status: safeStatus };
  const nowIso = new Date().toISOString();
  if (safeStatus === "serving") patch.served_at = nowIso;
  if (safeStatus === "completed") patch.completed_at = nowIso;

  const { error } = await supabase
    .from("queue_tickets")
    .update(patch)
    .eq("id", ticketId)
    .eq("merchant_id", merchant.id)
    .eq("queue_id", queueId);

  if (error) {
    redirect(`/dashboard/modulos/recepcao?queue=${encodeURIComponent(queueId)}&error=save_failed`);
  }

  redirect(`/dashboard/modulos/recepcao?queue=${encodeURIComponent(queueId)}&saved=1`);
}
