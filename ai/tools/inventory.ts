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
import { updateProductStockCore } from "@/lib/merchant/stockActions";

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

interface FindProductArgs {
  query: string;
  limit?: number;
}

interface FindProductRow {
  productId: string;
  productName: string;
  stockQuantity: number;
  trackStock: boolean;
  unitLabel: string;
}

interface FindProductData {
  products: FindProductRow[];
}

export const findProductTool: ToolDefinition<FindProductArgs, FindProductData> = {
  name: "find_product",
  description:
    "Busca produtos ativos cadastrados pelo nome (busca parcial). Use esta ferramenta antes de propor um ajuste de estoque, para obter o product_id correto — nunca invente um id de produto.",
  requiredPermission: "dashboard_products",
  kind: "read",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Parte do nome do produto a buscar." },
      limit: { type: "number", description: "Quantidade máxima de resultados (padrão 5, máximo 20)." },
    },
    required: ["query"],
  },
  async run(ctx: AssistantContext, args: FindProductArgs) {
    const query = String(args.query ?? "").trim();
    if (!query) {
      return { ok: false, error: "Informe um termo de busca para o nome do produto." };
    }
    const limit = Math.min(Math.max(args.limit ?? 5, 1), 20);

    const { data, error } = await ctx.supabase
      .from("products")
      .select("id, name, stock_quantity, track_stock, unit_label")
      .eq("merchant_id", ctx.merchantId)
      .eq("is_active", true)
      .ilike("name", `%${query}%`)
      .limit(limit);

    if (error) {
      return { ok: false, error: error.message };
    }

    const products = (data ?? []).map((p) => ({
      productId: p.id,
      productName: p.name,
      stockQuantity: Number(p.stock_quantity ?? 0),
      trackStock: Boolean(p.track_stock),
      unitLabel: p.unit_label || "un",
    }));

    return { ok: true, data: { products } };
  },
};

interface AdjustStockArgs {
  productId: string;
  newQuantity: number;
}

interface AdjustStockData {
  productId: string;
  productName: string;
  previousQuantity: number;
  newQuantity: number;
}

async function loadProductForStockAdjust(ctx: AssistantContext, productId: string) {
  const { data } = await ctx.supabase
    .from("products")
    .select("id, name, stock_quantity, unit_label")
    .eq("merchant_id", ctx.merchantId)
    .eq("id", productId)
    .maybeSingle();
  return data;
}

export const adjustStockTool: ToolDefinition<AdjustStockArgs, AdjustStockData> = {
  name: "adjust_stock",
  description:
    "Propõe alterar a quantidade em estoque de um produto já cadastrado. Sempre use find_product antes para obter o product_id certo — nunca invente um id. Só o dono do estabelecimento pode confirmar esta ação.",
  requiredPermission: "dashboard_products",
  kind: "write",
  parameters: {
    type: "object",
    properties: {
      productId: { type: "string", description: "UUID do produto (obtido de find_product)." },
      newQuantity: { type: "number", description: "Nova quantidade em estoque (0 ou mais)." },
    },
    required: ["productId", "newQuantity"],
  },
  async buildPreview(ctx: AssistantContext, args: AdjustStockArgs) {
    const product = await loadProductForStockAdjust(ctx, args.productId);
    if (!product) {
      throw new Error("Não encontrei esse produto para ajustar o estoque. Confirme o nome e tente de novo.");
    }
    const unit = product.unit_label || "un";
    return `Ajustar o estoque de "${product.name}" de ${Number(product.stock_quantity ?? 0)} para ${args.newQuantity} ${unit}. Confirma?`;
  },
  async run(ctx: AssistantContext, args: AdjustStockArgs) {
    if (!ctx.isOwner) {
      return { ok: false, error: "Somente o dono do estabelecimento pode ajustar o estoque pelo assistente." };
    }
    if (!Number.isFinite(args.newQuantity) || args.newQuantity < 0) {
      return { ok: false, error: "Quantidade inválida." };
    }

    const product = await loadProductForStockAdjust(ctx, args.productId);
    if (!product) {
      return { ok: false, error: "Produto não encontrado." };
    }

    const clampedQuantity = Math.round(Math.max(0, Math.min(1_000_000, args.newQuantity)) * 1000) / 1000;

    const result = await updateProductStockCore(ctx.supabase, {
      merchantId: ctx.merchantId,
      productId: args.productId,
      trackStock: true,
      stockQuantity: clampedQuantity,
    });

    if (!result.ok) {
      return { ok: false, error: "Não foi possível salvar o novo estoque agora. Tente novamente." };
    }

    return {
      ok: true,
      data: {
        productId: product.id,
        productName: product.name,
        previousQuantity: Number(product.stock_quantity ?? 0),
        newQuantity: clampedQuantity,
      },
    };
  },
};
