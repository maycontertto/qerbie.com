"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCustomerLanguage } from "@/app/t/CustomerLanguagePicker";
import { CustomerLanguage, tCustomer } from "@/lib/customer/i18n";

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
  created_at: string;
  customer_notes: string | null;
  total: number | null;
};

type Props = {
  merchantId: string;
  initialOrders: OrderRow[];
};

type RealtimeOrderPayload = {
  eventType: string;
  new: unknown;
  old: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function isOrderStatus(value: unknown): value is OrderRow["status"] {
  return (
    value === "pending" ||
    value === "confirmed" ||
    value === "preparing" ||
    value === "ready" ||
    value === "delivered" ||
    value === "completed" ||
    value === "cancelled"
  );
}

function statusLabel(lang: CustomerLanguage, status: OrderRow["status"]): string {
  switch (status) {
    case "pending":
    case "confirmed":
      return tCustomer(lang, "status_received");
    case "preparing":
      return tCustomer(lang, "status_preparing");
    case "ready":
      return tCustomer(lang, "status_ready");
    case "delivered":
    case "completed":
      return tCustomer(lang, "status_finished");
    case "cancelled":
      return tCustomer(lang, "status_cancelled");
  }
}

function fmtTime(iso: string, lang: CustomerLanguage): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const locale = lang === "en" ? "en-US" : lang === "es" ? "es-ES" : "pt-BR";
  return d.toLocaleString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CustomerOrdersRealtime({ merchantId, initialOrders }: Props) {
  const { lang } = useCustomerLanguage();
  const [orders, setOrders] = useState<OrderRow[]>(initialOrders);

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`orders-customer-${merchantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `merchant_id=eq.${merchantId}`,
        },
        (payload) => {
          const p = payload as unknown as RealtimeOrderPayload;
          const eventType = p.eventType;

          if (eventType === "DELETE") {
            const oldRow = asRecord(p.old);
            const id = String(oldRow?.id ?? "");
            if (!id) return;
            setOrders((prev) => prev.filter((o) => o.id !== id));
            return;
          }

          const row = asRecord(p.new);
          if (!row?.id) return;

          const statusRaw = row.status;
          if (!isOrderStatus(statusRaw)) return;

          const normalized: OrderRow = {
            id: String(row.id),
            order_number: Number(row.order_number ?? 0),
            status: statusRaw,
            created_at: String(row.created_at ?? new Date().toISOString()),
            customer_notes:
              typeof row.customer_notes === "string" ? row.customer_notes : null,
            total: row.total != null ? Number(row.total) : null,
          };

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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [merchantId]);

  const latest = useMemo(() => orders[0] ?? null, [orders]);

  return (
    <div className="space-y-4">
      {latest ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Pedido #{latest.order_number}
              </p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {tCustomer(lang, "status")}: <span className="font-semibold">{statusLabel(lang, latest.status)}</span>
                {latest.created_at ? ` • ${fmtTime(latest.created_at, lang)}` : ""}
              </p>
              {latest.customer_notes ? (
                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">
                  <span className="font-semibold">{tCustomer(lang, "obs")}:</span> {latest.customer_notes}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          {tCustomer(lang, "no_orders_yet")}
        </div>
      )}

      {orders.length > 1 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {tCustomer(lang, "previous_orders")}
          </p>
          <ul className="mt-3 space-y-2">
            {orders.slice(1, 6).map((o) => (
              <li
                key={o.id}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                    #{o.order_number}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {statusLabel(lang, o.status)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
