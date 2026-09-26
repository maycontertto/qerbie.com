"use client";

import Link from "next/link";
import { CustomerLanguagePicker, useCustomerLanguage } from "@/app/t/CustomerLanguagePicker";
import { tCustomer } from "@/lib/customer/i18n";
import { CustomerOrdersRealtime } from "@/app/t/[qrToken]/pedidos/CustomerOrdersRealtime";

type Branding = {
  displayName: string;
  logoUrl: string | null;
};

type PaymentSettings = {
  pixKey: string | null;
  pixDescription: string | null;
  cardUrl: string | null;
  cardDescription: string | null;
  cashDescription: string | null;
  disclaimer: string | null;
};

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
  order_type: "dine_in" | "takeaway" | "delivery";
  delivery_address: string | null;
  delivery_fee: number | null;
  delivery_eta_minutes: number | null;
  items: Array<{ product_name: string; quantity: number; unit_price: number; line_total: number }>;
};

export function CustomerOrdersShell({
  qrToken,
  branding,
  serviceLabel,
  sessionToken,
  initialOrders,
  paymentSettings,
}: {
  qrToken: string;
  branding: Branding;
  serviceLabel: string;
  sessionToken: string;
  initialOrders: OrderRow[];
  paymentSettings: PaymentSettings;
}) {
  const { lang, setLang } = useCustomerLanguage();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto max-w-xl px-4 py-10 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logoUrl}
                alt={branding.displayName}
                className="h-10 w-10 rounded-xl border border-zinc-200 bg-white object-cover dark:border-zinc-800"
              />
            ) : (
              <div className="h-10 w-10 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" />
            )}
            <div>
              <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                {branding.displayName}
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {tCustomer(lang, "orders_tracking")}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {serviceLabel}
              </p>
            </div>
          </div>

          <CustomerLanguagePicker value={lang} onChange={setLang} />
        </div>

        <div className="mt-6">
          {!sessionToken ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
              {tCustomer(lang, "session_missing")}
              <div className="mt-3">
                <Link
                  href={`/t/${encodeURIComponent(qrToken)}`}
                  className="inline-block rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500"
                >
                  {tCustomer(lang, "back")}
                </Link>
              </div>
            </div>
          ) : (
            <CustomerOrdersRealtime qrToken={qrToken} initialOrders={initialOrders} paymentSettings={paymentSettings} />
          )}
        </div>

        <div className="mt-6">
          <Link
            href={`/t/${encodeURIComponent(qrToken)}/menu`}
            className="text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
          >
            {tCustomer(lang, "go_back_menu")}
          </Link>
        </div>
      </main>
    </div>
  );
}
