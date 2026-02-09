"use client";

import Link from "next/link";
import { CustomerLanguagePicker, useCustomerLanguage } from "@/app/t/CustomerLanguagePicker";
import { tCustomer } from "@/lib/customer/i18n";
import { CustomerMenuBrowser } from "@/app/t/[qrToken]/menu/CustomerMenuBrowser";

type Menu = {
  id: string;
  name: string;
  description: string | null;
};

type Category = {
  id: string;
  name: string;
  description: string | null;
};

type Product = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number | null;
  image_url: string | null;
  is_featured: boolean;
};

type DeliverySettings = {
  enabled: boolean;
  fee: number | null;
  note: string | null;
  etaMinutes: number | null;
};

type SupportContact = {
  whatsappUrl: string | null;
  hours: string | null;
  email: string | null;
  phone: string | null;
};

type PaymentSettings = {
  pixKey: string | null;
  pixDescription: string | null;
  cardUrl: string | null;
  cardDescription: string | null;
  cashDescription: string | null;
  disclaimer: string | null;
};

type Branding = {
  displayName: string;
  logoUrl: string | null;
  primaryColor: string | null;
};

export function CustomerMenuShell({
  qrToken,
  tableLabel,
  branding,
  welcomeMessage,
  hasSession,
  menus,
  activeMenuId,
  categories,
  products,
  deliverySettings,
  supportContact,
  paymentSettings,
}: {
  qrToken: string;
  tableLabel: string;
  branding: Branding;
  welcomeMessage: string | null;
  hasSession: boolean;
  menus: Menu[];
  activeMenuId: string | null;
  categories: Category[];
  products: Product[];
  deliverySettings: DeliverySettings;
  supportContact: SupportContact;
  paymentSettings: PaymentSettings;
}) {
  const { lang, setLang } = useCustomerLanguage();

  const hasSupportContact = Boolean(
    supportContact.whatsappUrl || supportContact.hours || supportContact.email || supportContact.phone,
  );

  return (
    <div id="top" className="min-h-screen bg-zinc-50 px-4 py-8 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              {branding.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={branding.logoUrl}
                  alt={branding.displayName}
                  className="h-10 w-10 rounded-xl border border-zinc-200 bg-white object-contain p-1.5 dark:border-zinc-800"
                />
              ) : null}
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {branding.displayName}
              </h1>
            </div>

            {welcomeMessage ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                {welcomeMessage}
              </p>
            ) : null}

            <p className="text-sm text-zinc-500 dark:text-zinc-400">{tableLabel}</p>
          </div>

          <CustomerLanguagePicker value={lang} onChange={setLang} />
        </div>

        {!hasSession && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <p className="font-semibold">{tCustomer(lang, "type_your_name_hint")}</p>
            <p className="mt-1 text-xs opacity-90">
              {tCustomer(lang, "send_order_requires_name")}
            </p>
            <Link
              href={`/t/${encodeURIComponent(qrToken)}`}
              className="mt-3 inline-block rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-500"
            >
              {tCustomer(lang, "type_your_name_cta")}
            </Link>
          </div>
        )}

        <div className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
          {!menus.length || !activeMenuId ? (
            <>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {tCustomer(lang, "no_menu_available")}
              </h2>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                {tCustomer(lang, "no_menu_published")}
              </p>
            </>
          ) : (
            <CustomerMenuBrowser
              qrToken={qrToken}
              tableLabel={tableLabel}
              menus={menus}
              activeMenuId={activeMenuId}
              categories={categories}
              products={products}
              primaryColor={branding.primaryColor}
              deliverySettings={deliverySettings}
              paymentSettings={paymentSettings}
            />
          )}
        </div>

        {hasSupportContact && (
          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {tCustomer(lang, "support_contact")}
            </h2>
            <div className="mt-3 space-y-2 text-sm text-zinc-700 dark:text-zinc-200">
              {supportContact.hours ? (
                <p>
                  <span className="font-semibold">{tCustomer(lang, "support_hours")}:</span> {supportContact.hours}
                </p>
              ) : null}

              {supportContact.phone ? (
                <p>
                  <span className="font-semibold">{tCustomer(lang, "support_phone")}:</span> {supportContact.phone}
                </p>
              ) : null}

              {supportContact.email ? (
                <p>
                  <span className="font-semibold">{tCustomer(lang, "support_email")}:</span> {supportContact.email}
                </p>
              ) : null}
            </div>

            {supportContact.whatsappUrl ? (
              <a
                href={supportContact.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {tCustomer(lang, "whatsapp")}
              </a>
            ) : null}
          </div>
        )}

        <Link
          className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
          href={`/t/${encodeURIComponent(qrToken)}/fila`}
        >
          {tCustomer(lang, "queue")}
        </Link>

        <Link
          className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
          href={`/t/${encodeURIComponent(qrToken)}/agenda`}
        >
          {tCustomer(lang, "agenda")}
        </Link>

        <Link
          className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
          href={`/t/${encodeURIComponent(qrToken)}`}
        >
          {tCustomer(lang, "change_name")}
        </Link>
      </div>
    </div>
  );
}
