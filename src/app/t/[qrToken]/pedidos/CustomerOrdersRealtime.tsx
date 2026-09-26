"use client";

import { useCallback, useEffect, useState } from "react";
import { useCustomerLanguage } from "@/app/t/CustomerLanguagePicker";
import { CustomerLanguage, tCustomer } from "@/lib/customer/i18n";

type OrderStatus = "pending" | "confirmed" | "preparing" | "ready" | "delivered" | "completed" | "cancelled";
type OrderItem = { product_name: string; quantity: number; unit_price: number; line_total: number };
type OrderRow = {
  id: string;
  order_number: number;
  status: OrderStatus;
  created_at: string;
  customer_notes: string | null;
  total: number | null;
  order_type: "dine_in" | "takeaway" | "delivery";
  delivery_address: string | null;
  delivery_fee: number | null;
  delivery_eta_minutes: number | null;
  items: OrderItem[];
};
type PaymentSettings = {
  pixKey: string | null;
  pixDescription: string | null;
  cardUrl: string | null;
  cardDescription: string | null;
  cashDescription: string | null;
  disclaimer: string | null;
};

function formatMoney(value: number, lang: string) {
  const locale = lang === "en" ? "en-US" : lang === "es" ? "es-ES" : "pt-BR";
  return new Intl.NumberFormat(locale, { style: "currency", currency: "BRL" }).format(value);
}

function safePaymentUrl(value: string | null | undefined): string | null {
  try {
    const url = new URL((value ?? "").trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function statusLabel(lang: CustomerLanguage, status: OrderStatus): string {
  switch (status) {
    case "pending": return "Aguardando confirmação";
    case "confirmed": return "Pedido confirmado";
    case "preparing": return tCustomer(lang, "status_preparing");
    case "ready": return tCustomer(lang, "status_ready");
    case "delivered":
    case "completed": return tCustomer(lang, "status_finished");
    case "cancelled": return tCustomer(lang, "status_cancelled");
  }
}

function progressIndex(status: OrderStatus): number {
  if (status === "pending") return 0;
  if (status === "confirmed") return 1;
  if (status === "preparing") return 2;
  return 3;
}

function OrderCard({
  order,
  qrToken,
  paymentSettings,
  onCancelled,
}: {
  order: OrderRow;
  qrToken: string;
  paymentSettings: PaymentSettings;
  onCancelled: (id: string) => void;
}) {
  const { lang } = useCustomerLanguage();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const steps = ["Recebido", "Confirmado", "Preparando", order.order_type === "delivery" ? "Saiu para entrega" : "Pronto"];
  const current = progressIndex(order.status);
  const cardUrl = safePaymentUrl(paymentSettings.cardUrl);

  async function cancelOrder() {
    if (!window.confirm(`Cancelar o pedido #${order.order_number}?`)) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/t/${encodeURIComponent(qrToken)}/orders`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "cancel", orderId: order.id }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(body.error === "order_cannot_be_cancelled" ? "O comerciante já começou a preparar este pedido. Fale com a loja para solicitar o cancelamento." : "Não foi possível cancelar agora. Atualize o pedido e tente novamente.");
        return;
      }
      onCancelled(order.id);
    } catch {
      setMessage("Sem conexão. O pedido continua ativo; tente novamente quando a internet voltar.");
    } finally {
      setBusy(false);
    }
  }

  async function copyPix() {
    const key = paymentSettings.pixKey?.trim();
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      setMessage("Chave Pix copiada. Confira o valor e o destinatário antes de pagar.");
    } catch {
      setMessage(`Chave Pix: ${key}`);
    }
  }

  const date = new Date(order.created_at);
  const time = Number.isNaN(date.getTime()) ? "" : date.toLocaleString(lang === "en" ? "en-US" : lang === "es" ? "es-ES" : "pt-BR", { dateStyle: "short", timeStyle: "short" });

  return (
    <article className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-100 bg-gradient-to-r from-emerald-50 to-white p-5 dark:border-zinc-800 dark:from-emerald-950/40 dark:to-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Seu pedido</p>
            <h2 className="mt-1 text-2xl font-bold text-zinc-950 dark:text-zinc-50">#{order.order_number}</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{statusLabel(lang, order.status)}{time ? ` · ${time}` : ""}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${order.status === "cancelled" ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" : order.status === "completed" || order.status === "delivered" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200"}`}>
            {order.status === "cancelled" ? "Cancelado" : order.status === "completed" || order.status === "delivered" ? "Concluído" : "Em andamento"}
          </span>
        </div>
        {order.status !== "cancelled" && (
          <ol className="mt-5 grid grid-cols-4 gap-2">
            {steps.map((step, index) => {
              const complete = order.status === "completed" || order.status === "delivered" || index <= current;
              return <li key={step} className="min-w-0">
                <div className={`h-1.5 rounded-full ${complete ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-700"}`} />
                <p className={`mt-2 text-[10px] font-semibold leading-tight sm:text-xs ${complete ? "text-emerald-800 dark:text-emerald-300" : "text-zinc-400"}`}>{step}</p>
              </li>;
            })}
          </ol>
        )}
      </div>

      <div className="space-y-4 p-5">
        {order.items.length > 0 && <ul className="space-y-2">
          {order.items.map((item, index) => <li key={`${item.product_name}-${index}`} className="flex justify-between gap-3 text-sm">
            <span className="text-zinc-700 dark:text-zinc-200">{item.quantity}× {item.product_name}</span>
            <span className="shrink-0 font-medium text-zinc-900 dark:text-zinc-50">{formatMoney(Number(item.line_total), lang)}</span>
          </li>)}
        </ul>}
        {order.delivery_address && <p className="rounded-xl bg-zinc-50 p-3 text-sm text-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"><strong>Entrega:</strong> {order.delivery_address}{order.delivery_eta_minutes ? ` · previsão de ${order.delivery_eta_minutes} min` : ""}</p>}
        {order.customer_notes && <p className="text-sm text-zinc-600 dark:text-zinc-300"><strong>Observação:</strong> {order.customer_notes}</p>}
        <div className="flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">Total</span>
          <span className="text-xl font-bold text-zinc-950 dark:text-zinc-50">{formatMoney(Number(order.total ?? 0), lang)}</span>
        </div>

        {order.status !== "cancelled" && order.status !== "completed" && order.status !== "delivered" && (paymentSettings.pixKey || cardUrl || paymentSettings.cashDescription) && <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
          <p className="font-semibold text-zinc-900 dark:text-zinc-50">Pagar direto ao comerciante</p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{paymentSettings.disclaimer?.trim() || "O pagamento é feito diretamente com o estabelecimento. A Qerbie não processa pagamentos."}</p>
          {paymentSettings.pixKey && <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 text-xs text-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">{paymentSettings.pixKey}</code>
            <button type="button" onClick={copyPix} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600">Copiar Pix</button>
          </div>}
          {paymentSettings.pixDescription && <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">{paymentSettings.pixDescription}</p>}
          {cardUrl && <a href={cardUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900">{paymentSettings.cardDescription?.trim() || "Abrir pagamento com cartão"}</a>}
          {paymentSettings.cashDescription && <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">Dinheiro: {paymentSettings.cashDescription}</p>}
          <p className="mt-2 text-[11px] text-zinc-500">Confirme o pagamento diretamente com a loja. O status do pedido não confirma que o valor foi pago.</p>
        </div>}

        {order.status === "pending" && <button type="button" disabled={busy} onClick={cancelOrder} className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950">{busy ? "Cancelando…" : "Cancelar pedido"}</button>}
        {message && <p role="status" className="rounded-xl bg-zinc-100 p-3 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">{message}</p>}
      </div>
    </article>
  );
}

export function CustomerOrdersRealtime({ qrToken, initialOrders, paymentSettings }: {
  qrToken: string;
  initialOrders: OrderRow[];
  paymentSettings: PaymentSettings;
}) {
  const { lang } = useCustomerLanguage();
  const [orders, setOrders] = useState<OrderRow[]>(initialOrders);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const response = await fetch(`/api/t/${encodeURIComponent(qrToken)}/orders`, { cache: "no-store" });
      if (!response.ok) throw new Error("Não foi possível atualizar seus pedidos.");
      const body = (await response.json()) as { orders?: OrderRow[] };
      setOrders(body.orders ?? []);
      setError("");
    } catch {
      setError("Não foi possível atualizar agora. Confira sua conexão e tente novamente.");
    } finally {
      if (!quiet) setRefreshing(false);
    }
  }, [qrToken]);

  useEffect(() => {
    void refresh(true);
    const timer = window.setInterval(() => void refresh(true), 12000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const activeOrders = orders.filter((order) => order.status !== "completed" && order.status !== "delivered" && order.status !== "cancelled");
  const pastOrders = orders.filter((order) => !activeOrders.some((active) => active.id === order.id));

  return <div className="space-y-5">
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-zinc-600 dark:text-zinc-300">Atualizamos o status automaticamente.</p>
      <button type="button" disabled={refreshing} onClick={() => void refresh()} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">{refreshing ? "Atualizando…" : "Atualizar"}</button>
    </div>
    {error && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">{error}</p>}
    {orders.length === 0 ? <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">{tCustomer(lang, "no_orders_yet")}</div> : <>
      {activeOrders.map((order) => <OrderCard key={order.id} order={order} qrToken={qrToken} paymentSettings={paymentSettings} onCancelled={(id) => setOrders((prev) => prev.map((item) => item.id === id ? { ...item, status: "cancelled" } : item))} />)}
      {pastOrders.length > 0 && <details className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <summary className="cursor-pointer text-sm font-semibold text-zinc-800 dark:text-zinc-100">Pedidos anteriores ({pastOrders.length})</summary>
        <div className="mt-4 space-y-4">{pastOrders.map((order) => <OrderCard key={order.id} order={order} qrToken={qrToken} paymentSettings={paymentSettings} onCancelled={() => undefined} />)}</div>
      </details>}
    </>}
  </div>;
}
