/**
 * Ferramentas de agenda. Consulta somente leitura, sempre filtrada por
 * `ctx.merchantId`. Cobre o modelo de agenda com confirmação (clínicas,
 * salões, etc. — ver integrations/supabase/schema/027_agenda.sql).
 * Não se aplica a segmentos que não usam esse módulo (ex.: academias tem
 * seu próprio fluxo de planos/presença) — ver `requiresModuleHref` abaixo.
 */
import type { AssistantContext, ToolDefinition } from "@ai/types";
import { confirmAppointmentRequestCore, declineAppointmentRequestCore } from "@/lib/merchant/agendaActions";

const AGENDA_MODULE_HREF = "/dashboard/modulos/agenda";

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

interface AppointmentsTodayArgs {
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
    "Retorna os agendamentos confirmados ou aguardando confirmação para hoje, com cliente, profissional/fila e horário.",
  requiredPermission: "dashboard_access",
  kind: "read",
  requiresModuleHref: AGENDA_MODULE_HREF,
  parameters: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        description: "Quantidade máxima de agendamentos a retornar (padrão 20, máximo 100).",
      },
    },
  },
  async run(ctx: AssistantContext, args: AppointmentsTodayArgs) {
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
    const now = new Date();
    const fromIso = startOfDayUtc(now).toISOString();
    const toIso = startOfDayUtc(new Date(now.getTime() + 24 * 60 * 60 * 1000)).toISOString();

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
