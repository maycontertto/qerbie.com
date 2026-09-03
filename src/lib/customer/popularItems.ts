import { createAdminClient } from "@/lib/supabase/admin";

export interface PopularMenuItem {
  productName: string;
  timesOrdered: number;
}

/**
 * Agrega os itens mais pedidos (pedidos concluídos, últimos 30 dias) de um
 * estabelecimento, para o assistente de autoatendimento do cliente
 * (src/app/api/public/menu-assistant/[qrToken]/route.ts). Usa o service role
 * porque o cliente anônimo só pode ler os PRÓPRIOS pedidos via RLS
 * (orders_anon_select) — merchantId vem sempre resolvido no servidor a
 * partir do qrToken, nunca de dado enviado pelo cliente, e só devolvemos
 * nome do produto + contagem (nunca receita ou dado de outro cliente).
 */
export async function getPopularMenuItemsCore(merchantId: string, limit = 5): Promise<PopularMenuItem[]> {
  const supabase = createAdminClient();
  const fromIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = (await supabase
    .from("order_items")
    .select("product_name,quantity,orders!inner(completed_at,status)")
    .eq("merchant_id", merchantId)
    .eq("orders.status", "completed")
    .gte("orders.completed_at", fromIso)) as unknown as {
    data: Array<{ product_name: string; quantity: number }> | null;
    error: { message: string } | null;
  };

  if (error || !data) return [];

  const qtyByProduct = new Map<string, number>();
  for (const row of data) {
    qtyByProduct.set(row.product_name, (qtyByProduct.get(row.product_name) ?? 0) + row.quantity);
  }

  return [...qtyByProduct.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([productName, timesOrdered]) => ({ productName, timesOrdered }));
}
