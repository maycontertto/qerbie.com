"use server";

import { redirect } from "next/navigation";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export interface ResolveAppointmentRequestInput {
  merchantId: string;
  requestId: string;
}

export interface ResolveAppointmentRequestResult {
  ok: boolean;
  /** true se a solicitação estava realmente pendente e foi alterada agora. */
  updated?: boolean;
  error?: "save_failed" | "not_found";
}

/**
 * Mutação central reaproveitada pelas Server Actions humanas
 * (`confirmAppointmentRequest`/`declineAppointmentRequest`) e pelas
 * ferramentas de IA `confirm_appointment`/`decline_appointment`
 * (ai/tools/agenda.ts). Só altera o status se ele ainda for 'pending' —
 * se a solicitação já tiver sido resolvida por outra via, `updated: false`
 * é retornado (sem erro), e quem chama decide como reagir a isso.
 */
async function resolveAppointmentRequestCore(
  supabase: SupabaseClient<Database>,
  input: ResolveAppointmentRequestInput,
  newStatus: "confirmed" | "declined",
): Promise<ResolveAppointmentRequestResult> {
  const { data: req, error: reqError } = await supabase
    .from("merchant_appointment_requests")
    .select("id")
    .eq("id", input.requestId)
    .eq("merchant_id", input.merchantId)
    .maybeSingle();

  if (reqError || !req) {
    return { ok: false, error: "not_found" };
  }

  const timestampField = newStatus === "confirmed" ? "confirmed_at" : "declined_at";
  const { data, error } = await supabase
    .from("merchant_appointment_requests")
    .update({ status: newStatus, [timestampField]: new Date().toISOString() })
    .eq("id", req.id)
    .eq("merchant_id", input.merchantId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("resolveAppointmentRequestCore: update failed", { code: error.code, message: error.message });
    return { ok: false, error: "save_failed" };
  }

  return { ok: true, updated: Boolean(data) };
}

export async function confirmAppointmentRequestCore(
  supabase: SupabaseClient<Database>,
  input: ResolveAppointmentRequestInput,
): Promise<ResolveAppointmentRequestResult> {
  return resolveAppointmentRequestCore(supabase, input, "confirmed");
}

export async function declineAppointmentRequestCore(
  supabase: SupabaseClient<Database>,
  input: ResolveAppointmentRequestInput,
): Promise<ResolveAppointmentRequestResult> {
  return resolveAppointmentRequestCore(supabase, input, "declined");
}

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

  const result = await confirmAppointmentRequestCore(supabase, { merchantId: merchant.id, requestId });

  if (!result.ok) {
    redirect(
      result.error === "not_found"
        ? "/dashboard/modulos/agenda?error=invalid_request"
        : "/dashboard/modulos/agenda?error=save_failed",
    );
  }

  // Slot status sync will run via trigger.
  redirect("/dashboard/modulos/agenda?saved=1");
}

export async function declineAppointmentRequest(formData: FormData) {
  const requestId = String(formData.get("request_id") ?? "").trim();
  if (!requestId) return;

  const { merchant, supabase } = await requireAgendaPermission();

  const result = await declineAppointmentRequestCore(supabase, { merchantId: merchant.id, requestId });

  if (!result.ok) {
    redirect(
      result.error === "not_found"
        ? "/dashboard/modulos/agenda?error=invalid_request"
        : "/dashboard/modulos/agenda?error=save_failed",
    );
  }

  // Slot status sync will run via trigger.
  redirect("/dashboard/modulos/agenda?saved=1");
}
