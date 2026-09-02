/**
 * Ferramentas de catálogo (edição de produtos). Escrita sempre filtrada por
 * `ctx.merchantId`, nunca recebe merchant/produto de fora do que já existe
 * no banco — ver `find_product` (ai/tools/inventory.ts) para localizar o
 * `productId` antes de propor uma edição.
 */
import type { AssistantContext, ToolDefinition } from "@ai/types";
import { updateProductFieldsCore } from "@/lib/catalog/actions";

interface UpdateProductArgs {
  productId: string;
  name?: string;
  description?: string;
  price?: number;
  isActive?: boolean;
}

interface UpdateProductData {
  productId: string;
  productName: string;
}

async function loadProductForEdit(ctx: AssistantContext, productId: string) {
  const { data } = await ctx.supabase
    .from("products")
    .select("id, name, description, price, is_active")
    .eq("merchant_id", ctx.merchantId)
    .eq("id", productId)
    .maybeSingle();
  return data;
}

function formatPriceBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export const updateProductTool: ToolDefinition<UpdateProductArgs, UpdateProductData> = {
  name: "update_product",
  description:
    "Propõe alterar campos de um produto já cadastrado (nome, descrição, preço e/ou ativo/inativo). Só altera os campos informados — os demais permanecem como estão. Sempre use find_product antes para obter o product_id certo. Não altera estoque (use adjust_stock para isso).",
  requiredPermission: "dashboard_products",
  kind: "write",
  parameters: {
    type: "object",
    properties: {
      productId: { type: "string", description: "UUID do produto (obtido de find_product)." },
      name: { type: "string", description: "Novo nome do produto." },
      description: { type: "string", description: "Nova descrição do produto." },
      price: { type: "number", description: "Novo preço de venda (em reais)." },
      isActive: { type: "boolean", description: "true para ativar, false para desativar o produto (desativar zera o estoque)." },
    },
    required: ["productId"],
  },
  async buildPreview(ctx: AssistantContext, args: UpdateProductArgs) {
    const product = await loadProductForEdit(ctx, args.productId);
    if (!product) {
      throw new Error("Não encontrei esse produto para editar. Confirme o nome e tente de novo.");
    }

    const changes: string[] = [];
    if (args.name !== undefined && args.name !== product.name) {
      changes.push(`nome de "${product.name}" para "${args.name}"`);
    }
    if (args.description !== undefined) {
      changes.push(`descrição para "${args.description}"`);
    }
    if (args.price !== undefined) {
      changes.push(`preço de ${formatPriceBRL(Number(product.price ?? 0))} para ${formatPriceBRL(args.price)}`);
    }
    if (args.isActive !== undefined && args.isActive !== product.is_active) {
      changes.push(args.isActive ? "reativar o produto" : "desativar o produto (o estoque será zerado)");
    }

    if (changes.length === 0) {
      throw new Error("Nenhuma alteração real foi informada para esse produto.");
    }

    return `Em "${product.name}": ${changes.join("; ")}. Confirma?`;
  },
  async run(ctx: AssistantContext, args: UpdateProductArgs) {
    const product = await loadProductForEdit(ctx, args.productId);
    if (!product) {
      return { ok: false, error: "Produto não encontrado." };
    }

    const result = await updateProductFieldsCore(ctx.supabase, {
      merchantId: ctx.merchantId,
      productId: args.productId,
      name: args.name,
      description: args.description,
      price: args.price,
      isActive: args.isActive,
    });

    if (!result.ok) {
      return { ok: false, error: "Não foi possível salvar as alterações agora. Tente novamente." };
    }

    return {
      ok: true,
      data: { productId: product.id, productName: args.name ?? product.name },
    };
  },
};
