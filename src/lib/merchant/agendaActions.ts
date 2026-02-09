"use server";

import { redirect } from "next/navigation";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";

async function requireAgendaPermission() {
  const { supabase, user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const ok =
    isOwner ||
    (membership ? hasMemberPermission(membership.role, membership.permissions, "dashboard_orders") : false);

  if (!ok) {
    redirect("/dashboard");
  }

  return { supabase, user, merchant, membership, isOwner };
}

function parseLocalDateTimeToIso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const d = new Date(trimmed);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

export async function createAppointmentSlot(formData: FormData) {
  const queueIdRaw = String(formData.get("queue_id") ?? "").trim();
  const queueId = queueIdRaw || null;

  const startsAtLocal = String(formData.get("starts_at") ?? "");
  const durationMin = Number(formData.get("duration_min") ?? 0);

  const startsAtIso = parseLocalDateTimeToIso(startsAtLocal);
  if (!startsAtIso || !Number.isFinite(durationMin) || durationMin <= 0 || durationMin > 24 * 60) {
    redirect("/dashboard/modulos/agenda?error=invalid_slot");
  }

  const startsAt = new Date(startsAtIso);
  const endsAt = new Date(startsAt.getTime() + durationMin * 60 * 1000);

  const { merchant, supabase } = await requireAgendaPermission();

  const { error } = await supabase.from("merchant_appointment_slots").insert({
    merchant_id: merchant.id,
    queue_id: queueId,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    status: "available",
    is_active: true,
  });

  if (error) {
    redirect("/dashboard/modulos/agenda?error=slot_create_failed");
  }

  redirect("/dashboard/modulos/agenda?saved=1");
}

export async function cancelAppointmentSlot(formData: FormData) {
  const slotId = String(formData.get("slot_id") ?? "").trim();
  if (!slotId) return;

  const { merchant, supabase } = await requireAgendaPermission();

  const { error } = await supabase
    .from("merchant_appointment_slots")
    .update({ status: "cancelled", is_active: false })
    .eq("id", slotId)
    .eq("merchant_id", merchant.id);

  if (error) {
    redirect("/dashboard/modulos/agenda?error=save_failed");
  }

  redirect("/dashboard/modulos/agenda?saved=1");
}

export async function confirmAppointmentRequest(formData: FormData) {
  const requestId = String(formData.get("request_id") ?? "").trim();
  if (!requestId) return;

  const { merchant, supabase } = await requireAgendaPermission();

  const { data: req, error: reqError } = await supabase
    .from("merchant_appointment_requests")
    .select("id, slot_id")
    .eq("id", requestId)
    .eq("merchant_id", merchant.id)
    .maybeSingle();

  if (reqError || !req) {
    redirect("/dashboard/modulos/agenda?error=invalid_request");
  }

  const { error: upError } = await supabase
    .from("merchant_appointment_requests")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", req.id)
    .eq("merchant_id", merchant.id)
    .eq("status", "pending");

  if (upError) {
    redirect("/dashboard/modulos/agenda?error=save_failed");
  }

  // Slot status sync will run via trigger.
  redirect("/dashboard/modulos/agenda?saved=1");
}

export async function declineAppointmentRequest(formData: FormData) {
  const requestId = String(formData.get("request_id") ?? "").trim();
  if (!requestId) return;

  const { merchant, supabase } = await requireAgendaPermission();

  const { data: req, error: reqError } = await supabase
    .from("merchant_appointment_requests")
    .select("id")
    .eq("id", requestId)
    .eq("merchant_id", merchant.id)
    .maybeSingle();

  if (reqError || !req) {
    redirect("/dashboard/modulos/agenda?error=invalid_request");
  }

  const { error: upError } = await supabase
    .from("merchant_appointment_requests")
    .update({ status: "declined", declined_at: new Date().toISOString() })
    .eq("id", req.id)
    .eq("merchant_id", merchant.id)
    .eq("status", "pending");

  if (upError) {
    redirect("/dashboard/modulos/agenda?error=save_failed");
  }

  // Slot status sync will run via trigger.
  redirect("/dashboard/modulos/agenda?saved=1");
}
