"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type OrderRow = {
  id: string;
  order_number: number;
  status:
    | "pending"
    | "confirmed"
    | "preparing"
    | "ready"
    | "delivered"
    | "completed"
    | "cancelled";
  order_type: "dine_in" | "takeaway" | "delivery";
  created_at: string;
  customer_name: string | null;
  customer_notes: string | null;
  table_id: string | null;
  total: number | null;
  payment_method?: string | null;
  payment_notes?: string | null;
  delivery_address?: string | null;
  delivery_fee?: number | null;
};

type RealtimeOrderRow = {
  id: unknown;
  order_number?: unknown;
  status?: unknown;
  order_type?: unknown;
  created_at?: unknown;
  customer_name?: unknown;
  customer_notes?: unknown;
  table_id?: unknown;
  total?: unknown;
  payment_method?: unknown;
  payment_notes?: unknown;
  delivery_address?: unknown;
  delivery_fee?: unknown;
};

function paymentLabel(method: string | null | undefined): string {
  const m = String(method ?? "").trim().toLowerCase();
  if (!m) return "";
  if (m === "cash") return "Dinheiro";
  if (m === "pix") return "Pix";
  if (m === "card") return "Cartão";
  if (m === "other") return "Outro";
  return m;
}

type OrderItemRow = {
  id: string;
  order_id: string;
  product_name: string;
  quantity: number;
  notes: string | null;
};

type Props = {
  merchantId: string;
  initialOrders: OrderRow[];
  initialItemsByOrderId: Record<string, OrderItemRow[]>;
  tableLabelById: Record<string, string>;
  setOrderStatusAction: (formData: FormData) => Promise<void>;
  orderTypeFilter?: OrderRow["order_type"];
};

function statusLabel(status: OrderRow["status"]): string {
  switch (status) {
    case "pending":
    case "confirmed":
      return "Recebido";
    case "preparing":
      return "Em preparo";
    case "ready":
      return "Pronto";
    case "delivered":
    case "completed":
      return "Finalizado";
    case "cancelled":
      return "Cancelado";
  }
}

function statusPillClass(status: OrderRow["status"]): string {
  switch (status) {
    case "pending":
    case "confirmed":
      return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200";
    case "preparing":
      return "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200";
    case "ready":
      return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200";
    case "delivered":
    case "completed":
      return "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200";
    case "cancelled":
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200";
  }
}

function typeLabel(order: OrderRow, tableLabelById: Record<string, string>): string {
  if (order.order_type === "takeaway") return "Retirada";
  if (order.order_type === "delivery") return "Entrega";
  const label = order.table_id ? tableLabelById[order.table_id] : null;
  return label ? `Mesa ${label}` : "Mesa";
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OrdersRealtimeBoard({
  merchantId,
  initialOrders,
  initialItemsByOrderId,
  tableLabelById,
  setOrderStatusAction,
  orderTypeFilter,
}: Props) {
  const [orders, setOrders] = useState<OrderRow[]>(initialOrders);
  const [itemsByOrderId, setItemsByOrderId] = useState<Record<string, OrderItemRow[]>>(
    initialItemsByOrderId,
  );

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  useEffect(() => {
    setItemsByOrderId(initialItemsByOrderId);
  }, [initialItemsByOrderId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`orders-merchant-${merchantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `merchant_id=eq.${merchantId}`,
        },
        (payload) => {
          const eventType = payload.eventType;

          if (eventType === "DELETE") {
            const oldRow = payload.old as Record<string, unknown>;
            const id = String(oldRow?.id ?? "");
            if (!id) return;
            setOrders((prev) => prev.filter((o) => o.id !== id));
            return;
          }

            const row = (payload.new ?? null) as RealtimeOrderRow | null;
            const normalized: OrderRow | null = row?.id
            ? {
                  id: String(row.id),
                  order_number: Number(row.order_number ?? 0),
                  status: (row.status as OrderRow["status"]) ?? "pending",
                  order_type: (row.order_type as OrderRow["order_type"]) ?? "dine_in",
                  created_at: String(row.created_at ?? new Date().toISOString()),
                  customer_name: (row.customer_name as string | null) ?? null,
                  customer_notes: (row.customer_notes as string | null) ?? null,
                  table_id: (row.table_id as string | null) ?? null,
                  total: row.total != null ? Number(row.total) : null,
              payment_method: (row.payment_method as string | null) ?? null,
              payment_notes: (row.payment_notes as string | null) ?? null,
                  delivery_address: (row.delivery_address as string | null) ?? null,
                  delivery_fee: row.delivery_fee != null ? Number(row.delivery_fee) : null,
              }
            : null;

          if (!normalized) return;

          if (orderTypeFilter && normalized.order_type !== orderTypeFilter) {
            setOrders((prev) => prev.filter((o) => o.id !== normalized.id));
            return;
          }

          setOrders((prev) => {
            const idx = prev.findIndex((o) => o.id === normalized.id);
            if (idx === -1) {
              return [normalized, ...prev].sort(
                (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
              );
            }
            const next = [...prev];
            next[idx] = { ...next[idx], ...normalized };
            return next;
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "order_items",
          filter: `merchant_id=eq.${merchantId}`,
        },
        (payload) => {
          const eventType = payload.eventType;

          if (eventType === "DELETE") {
            const oldRow = payload.old as Record<string, unknown>;
            const id = String(oldRow?.id ?? "");
            const orderId = String(oldRow?.order_id ?? "");
            if (!id || !orderId) return;

            setItemsByOrderId((prev) => {
              const current = prev[orderId] ?? [];
              const nextItems = current.filter((x) => x.id !== id);
              return { ...prev, [orderId]: nextItems };
            });
            return;
          }

          const row = (payload.new ?? null) as Record<string, unknown>;
          if (!row?.id || !row?.order_id) return;

          const normalizeOptionalText = (value: unknown): string | null => {
            if (value == null) return null;
            if (typeof value === "string") return value;
            if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
              return String(value);
            }
            try {
              return JSON.stringify(value);
            } catch {
              return String(value);
            }
          };

          const normalized: OrderItemRow = {
            id: String(row.id),
            order_id: String(row.order_id),
            product_name: String(row.product_name ?? ""),
            quantity: Number(row.quantity ?? 1),
            notes: normalizeOptionalText(row.notes),
          };

          setItemsByOrderId((prev) => {
            const orderId = normalized.order_id;
            const current = prev[orderId] ?? [];
            const idx = current.findIndex((x) => x.id === normalized.id);
            const next = idx === -1 ? [...current, normalized] : current.map((x) => (x.id === normalized.id ? { ...x, ...normalized } : x));
            return { ...prev, [orderId]: next };
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [merchantId, orderTypeFilter]);

  const active = useMemo(
    () => orders.filter((o) => o.status !== "completed" && o.status !== "cancelled"),
    [orders],
  );
  const done = useMemo(
    () => orders.filter((o) => o.status === "completed" || o.status === "cancelled"),
    [orders],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Pedidos ativos
          </h2>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Atualiza em tempo real
          </span>
        </div>

        {!active.length ? (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            Nenhum pedido ativo agora.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {active.map((o) => (
              <li
                key={o.id}
                className="rounded-2xl border border-zinc-200 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/50"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        Pedido #{o.order_number}
                      </p>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusPillClass(
                          o.status,
                        )}`}
                      >
                        {statusLabel(o.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {typeLabel(o, tableLabelById)} • {fmtTime(o.created_at)}
                      {o.customer_name ? ` • ${o.customer_name}` : ""}
                    </p>
                    {o.order_type === "delivery" && o.delivery_address ? (
                      <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">
                        <span className="font-semibold">Endereço:</span> {o.delivery_address}
                      </p>
                    ) : null}
                    {o.customer_notes ? (
                      <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">
                        <span className="font-semibold">Obs:</span> {o.customer_notes}
                      </p>
                    ) : null}

                    {(itemsByOrderId[o.id]?.length ?? 0) > 0 ? (
                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          Itens
                        </p>
                        <ul className="mt-2 space-y-1">
                          {(itemsByOrderId[o.id] ?? []).map((it) => (
                            <li key={it.id} className="text-sm text-zinc-700 dark:text-zinc-200">
                              <span className="font-semibold">{it.quantity}x</span> {it.product_name}
                              {it.notes ? (
                                <span className="text-xs text-zinc-500 dark:text-zinc-400"> — {it.notes}</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <form action={setOrderStatusAction}>
                      <input type="hidden" name="order_id" value={o.id} />
                      <input type="hidden" name="status" value="confirmed" />
                      <button
                        type="submit"
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
                      >
                        Recebido
                      </button>
                    </form>
                    <form action={setOrderStatusAction}>
                      <input type="hidden" name="order_id" value={o.id} />
                      <input type="hidden" name="status" value="preparing" />
                      <button
                        type="submit"
                        className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-900 hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100 dark:hover:bg-sky-900"
                      >
                        Em preparo
                      </button>
                    </form>
                    <form action={setOrderStatusAction}>
                      <input type="hidden" name="order_id" value={o.id} />
                      <input type="hidden" name="status" value="ready" />
                      <button
                        type="submit"
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100 dark:hover:bg-emerald-900"
                      >
                        Pronto
                      </button>
                    </form>
                    <form action={setOrderStatusAction}>
                      <input type="hidden" name="order_id" value={o.id} />
                      <input type="hidden" name="status" value="completed" />
                      <button
                        type="submit"
                        className="rounded-lg border border-zinc-200 bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:border-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                      >
                        Finalizar
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Finalizados / cancelados
          </h2>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {done.length}
          </span>
        </div>

        {!done.length ? (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            Nada por aqui ainda.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800">
            {done.slice(0, 30).map((o) => (
              <li key={o.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Pedido #{o.order_number}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {typeLabel(o, tableLabelById)} • {fmtTime(o.created_at)}
                    </p>
                    {o.status === "completed" && o.payment_method ? (
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        Pago: {paymentLabel(o.payment_method)}
                        {o.payment_notes ? ` • ${o.payment_notes}` : ""}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusPillClass(
                      o.status,
                    )}`}
                  >
                    {statusLabel(o.status)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
