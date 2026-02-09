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
};

export function CustomerOrdersShell({
  qrToken,
  branding,
  serviceLabel,
  sessionToken,
  merchantId,
  initialOrders,
  paymentSettings,
}: {
  qrToken: string;
  branding: Branding;
  serviceLabel: string;
  sessionToken: string;
  merchantId: string;
  initialOrders: OrderRow[];
  paymentSettings: PaymentSettings;
}) {
  const { lang, setLang } = useCustomerLanguage();

  const paymentMethods = (() => {
    const methods: Array<
      | { kind: "pix"; title: string; description: string; key: string }
      | { kind: "link"; title: string; description: string; url: string }
      | { kind: "cash"; title: string; description: string }
    > = [];

    const pixKey = (paymentSettings.pixKey ?? "").trim();
    if (pixKey) {
      methods.push({
        kind: "pix",
        title: "Pix",
        description: paymentSettings.pixDescription?.trim() || "Use a chave abaixo para pagar via Pix.",
        key: pixKey,
      });
    }

    const cardUrl = (paymentSettings.cardUrl ?? "").trim();
    if (cardUrl) {
      methods.push({
        kind: "link",
        title: "Link (cartão/checkout)",
        description: paymentSettings.cardDescription?.trim() || "Abra o link abaixo para pagar.",
        url: cardUrl,
      });
    }

    const cash = (paymentSettings.cashDescription ?? "").trim();
    if (cash) {
      methods.push({ kind: "cash", title: "Dinheiro", description: cash });
    }

    return methods;
  })();

  const paymentDisclaimer =
    paymentSettings.disclaimer?.trim() ||
    "A Qerbie não processa pagamentos. Combine o pagamento diretamente com o estabelecimento.";

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
            <CustomerOrdersRealtime merchantId={merchantId} initialOrders={initialOrders} />
          )}
        </div>

        <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Pagamento</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{paymentDisclaimer}</p>

          {paymentMethods.length ? (
            <div className="mt-3 space-y-3">
              {paymentMethods.map((m) => (
                <div
                  key={m.kind}
                  className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
                >
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    {m.title}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {m.description}
                  </div>

                  {m.kind === "pix" ? (
                    <div className="mt-2 rounded-lg bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
                      {m.key}
                    </div>
                  ) : null}

                  {m.kind === "link" ? (
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    >
                      Abrir link de pagamento
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
              O estabelecimento ainda não configurou formas de pagamento por aqui.
            </div>
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
