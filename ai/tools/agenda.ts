/**
 * Ferramentas de agenda. Consulta somente leitura, sempre filtrada por
 * `ctx.merchantId`. Cobre o modelo de agenda com confirmação (clínicas,
 * salões, etc. — ver integrations/supabase/schema/027_agenda.sql).
 * Não se aplica a segmentos que não usam esse módulo (ex.: academias tem
 * seu próprio fluxo de planos/presença) — ver `requiresModuleHref` abaixo.
 */
import type { AssistantContext, ToolDefinition } from "@ai/types";
import {
  cancelAppointmentSlotCore,
  confirmAppointmentRequestCore,
  createAppointmentSlotCore,
  declineAppointmentRequestCore,
} from "@/lib/merchant/agendaActions";

const AGENDA_MODULE_HREF = "/dashboard/modulos/agenda";

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Interpreta uma data/hora informada pelo modelo de IA. Se já vier com
 * timezone explícito (Z ou +hh:mm/-hh:mm), usa como está. Se vier "nua"
 * (sem timezone), assume horário de Brasília (America/Sao_Paulo) — o Brasil
 * não tem mais horário de verão desde 2019, então o offset é sempre -03:00.
 * Isso evita depender do modelo sempre incluir o offset certo (o servidor
 * roda em UTC, então uma data nua interpretada "crua" ficaria 3h errada).
 */
function resolveAppointmentDateTime(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const hasExplicitTimezone = /(Z|[+-]\d{2}:\d{2})$/.test(trimmed);
  const withTimezone = hasExplicitTimezone ? trimmed : `${trimmed}-03:00`;
  const parsed = new Date(withTimezone);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

interface AppointmentsTodayArgs {
  daysAhead?: number;
  limit?: number;
}

interface AppointmentRow {
  customerName: string;
  professionalName: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
}

interface AppointmentsTodayData {
  fromIso: string;
  toIso: string;
  appointments: AppointmentRow[];
}

export const getAppointmentsTodayTool: ToolDefinition<AppointmentsTodayArgs, AppointmentsTodayData> = {
  name: "get_appointments_today",
  description:
    "Retorna os agendamentos confirmados ou aguardando confirmação (dados de AGENDA, não de vendas/pedidos). Por padrão só hoje; use daysAhead para olhar os próximos dias (ex.: 7 para a semana) e responder 'quantos atendimentos estão marcados'.",
  requiredPermission: "dashboard_access",
  kind: "read",
  requiresModuleHref: AGENDA_MODULE_HREF,
  parameters: {
    type: "object",
    properties: {
      daysAhead: {
        type: "number",
        description: "Quantos dias à frente considerar, a partir de hoje (padrão 1 = só hoje, máximo 30).",
      },
      limit: {
        type: "number",
        description: "Quantidade máxima de agendamentos a retornar (padrão 20, máximo 100).",
      },
    },
  },
  async run(ctx: AssistantContext, args: AppointmentsTodayArgs) {
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
    const daysAhead = Math.min(Math.max(args.daysAhead ?? 1, 1), 30);
    const now = new Date();
    const fromIso = startOfDayUtc(now).toISOString();
    const toIso = startOfDayUtc(new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000)).toISOString();

    const { data, error } = await ctx.supabase
      .from("merchant_appointment_requests")
      .select("customer_name, slot_starts_at, slot_ends_at, status, merchant_queues(name)")
      .eq("merchant_id", ctx.merchantId)
      .in("status", ["confirmed", "pending"])
      .gte("slot_starts_at", fromIso)
      .lt("slot_starts_at", toIso)
      .order("slot_starts_at", { ascending: true })
      .limit(limit);

    if (error) {
      return { ok: false, error: error.message };
    }

    const appointments = (data ?? []).map((row) => {
      const queue = row.merchant_queues as unknown as { name: string } | { name: string }[] | null;
      const professionalName = Array.isArray(queue) ? queue[0]?.name ?? null : queue?.name ?? null;
      return {
        customerName: row.customer_name || "Cliente sem nome",
        professionalName,
        startsAt: row.slot_starts_at,
        endsAt: row.slot_ends_at,
        status: row.status,
      };
    });

    return { ok: true, data: { fromIso, toIso, appointments } };
  },
};

interface PendingAppointmentsArgs {
  limit?: number;
}

interface PendingAppointmentRow {
  appointmentRequestId: string;
  customerName: string;
  professionalName: string | null;
  startsAt: string;
  endsAt: string;
}

interface PendingAppointmentsData {
  appointments: PendingAppointmentRow[];
}

export const getPendingAppointmentsTool: ToolDefinition<PendingAppointmentsArgs, PendingAppointmentsData> = {
  name: "get_pending_appointments",
  description:
    "Lista solicitações de agendamento aguardando confirmação (status pendente), com o id necessário para confirmar ou recusar.",
  requiredPermission: "dashboard_orders",
  kind: "read",
  requiresModuleHref: AGENDA_MODULE_HREF,
  parameters: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Quantidade máxima de resultados (padrão 20, máximo 100)." },
    },
  },
  async run(ctx: AssistantContext, args: PendingAppointmentsArgs) {
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);

    const { data, error } = await ctx.supabase
      .from("merchant_appointment_requests")
      .select("id, customer_name, slot_starts_at, slot_ends_at, merchant_queues(name)")
      .eq("merchant_id", ctx.merchantId)
      .eq("status", "pending")
      .order("slot_starts_at", { ascending: true })
      .limit(limit);

    if (error) {
      return { ok: false, error: error.message };
    }

    const appointments = (data ?? []).map((row) => {
      const queue = row.merchant_queues as unknown as { name: string } | { name: string }[] | null;
      const professionalName = Array.isArray(queue) ? queue[0]?.name ?? null : queue?.name ?? null;
      return {
        appointmentRequestId: row.id,
        customerName: row.customer_name || "Cliente sem nome",
        professionalName,
        startsAt: row.slot_starts_at,
        endsAt: row.slot_ends_at,
      };
    });

    return { ok: true, data: { appointments } };
  },
};

interface ResolveAppointmentArgs {
  appointmentRequestId: string;
}

interface ResolveAppointmentData {
  appointmentRequestId: string;
}

async function loadPendingAppointment(ctx: AssistantContext, appointmentRequestId: string) {
  const { data } = await ctx.supabase
    .from("merchant_appointment_requests")
    .select("id, customer_name, status, slot_starts_at, slot_ends_at")
    .eq("merchant_id", ctx.merchantId)
    .eq("id", appointmentRequestId)
    .maybeSingle();
  return data;
}

function formatSlotRange(startsAtIso: string, endsAtIso: string): string {
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
  return `${fmt.format(new Date(startsAtIso))} até ${new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(endsAtIso))}`;
}

export const confirmAppointmentTool: ToolDefinition<ResolveAppointmentArgs, ResolveAppointmentData> = {
  name: "confirm_appointment",
  description:
    "Propõe confirmar uma solicitação de agendamento pendente. Use get_pending_appointments antes para obter o id certo.",
  requiredPermission: "dashboard_orders",
  kind: "write",
  requiresModuleHref: AGENDA_MODULE_HREF,
  parameters: {
    type: "object",
    properties: {
      appointmentRequestId: { type: "string", description: "UUID da solicitação (obtido de get_pending_appointments)." },
    },
    required: ["appointmentRequestId"],
  },
  async buildPreview(ctx: AssistantContext, args: ResolveAppointmentArgs) {
    const appt = await loadPendingAppointment(ctx, args.appointmentRequestId);
    if (!appt) {
      throw new Error("Não encontrei essa solicitação de agendamento.");
    }
    if (appt.status !== "pending") {
      throw new Error("Essa solicitação já não está mais pendente (talvez já tenha sido resolvida).");
    }
    const who = appt.customer_name || "cliente sem nome";
    return `Confirmar o agendamento de "${who}" (${formatSlotRange(appt.slot_starts_at, appt.slot_ends_at)}). Confirma?`;
  },
  async run(ctx: AssistantContext, args: ResolveAppointmentArgs) {
    const result = await confirmAppointmentRequestCore(ctx.supabase, {
      merchantId: ctx.merchantId,
      requestId: args.appointmentRequestId,
    });

    if (!result.ok) {
      return {
        ok: false,
        error: result.error === "not_found" ? "Solicitação não encontrada." : "Não foi possível confirmar agora. Tente novamente.",
      };
    }
    if (!result.updated) {
      return { ok: false, error: "Essa solicitação já não estava mais pendente — nada foi alterado." };
    }

    return { ok: true, data: { appointmentRequestId: args.appointmentRequestId } };
  },
};

export const declineAppointmentTool: ToolDefinition<ResolveAppointmentArgs, ResolveAppointmentData> = {
  name: "decline_appointment",
  description:
    "Propõe recusar uma solicitação de agendamento pendente. Use get_pending_appointments antes para obter o id certo.",
  requiredPermission: "dashboard_orders",
  kind: "write",
  requiresModuleHref: AGENDA_MODULE_HREF,
  parameters: {
    type: "object",
    properties: {
      appointmentRequestId: { type: "string", description: "UUID da solicitação (obtido de get_pending_appointments)." },
    },
    required: ["appointmentRequestId"],
  },
  async buildPreview(ctx: AssistantContext, args: ResolveAppointmentArgs) {
    const appt = await loadPendingAppointment(ctx, args.appointmentRequestId);
    if (!appt) {
      throw new Error("Não encontrei essa solicitação de agendamento.");
    }
    if (appt.status !== "pending") {
      throw new Error("Essa solicitação já não está mais pendente (talvez já tenha sido resolvida).");
    }
    const who = appt.customer_name || "cliente sem nome";
    return `Recusar o agendamento de "${who}" (${formatSlotRange(appt.slot_starts_at, appt.slot_ends_at)}). Confirma?`;
  },
  async run(ctx: AssistantContext, args: ResolveAppointmentArgs) {
    const result = await declineAppointmentRequestCore(ctx.supabase, {
      merchantId: ctx.merchantId,
      requestId: args.appointmentRequestId,
    });

    if (!result.ok) {
      return {
        ok: false,
        error: result.error === "not_found" ? "Solicitação não encontrada." : "Não foi possível recusar agora. Tente novamente.",
      };
    }
    if (!result.updated) {
      return { ok: false, error: "Essa solicitação já não estava mais pendente — nada foi alterado." };
    }

    return { ok: true, data: { appointmentRequestId: args.appointmentRequestId } };
  },
};

interface ListQueuesArgs {
  limit?: number;
}

interface QueueRow {
  queueId: string;
  name: string;
}

interface ListQueuesData {
  queues: QueueRow[];
}

export const listQueuesTool: ToolDefinition<ListQueuesArgs, ListQueuesData> = {
  name: "list_queues",
  description:
    "Lista os profissionais/filas ativos do estabelecimento (usados para associar um horário de agenda a um profissional específico).",
  requiredPermission: "dashboard_access",
  kind: "read",
  requiresModuleHref: AGENDA_MODULE_HREF,
  parameters: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Quantidade máxima de resultados (padrão 50, máximo 100)." },
    },
  },
  async run(ctx: AssistantContext, args: ListQueuesArgs) {
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);

    const { data, error } = await ctx.supabase
      .from("merchant_queues")
      .select("id, name")
      .eq("merchant_id", ctx.merchantId)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .limit(limit);

    if (error) {
      return { ok: false, error: error.message };
    }

    return {
      ok: true,
      data: { queues: (data ?? []).map((row) => ({ queueId: row.id, name: row.name })) },
    };
  },
};

interface CreateAppointmentSlotArgs {
  startsAt: string;
  durationMin: number;
  queueId?: string;
}

interface CreateAppointmentSlotData {
  slotId: string;
}

function formatDateTimeSp(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

export const createAppointmentSlotTool: ToolDefinition<CreateAppointmentSlotArgs, CreateAppointmentSlotData> = {
  name: "create_appointment_slot",
  description:
    "Propõe criar um novo horário disponível na agenda para clientes reservarem. Use list_queues antes se quiser associar a um profissional específico.",
  requiredPermission: "dashboard_orders",
  kind: "write",
  requiresModuleHref: AGENDA_MODULE_HREF,
  parameters: {
    type: "object",
    properties: {
      startsAt: {
        type: "string",
        description:
          "Data/hora de início (ex.: 2026-09-10T14:00:00). Se não incluir o fuso horário, será tratado como horário de Brasília (America/Sao_Paulo, UTC-3) — pode incluir explicitamente (ex.: -03:00) se preferir.",
      },
      durationMin: { type: "number", description: "Duração do horário em minutos (1 a 1440)." },
      queueId: { type: "string", description: "UUID do profissional/fila (opcional, obtido de list_queues)." },
    },
    required: ["startsAt", "durationMin"],
  },
  async buildPreview(ctx: AssistantContext, args: CreateAppointmentSlotArgs) {
    const startsAt = resolveAppointmentDateTime(args.startsAt);
    if (!startsAt) {
      throw new Error("Data/hora inválida.");
    }
    if (!Number.isFinite(args.durationMin) || args.durationMin <= 0 || args.durationMin > 24 * 60) {
      throw new Error("Duração inválida — use um valor em minutos entre 1 e 1440.");
    }

    let queueLabel = "sem profissional específico";
    if (args.queueId) {
      const { data: queue } = await ctx.supabase
        .from("merchant_queues")
        .select("name")
        .eq("id", args.queueId)
        .eq("merchant_id", ctx.merchantId)
        .maybeSingle();
      if (!queue) {
        throw new Error("Não encontrei esse profissional/fila. Use list_queues para ver os disponíveis.");
      }
      queueLabel = queue.name;
    }

    const endsAt = new Date(startsAt.getTime() + args.durationMin * 60 * 1000);
    return `Criar horário disponível de ${formatDateTimeSp(startsAt.toISOString())} até ${formatDateTimeSp(
      endsAt.toISOString(),
    )} (${queueLabel}). Confirma?`;
  },
  async run(ctx: AssistantContext, args: CreateAppointmentSlotArgs) {
    const startsAt = resolveAppointmentDateTime(args.startsAt);
    if (!startsAt) {
      return { ok: false, error: "Data/hora inválida." };
    }

    const result = await createAppointmentSlotCore(ctx.supabase, {
      merchantId: ctx.merchantId,
      queueId: args.queueId ?? null,
      startsAtIso: startsAt.toISOString(),
      durationMin: args.durationMin,
    });

    if (!result.ok || !result.slotId) {
      return {
        ok: false,
        error: result.error === "invalid_slot" ? "Data ou duração inválida." : "Não foi possível criar o horário agora. Tente novamente.",
      };
    }

    return { ok: true, data: { slotId: result.slotId } };
  },
};

interface CancelAppointmentSlotArgs {
  slotId: string;
}

interface CancelAppointmentSlotData {
  slotId: string;
}

export const cancelAppointmentSlotTool: ToolDefinition<CancelAppointmentSlotArgs, CancelAppointmentSlotData> = {
  name: "cancel_appointment_slot",
  description:
    "Propõe cancelar um horário disponível (que ainda não tem nenhuma solicitação de cliente associada). Não use para recusar/cancelar um agendamento já solicitado por um cliente — para isso use decline_appointment.",
  requiredPermission: "dashboard_orders",
  kind: "write",
  requiresModuleHref: AGENDA_MODULE_HREF,
  parameters: {
    type: "object",
    properties: {
      slotId: { type: "string", description: "UUID do horário a cancelar." },
    },
    required: ["slotId"],
  },
  async buildPreview(ctx: AssistantContext, args: CancelAppointmentSlotArgs) {
    const { data: slot } = await ctx.supabase
      .from("merchant_appointment_slots")
      .select("id, starts_at, ends_at, status, merchant_queues(name)")
      .eq("id", args.slotId)
      .eq("merchant_id", ctx.merchantId)
      .maybeSingle();

    if (!slot) {
      throw new Error("Não encontrei esse horário.");
    }
    if (slot.status !== "available") {
      throw new Error(
        "Esse horário já tem uma solicitação de cliente associada (não está mais disponível) — não posso cancelar por aqui. Resolva a solicitação primeiro (confirm_appointment/decline_appointment).",
      );
    }

    const queue = slot.merchant_queues as unknown as { name: string } | { name: string }[] | null;
    const queueLabel = Array.isArray(queue) ? queue[0]?.name : queue?.name;
    return `Cancelar o horário disponível de ${formatDateTimeSp(slot.starts_at)} até ${formatDateTimeSp(slot.ends_at)}${
      queueLabel ? ` (${queueLabel})` : ""
    }. Confirma?`;
  },
  async run(ctx: AssistantContext, args: CancelAppointmentSlotArgs) {
    const { data: slot } = await ctx.supabase
      .from("merchant_appointment_slots")
      .select("id, status")
      .eq("id", args.slotId)
      .eq("merchant_id", ctx.merchantId)
      .maybeSingle();

    if (!slot) {
      return { ok: false, error: "Horário não encontrado." };
    }
    if (slot.status !== "available") {
      return { ok: false, error: "Esse horário não está mais disponível — não foi cancelado." };
    }

    const result = await cancelAppointmentSlotCore(ctx.supabase, { merchantId: ctx.merchantId, slotId: args.slotId });

    if (!result.ok) {
      return { ok: false, error: "Não foi possível cancelar agora. Tente novamente." };
    }
    if (!result.updated) {
      return { ok: false, error: "Esse horário já não existia mais — nada foi alterado." };
    }

    return { ok: true, data: { slotId: args.slotId } };
  },
};

interface AvailableSlotsArgs {
  daysAhead?: number;
  queueId?: string;
  limit?: number;
}

interface AvailableSlotRow {
  slotId: string;
  professionalName: string | null;
  startsAt: string;
  endsAt: string;
}

interface AvailableSlotsData {
  slots: AvailableSlotRow[];
}

export const getAvailableSlotsTool: ToolDefinition<AvailableSlotsArgs, AvailableSlotsData> = {
  name: "get_available_slots",
  description:
    "Lista os horários disponíveis na agenda (ainda sem cliente associado) que os clientes podem reservar — use para responder 'quantos horários livres tem' ou 'que horários estão disponíveis'.",
  requiredPermission: "dashboard_access",
  kind: "read",
  requiresModuleHref: AGENDA_MODULE_HREF,
  parameters: {
    type: "object",
    properties: {
      daysAhead: {
        type: "number",
        description: "Quantos dias à frente considerar, a partir de agora (padrão 7, máximo 30).",
      },
      queueId: { type: "string", description: "Filtrar por profissional/fila específico (opcional, obtido de list_queues)." },
      limit: { type: "number", description: "Quantidade máxima de resultados (padrão 20, máximo 100)." },
    },
  },
  async run(ctx: AssistantContext, args: AvailableSlotsArgs) {
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
    const daysAhead = Math.min(Math.max(args.daysAhead ?? 7, 1), 30);
    const now = new Date();
    const toIso = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000).toISOString();

    let query = ctx.supabase
      .from("merchant_appointment_slots")
      .select("id, starts_at, ends_at, merchant_queues(name)")
      .eq("merchant_id", ctx.merchantId)
      .eq("status", "available")
      .eq("is_active", true)
      .gte("starts_at", now.toISOString())
      .lt("starts_at", toIso)
      .order("starts_at", { ascending: true })
      .limit(limit);

    if (args.queueId) {
      query = query.eq("queue_id", args.queueId);
    }

    const { data, error } = await query;

    if (error) {
      return { ok: false, error: error.message };
    }

    const slots = (data ?? []).map((row) => {
      const queue = row.merchant_queues as unknown as { name: string } | { name: string }[] | null;
      const professionalName = Array.isArray(queue) ? queue[0]?.name ?? null : queue?.name ?? null;
      return {
        slotId: row.id,
        professionalName,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
      };
    });

    return { ok: true, data: { slots } };
  },
};

