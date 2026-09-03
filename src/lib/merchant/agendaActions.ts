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

export interface CreateAppointmentSlotInput {
  merchantId: string;
  queueId?: string | null;
  startsAtIso: string;
  durationMin: number;
}

export interface CreateAppointmentSlotResult {
  ok: boolean;
  slotId?: string;
  error?: "invalid_slot" | "save_failed";
}

/** Mutação central reaproveitada por `createAppointmentSlot` (Server Action) e `create_appointment_slot` (ai/tools/agenda.ts). */
export async function createAppointmentSlotCore(
  supabase: SupabaseClient<Database>,
  input: CreateAppointmentSlotInput,
): Promise<CreateAppointmentSlotResult> {
  const startsAt = new Date(input.startsAtIso);
  if (
    !Number.isFinite(startsAt.getTime()) ||
    !Number.isFinite(input.durationMin) ||
    input.durationMin <= 0 ||
    input.durationMin > 24 * 60
  ) {
    return { ok: false, error: "invalid_slot" };
  }

  const endsAt = new Date(startsAt.getTime() + input.durationMin * 60 * 1000);

  const { data, error } = await supabase
    .from("merchant_appointment_slots")
    .insert({
      merchant_id: input.merchantId,
      queue_id: input.queueId ?? null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: "available",
      is_active: true,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: "save_failed" };
  }

  return { ok: true, slotId: data.id };
}

export interface BookAppointmentForCustomerInput {
  merchantId: string;
  /** Usado para compor um session_token sintético (não há sessão real de cliente aqui). */
  staffUserId: string;
  queueId?: string | null;
  startsAtIso: string;
  durationMin: number;
  customerName: string;
  customerContact?: string | null;
  customerNotes?: string | null;
}

export interface BookAppointmentForCustomerResult {
  ok: boolean;
  slotId?: string;
  requestId?: string;
  error?: "invalid_slot" | "invalid_customer_name" | "slot_save_failed" | "request_save_failed" | "confirm_failed";
}

/**
 * Cria um horário já vinculado e confirmado para um cliente específico
 * informado pelo lojista (ex.: telefone/balcão), sem depender do cliente
 * reservar sozinho via QR. Reaproveita `createAppointmentSlotCore` (cria a
 * vaga) e `confirmAppointmentRequestCore` (confirma a solicitação), só que
 * em sequência, dentro de uma única operação lógica. Usada pela ferramenta
 * de IA `book_appointment_for_customer` (ai/tools/agenda.ts) e pela Server
 * Action humana `bookAppointmentForCustomer` (abaixo).
 */
export async function bookAppointmentForCustomerCore(
  supabase: SupabaseClient<Database>,
  input: BookAppointmentForCustomerInput,
): Promise<BookAppointmentForCustomerResult> {
  const customerName = input.customerName.trim();
  if (!customerName) {
    return { ok: false, error: "invalid_customer_name" };
  }

  const slotResult = await createAppointmentSlotCore(supabase, {
    merchantId: input.merchantId,
    queueId: input.queueId ?? null,
    startsAtIso: input.startsAtIso,
    durationMin: input.durationMin,
  });

  if (!slotResult.ok || !slotResult.slotId) {
    return { ok: false, error: slotResult.error === "invalid_slot" ? "invalid_slot" : "slot_save_failed" };
  }

  const startsAt = new Date(input.startsAtIso);
  const endsAt = new Date(startsAt.getTime() + input.durationMin * 60 * 1000);

  const { data: reqRow, error: reqError } = await supabase
    .from("merchant_appointment_requests")
    .insert({
      merchant_id: input.merchantId,
      slot_id: slotResult.slotId,
      session_token: `staff:${input.staffUserId}`,
      customer_name: customerName,
      customer_contact: input.customerContact?.trim() || null,
      customer_notes: input.customerNotes?.trim() || null,
      status: "pending",
      // Sobrescritos pela trigger handle_appointment_request_insert a partir do slot,
      // mas obrigatórios no tipo de Insert.
      slot_starts_at: startsAt.toISOString(),
      slot_ends_at: endsAt.toISOString(),
    })
    .select("id")
    .single();

  if (reqError || !reqRow) {
    console.error("bookAppointmentForCustomerCore: request insert failed", {
      code: reqError?.code,
      message: reqError?.message,
    });
    // A vaga ficou criada e disponível (a trigger só altera o slot se o insert vingar).
    // Não é destrutivo — pode ser cancelada/reaproveitada manualmente depois.
    return { ok: false, error: "request_save_failed" };
  }

  const confirmResult = await confirmAppointmentRequestCore(supabase, {
    merchantId: input.merchantId,
    requestId: reqRow.id,
  });

  if (!confirmResult.ok) {
    return { ok: false, error: "confirm_failed", slotId: slotResult.slotId, requestId: reqRow.id };
  }

  return { ok: true, slotId: slotResult.slotId, requestId: reqRow.id };
}

export interface RescheduleAppointmentInput {
  merchantId: string;
  requestId: string;
  startsAtIso: string;
  /** Se omitido, mantém a duração atual do agendamento. */
  durationMin?: number;
}

export interface RescheduleAppointmentResult {
  ok: boolean;
  error?: "not_found" | "invalid_status" | "invalid_slot" | "save_failed";
}

/**
 * Move um agendamento (pendente ou confirmado) pra uma nova data/hora,
 * atualizando o horário do slot associado e a cópia denormalizada em
 * `merchant_appointment_requests` (nenhuma trigger sincroniza esses campos
 * automaticamente — só status). Usada por `reschedule_appointment`
 * (ai/tools/agenda.ts) e pela Server Action humana `rescheduleAppointment`
 * (abaixo).
 */
export async function rescheduleAppointmentCore(
  supabase: SupabaseClient<Database>,
  input: RescheduleAppointmentInput,
): Promise<RescheduleAppointmentResult> {
  const { data: req, error: reqError } = await supabase
    .from("merchant_appointment_requests")
    .select("id, slot_id, status, slot_starts_at, slot_ends_at")
    .eq("id", input.requestId)
    .eq("merchant_id", input.merchantId)
    .maybeSingle();

  if (reqError || !req) {
    return { ok: false, error: "not_found" };
  }
  if (req.status !== "pending" && req.status !== "confirmed") {
    return { ok: false, error: "invalid_status" };
  }

  const startsAt = new Date(input.startsAtIso);
  const originalDurationMs = new Date(req.slot_ends_at).getTime() - new Date(req.slot_starts_at).getTime();
  const durationMin = input.durationMin ?? originalDurationMs / (60 * 1000);

  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(durationMin) || durationMin <= 0 || durationMin > 24 * 60) {
    return { ok: false, error: "invalid_slot" };
  }

  const endsAt = new Date(startsAt.getTime() + durationMin * 60 * 1000);

  const { error: slotError } = await supabase
    .from("merchant_appointment_slots")
    .update({ starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString() })
    .eq("id", req.slot_id)
    .eq("merchant_id", input.merchantId);

  if (slotError) {
    return { ok: false, error: "save_failed" };
  }

  const { error: updateError } = await supabase
    .from("merchant_appointment_requests")
    .update({ slot_starts_at: startsAt.toISOString(), slot_ends_at: endsAt.toISOString() })
    .eq("id", req.id)
    .eq("merchant_id", input.merchantId);

  if (updateError) {
    return { ok: false, error: "save_failed" };
  }

  return { ok: true };
}

export interface CancelAppointmentSlotInput {
  merchantId: string;
  slotId: string;
}

export interface CancelAppointmentSlotResult {
  ok: boolean;
  /** true se algum horário realmente existia e foi cancelado agora. */
  updated?: boolean;
  error?: "save_failed";
}

/** Mutação central reaproveitada por `cancelAppointmentSlot` (Server Action) e `cancel_appointment_slot` (ai/tools/agenda.ts). */
export async function cancelAppointmentSlotCore(
  supabase: SupabaseClient<Database>,
  input: CancelAppointmentSlotInput,
): Promise<CancelAppointmentSlotResult> {
  const { data, error } = await supabase
    .from("merchant_appointment_slots")
    .update({ status: "cancelled", is_active: false })
    .eq("id", input.slotId)
    .eq("merchant_id", input.merchantId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, error: "save_failed" };
  }

  return { ok: true, updated: Boolean(data) };
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

  const { merchant, supabase } = await requireAgendaPermission();

  const result = await createAppointmentSlotCore(supabase, { merchantId: merchant.id, queueId, startsAtIso, durationMin });

  if (!result.ok) {
    redirect(
      result.error === "invalid_slot"
        ? "/dashboard/modulos/agenda?error=invalid_slot"
        : "/dashboard/modulos/agenda?error=slot_create_failed",
    );
  }

  redirect("/dashboard/modulos/agenda?saved=1");
}

export async function cancelAppointmentSlot(formData: FormData) {
  const slotId = String(formData.get("slot_id") ?? "").trim();
  if (!slotId) return;

  const { merchant, supabase } = await requireAgendaPermission();

  const result = await cancelAppointmentSlotCore(supabase, { merchantId: merchant.id, slotId });

  if (!result.ok) {
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

export async function bookAppointmentForCustomer(formData: FormData) {
  const queueIdRaw = String(formData.get("queue_id") ?? "").trim();
  const queueId = queueIdRaw || null;

  const startsAtLocal = String(formData.get("starts_at") ?? "");
  const durationMin = Number(formData.get("duration_min") ?? 0);
  const customerName = String(formData.get("customer_name") ?? "").trim();
  const customerContact = String(formData.get("customer_contact") ?? "").trim() || null;
  const customerNotes = String(formData.get("customer_notes") ?? "").trim() || null;

  const startsAtIso = parseLocalDateTimeToIso(startsAtLocal);
  if (!startsAtIso || !Number.isFinite(durationMin) || durationMin <= 0 || durationMin > 24 * 60 || !customerName) {
    redirect("/dashboard/modulos/agenda?error=invalid_booking");
  }

  const { merchant, user, supabase } = await requireAgendaPermission();

  const result = await bookAppointmentForCustomerCore(supabase, {
    merchantId: merchant.id,
    staffUserId: user.id,
    queueId,
    startsAtIso,
    durationMin,
    customerName,
    customerContact,
    customerNotes,
  });

  if (!result.ok) {
    redirect(
      result.error === "invalid_customer_name" || result.error === "invalid_slot"
        ? "/dashboard/modulos/agenda?error=invalid_booking"
        : "/dashboard/modulos/agenda?error=booking_failed",
    );
  }

  redirect("/dashboard/modulos/agenda?saved=1");
}

export async function rescheduleAppointment(formData: FormData) {
  const requestId = String(formData.get("request_id") ?? "").trim();
  if (!requestId) return;

  const startsAtLocal = String(formData.get("starts_at") ?? "");
  const durationMinRaw = String(formData.get("duration_min") ?? "").trim();
  const durationMin = durationMinRaw ? Number(durationMinRaw) : undefined;

  const startsAtIso = parseLocalDateTimeToIso(startsAtLocal);
  if (
    !startsAtIso ||
    (durationMin !== undefined && (!Number.isFinite(durationMin) || durationMin <= 0 || durationMin > 24 * 60))
  ) {
    redirect("/dashboard/modulos/agenda?error=invalid_slot");
  }

  const { merchant, supabase } = await requireAgendaPermission();

  const result = await rescheduleAppointmentCore(supabase, {
    merchantId: merchant.id,
    requestId,
    startsAtIso,
    durationMin,
  });

  if (!result.ok) {
    redirect(
      result.error === "not_found"
        ? "/dashboard/modulos/agenda?error=invalid_request"
        : result.error === "invalid_status"
          ? "/dashboard/modulos/agenda?error=invalid_status"
          : result.error === "invalid_slot"
            ? "/dashboard/modulos/agenda?error=invalid_slot"
            : "/dashboard/modulos/agenda?error=save_failed",
    );
  }

  redirect("/dashboard/modulos/agenda?saved=1");
}
