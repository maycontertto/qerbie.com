/**
 * Ferramentas de trocas/devoluções. Consulta somente leitura filtrada por
 * `ctx.merchantId`; escrita reaproveita `updateExchangeStatusCore`
 * (src/lib/merchant/exchangeActions.ts), mesma função usada pelo formulário
 * humano em src/app/dashboard/modulos/trocas/page.tsx.
 */
import type { AssistantContext, ToolDefinition } from "@ai/types";
import { updateExchangeStatusCore } from "@/lib/merchant/exchangeActions";
import type { ExchangeRequestStatus } from "@/lib/supabase/database.types";

const EXCHANGE_STATUSES: ExchangeRequestStatus[] = ["open", "in_progress", "done", "cancelled"];

const STATUS_LABEL: Record<ExchangeRequestStatus, string> = {
  open: "aberta",
  in_progress: "em andamento",
  done: "concluída",
  cancelled: "cancelada",
};

interface ExchangeRequestsArgs {
  status?: ExchangeRequestStatus;
  limit?: number;
}

interface ExchangeRequestRow {
  exchangeRequestId: string;
  customerName: string | null;
  reason: string | null;
  notes: string | null;
  status: ExchangeRequestStatus;
  createdAt: string;
}

interface ExchangeRequestsData {
  requests: ExchangeRequestRow[];
}

export const getExchangeRequestsTool: ToolDefinition<ExchangeRequestsArgs, ExchangeRequestsData> = {
  name: "get_exchange_requests",
  description:
    "Lista solicitações de troca/devolução do estabelecimento (padrão: só as abertas). Use antes de propor uma mudança de status, para obter o id certo.",
  requiredPermission: "dashboard_orders",
  kind: "read",
  requiresModuleHref: "/dashboard/modulos/trocas",
  parameters: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: EXCHANGE_STATUSES,
        description: "Filtra por status. Se não informado, retorna só as abertas ('open').",
      },
      limit: { type: "number", description: "Quantidade máxima de resultados (padrão 10, máximo 50)." },
    },
    required: [],
  },
  async run(ctx: AssistantContext, args: ExchangeRequestsArgs) {
    const status = args.status && EXCHANGE_STATUSES.includes(args.status) ? args.status : "open";
    const limit = Math.min(Math.max(args.limit ?? 10, 1), 50);

    const { data, error } = await ctx.supabase
      .from("merchant_exchange_requests")
      .select("id, customer_name, reason, notes, status, created_at")
      .eq("merchant_id", ctx.merchantId)
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return { ok: false, error: error.message };
    }

    const requests = (data ?? []).map((r) => ({
      exchangeRequestId: r.id,
      customerName: r.customer_name,
      reason: r.reason,
      notes: r.notes,
      status: r.status,
      createdAt: r.created_at,
    }));

    return { ok: true, data: { requests } };
  },
};

interface UpdateExchangeStatusArgs {
  exchangeRequestId: string;
  status: ExchangeRequestStatus;
}

interface UpdateExchangeStatusData {
  exchangeRequestId: string;
  status: ExchangeRequestStatus;
}

async function loadExchangeRequest(ctx: AssistantContext, exchangeRequestId: string) {
  const { data } = await ctx.supabase
    .from("merchant_exchange_requests")
    .select("id, customer_name, status")
    .eq("merchant_id", ctx.merchantId)
    .eq("id", exchangeRequestId)
    .maybeSingle();
  return data;
}

export const updateExchangeStatusTool: ToolDefinition<UpdateExchangeStatusArgs, UpdateExchangeStatusData> = {
  name: "update_exchange_status",
  description:
    "Propõe alterar o status de uma solicitação de troca/devolução (aberta, em andamento, concluída ou cancelada). Use get_exchange_requests antes para obter o id certo.",
  requiredPermission: "dashboard_orders",
  kind: "write",
  requiresModuleHref: "/dashboard/modulos/trocas",
  parameters: {
    type: "object",
    properties: {
      exchangeRequestId: { type: "string", description: "UUID da solicitação (obtido de get_exchange_requests)." },
      status: { type: "string", enum: EXCHANGE_STATUSES, description: "Novo status." },
    },
    required: ["exchangeRequestId", "status"],
  },
  async buildPreview(ctx: AssistantContext, args: UpdateExchangeStatusArgs) {
    if (!EXCHANGE_STATUSES.includes(args.status)) {
      throw new Error("Status inválido para troca/devolução.");
    }
    const request = await loadExchangeRequest(ctx, args.exchangeRequestId);
    if (!request) {
      throw new Error("Não encontrei essa solicitação de troca. Confirme o pedido e tente de novo.");
    }
    const who = request.customer_name ? ` de "${request.customer_name}"` : "";
    return `Alterar a troca${who} de "${STATUS_LABEL[request.status]}" para "${STATUS_LABEL[args.status]}". Confirma?`;
  },
  async run(ctx: AssistantContext, args: UpdateExchangeStatusArgs) {
    const request = await loadExchangeRequest(ctx, args.exchangeRequestId);
    if (!request) {
      return { ok: false, error: "Solicitação de troca não encontrada." };
    }

    const result = await updateExchangeStatusCore(ctx.supabase, {
      merchantId: ctx.merchantId,
      exchangeRequestId: args.exchangeRequestId,
      status: args.status,
    });

    if (!result.ok) {
      return { ok: false, error: "Não foi possível salvar o novo status agora. Tente novamente." };
    }

    return { ok: true, data: { exchangeRequestId: request.id, status: args.status } };
  },
};
