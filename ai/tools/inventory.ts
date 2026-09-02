/**
 * Ferramentas de estoque. Consulta somente leitura, sempre filtrada por
 * `ctx.merchantId`.
 *
 * "Estoque baixo" usa `products.stock_min_quantity` (mínimo configurado pelo
 * lojista, ver integrations/supabase/schema/040_casa_racao_comercial.sql),
 * comparando com `stock_quantity` em memória — o Supabase/PostgREST não
 * compara duas colunas diretamente via query builder.
 */
import type { AssistantContext, ToolDefinition } from "@ai/types";

interface LowStockArgs {
  limit?: number;
}

interface LowStockRow {
  productName: string;
  stockQuantity: number;
  stockMinQuantity: number;
  unitLabel: string;
}

interface LowStockData {
  products: LowStockRow[];
}

export const getLowStockTool: ToolDefinition<LowStockArgs, LowStockData> = {
  name: "get_low_stock",
  description:
    "Retorna os produtos com controle de estoque ativado cuja quantidade em estoque está no mínimo configurado ou abaixo dele (estoque baixo/acabando).",
  requiredPermission: "dashboard_products",
  kind: "read",
  parameters: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        description: "Quantidade máxima de produtos a retornar (padrão 10, máximo 50).",
      },
    },
  },
  async run(ctx: AssistantContext, args: LowStockArgs) {
    const limit = Math.min(Math.max(args.limit ?? 10, 1), 50);

    const { data, error } = await ctx.supabase
      .from("products")
      .select("name, stock_quantity, stock_min_quantity, unit_label")
      .eq("merchant_id", ctx.merchantId)
      .eq("is_active", true)
      .eq("track_stock", true);

    if (error) {
      return { ok: false, error: error.message };
    }

    const products = (data ?? [])
      .filter((p) => Number(p.stock_quantity ?? 0) <= Number(p.stock_min_quantity ?? 0))
      .sort((a, b) => Number(a.stock_quantity ?? 0) - Number(b.stock_quantity ?? 0))
      .slice(0, limit)
      .map((p) => ({
        productName: p.name,
        stockQuantity: Number(p.stock_quantity ?? 0),
        stockMinQuantity: Number(p.stock_min_quantity ?? 0),
        unitLabel: p.unit_label || "un",
      }));

    return { ok: true, data: { products } };
  },
};
