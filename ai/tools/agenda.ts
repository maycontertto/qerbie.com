/**
 * Ferramentas de agenda. Consulta somente leitura, sempre filtrada por
 * `ctx.merchantId`. Cobre o modelo de agenda com confirmação (clínicas,
 * salões, etc. — ver integrations/supabase/schema/027_agenda.sql).
 */
import type { AssistantContext, ToolDefinition } from "@ai/types";

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
