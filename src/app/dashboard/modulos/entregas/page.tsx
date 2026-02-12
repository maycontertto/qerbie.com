import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { OrdersRealtimeBoard } from "@/app/dashboard/modulos/pedidos/OrdersRealtimeBoard";
import { setOrderStatus } from "@/lib/merchant/ordersActions";
import type { Database } from "@/lib/supabase/database.types";
import Link from "next/link";

type BoardOrderRow = Pick<
  Database["public"]["Tables"]["orders"]["Row"],
  | "id"
  | "order_number"
  | "status"
  | "order_type"
  | "created_at"
  | "customer_name"
  | "customer_notes"
  | "table_id"
  | "total"
  | "payment_method"
  | "payment_notes"
  | "delivery_address"
  | "delivery_fee"
>;

export default async function EntregasModulePage() {
  const { user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const canOrders =
    isOwner ||
    (membership
      ? hasMemberPermission(membership.role, membership.permissions, "dashboard_orders")
      : false);

  if (!canOrders) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <a
              href="/dashboard"
              className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
            >
              ← Voltar ao painel
            </a>
            <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Entregas
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Você não tem permissão para acessar este módulo.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const supabase = await createClient();

  const { data: tables } = await supabase
    .from("merchant_tables")
    .select("id, label")
    .eq("merchant_id", merchant.id);

  const tableLabelById = Object.fromEntries(
    (tables ?? []).map((t) => [t.id, t.label] as const),
  );

  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, order_type, created_at, customer_name, customer_notes, table_id, total, payment_method, payment_notes, delivery_address, delivery_fee",
    )
    .eq("merchant_id", merchant.id)
    .eq("order_type", "delivery")
    .order("created_at", { ascending: false })
    .limit(80);

  const orderIds = (orders ?? []).map((o) => o.id);

  const initialOrders: BoardOrderRow[] = (orders ?? []).map((o) => ({
    id: o.id,
    order_number: o.order_number,
    status: o.status,
    order_type: o.order_type,
    created_at: o.created_at,
    customer_name: o.customer_name,
    customer_notes: o.customer_notes,
    table_id: o.table_id,
    total: o.total ?? 0,
    payment_method: (o as BoardOrderRow).payment_method ?? null,
    payment_notes: (o as BoardOrderRow).payment_notes ?? null,
    delivery_address: (o as BoardOrderRow).delivery_address ?? null,
    delivery_fee: (o as BoardOrderRow).delivery_fee ?? null,
  }));

  const { data: orderItems } = orderIds.length
    ? await supabase
        .from("order_items")
        .select("id, order_id, product_name, quantity, notes")
        .eq("merchant_id", merchant.id)
        .in("order_id", orderIds)
        .order("created_at", { ascending: true })
    : { data: [] as Array<{ id: string; order_id: string; product_name: string; quantity: number; notes: string | null }> };

  const itemsByOrderId: Record<
    string,
    { id: string; order_id: string; product_name: string; quantity: number; notes: string | null }[]
  > = {};

  for (const it of orderItems ?? []) {
    const key = String(it.order_id ?? "");
    if (!key) continue;
    (itemsByOrderId[key] ??= []).push({
      id: String(it.id ?? ""),
      order_id: key,
      product_name: String(it.product_name ?? ""),
      quantity: Number(it.quantity ?? 1),
      notes: it.notes ?? null,
    });
  }

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <a
              href="/dashboard"
              className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
            >
              ← Voltar ao painel
            </a>
            <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Entregas
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Pedidos para entrega e status.
            </p>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Configurações (taxa/tempo/observação): <Link className="underline" href="/dashboard/modulos/entrega">Entrega</Link>
            </p>
          </div>
        </div>

        <div className="mt-8">
          <OrdersRealtimeBoard
            merchantId={merchant.id}
            initialOrders={initialOrders}
            initialItemsByOrderId={itemsByOrderId}
            tableLabelById={tableLabelById}
            setOrderStatusAction={setOrderStatus}
            orderTypeFilter="delivery"
          />
        </div>
      </main>
    </div>
  );
}
