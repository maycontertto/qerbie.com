/**
 * Ferramentas de vendas. Consultas somente leitura, sempre filtradas por
 * `ctx.merchantId` (nunca por um id vindo dos argumentos).
 *
 * Reaproveita o mesmo padrão de consulta usado em src/app/dashboard/page.tsx
 * (bloco de histórico de vendas).
 */
import type { AssistantContext, ToolDefinition } from "@ai/types";

type SalesRange = "today" | "week" | "month";

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function getRangeWindow(range: SalesRange): { fromIso: string; toIso: string } {
  const now = new Date();
  if (range === "today") {
    return { fromIso: startOfDayUtc(now).toISOString(), toIso: now.toISOString() };
  }
  const days = range === "week" ? 7 : 30;
  const from = startOfDayUtc(new Date(now.getTime() - days * 24 * 60 * 60 * 1000));
  return { fromIso: from.toISOString(), toIso: now.toISOString() };
}

interface SalesSummaryArgs {
  range?: SalesRange;
}

interface SalesSummaryData {
  range: SalesRange;
  fromIso: string;
  toIso: string;
  totalOrders: number;
  revenue: number;
  avgTicket: number;
}

export const getSalesSummaryTool: ToolDefinition<SalesSummaryArgs, SalesSummaryData> = {
  name: "get_sales_summary",
  description:
    "Retorna o resumo de vendas concluídas do estabelecimento (número de pedidos, faturamento e ticket médio) para um período: hoje, últimos 7 dias ou últimos 30 dias.",
  requiredPermission: "dashboard_sales",
  kind: "read",
  parameters: {
    type: "object",
    properties: {
      range: {
        type: "string",
        description: "Período a consultar.",
        enum: ["today", "week", "month"],
      },
    },
  },
  async run(ctx: AssistantContext, args: SalesSummaryArgs) {
    const range: SalesRange = args.range ?? "today";
    const { fromIso, toIso } = getRangeWindow(range);

    const { data: orders, error } = await ctx.supabase
      .from("orders")
      .select("id,total")
      .eq("merchant_id", ctx.merchantId)
      .eq("status", "completed")
      .gte("completed_at", fromIso)
      .lt("completed_at", toIso);

    if (error) {
      return { ok: false, error: error.message };
    }

    const safeOrders = orders ?? [];
    const totalOrders = safeOrders.length;
    const revenue = safeOrders.reduce((sum, o) => sum + Number(o.total ?? 0), 0);
    const avgTicket = totalOrders > 0 ? revenue / totalOrders : 0;

    return {
      ok: true,
      data: { range, fromIso, toIso, totalOrders, revenue, avgTicket },
    };
  },
};

interface TopProductsArgs {
  range?: SalesRange;
  limit?: number;
}

interface TopProductRow {
  productName: string;
  quantity: number;
}

interface TopProductsData {
  range: SalesRange;
  fromIso: string;
  toIso: string;
  products: TopProductRow[];
}

export const getTopProductsTool: ToolDefinition<TopProductsArgs, TopProductsData> = {
  name: "get_top_products",
  description:
    "Retorna os produtos mais vendidos (por quantidade) em pedidos concluídos, para um período: hoje, últimos 7 dias ou últimos 30 dias.",
  requiredPermission: "dashboard_sales",
  kind: "read",
  parameters: {
    type: "object",
    properties: {
      range: {
        type: "string",
        description: "Período a consultar.",
        enum: ["today", "week", "month"],
      },
      limit: {
        type: "number",
        description: "Quantidade máxima de produtos a retornar (padrão 5, máximo 20).",
      },
    },
  },
  async run(ctx: AssistantContext, args: TopProductsArgs) {
    const range: SalesRange = args.range ?? "today";
    const limit = Math.min(Math.max(args.limit ?? 5, 1), 20);
    const { fromIso, toIso } = getRangeWindow(range);

    const { data: items, error } = (await ctx.supabase
      .from("order_items")
      .select("product_name,quantity,orders!inner(completed_at,status)")
      .eq("merchant_id", ctx.merchantId)
      .eq("orders.status", "completed")
      .gte("orders.completed_at", fromIso)
      .lt("orders.completed_at", toIso)) as unknown as {
      data: Array<{ product_name: string; quantity: number }> | null;
      error: { message: string } | null;
    };

    if (error) {
      return { ok: false, error: error.message };
    }

    const qtyByProduct = new Map<string, number>();
    for (const row of items ?? []) {
      const name = String(row.product_name ?? "").trim();
      if (!name) continue;
      qtyByProduct.set(name, (qtyByProduct.get(name) ?? 0) + Number(row.quantity ?? 0));
    }

    const products = Array.from(qtyByProduct.entries())
      .map(([productName, quantity]) => ({ productName, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit);

    return { ok: true, data: { range, fromIso, toIso, products } };
  },
};
