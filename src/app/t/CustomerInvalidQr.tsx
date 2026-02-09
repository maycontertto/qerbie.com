"use client";

import Link from "next/link";
import { CustomerLanguagePicker, useCustomerLanguage } from "@/app/t/CustomerLanguagePicker";
import { tCustomer } from "@/lib/customer/i18n";

export function CustomerInvalidQr({
  backHref,
  showHint,
}: {
  backHref?: string | null;
  showHint?: boolean;
}) {
  const { lang, setLang } = useCustomerLanguage();

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {tCustomer(lang, "invalid_qr")}
          </h1>
          <CustomerLanguagePicker value={lang} onChange={setLang} />
        </div>

        {showHint === false ? null : (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {tCustomer(lang, "invalid_qr_hint")}
          </p>
        )}

        {backHref ? (
          <div className="mt-6">
            <Link
              href={backHref}
              className="inline-block text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
            >
              ← {tCustomer(lang, "back")}
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
