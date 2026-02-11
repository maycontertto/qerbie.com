"use client";

import { useMemo, useState } from "react";
import { startAestheticCustomerSession } from "@/lib/aesthetic/customerActions";
import { getButtonStyle } from "@/lib/merchant/branding";
import { CustomerLanguagePicker, useCustomerLanguage } from "@/app/t/CustomerLanguagePicker";
import { tCustomer } from "@/lib/customer/i18n";

export function CustomerStart({
  qrToken,
  merchantName,
  merchantLogoUrl,
  merchantPrimaryColor,
  welcomeMessage,
  tableLabel,
  error,
  quickMode,
}: {
  qrToken: string;
  merchantName: string;
  merchantLogoUrl?: string | null;
  merchantPrimaryColor?: string | null;
  welcomeMessage?: string | null;
  tableLabel: string;
  error?: string | null;
  quickMode?: boolean;
}) {
  const { lang, setLang } = useCustomerLanguage();
  const [place, setPlace] = useState<string>("");

  const errorMessage = useMemo(() => {
    if (!error) return null;
    if (error === "invalid_name") return tCustomer(lang, "type_your_name");
    return tCustomer(lang, "could_not_continue");
  }, [error, lang]);

  const button = getButtonStyle(merchantPrimaryColor ?? null);

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="flex justify-end">
          <CustomerLanguagePicker value={lang} onChange={setLang} />
        </div>

        <div className="space-y-2 text-center">
          {merchantLogoUrl ? (
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={merchantLogoUrl}
                alt={merchantName}
                className="h-16 w-16 rounded-2xl border border-zinc-200 bg-white object-contain p-2 dark:border-zinc-800"
              />
            </div>
          ) : null}

          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {merchantName}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {tCustomer(lang, "you_are_served_by", { name: merchantName })}
          </p>
          {welcomeMessage ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">{welcomeMessage}</p>
          ) : null}
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{tableLabel}</p>
        </div>

        {errorMessage && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        <form action={startAestheticCustomerSession} className="space-y-4">
          <input type="hidden" name="qr_token" value={qrToken} />
          {quickMode ? <input type="hidden" name="place" value={place} /> : null}

          {quickMode ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Tipo de atendimento</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Escolha uma opção (ou digite um nome como preferir).
              </p>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPlace("Recepção")}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                    place === "Recepção"
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                      : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  Chegada
                </button>
                <button
                  type="button"
                  onClick={() => setPlace("Agendamento")}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                    place === "Agendamento"
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                      : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  Agenda
                </button>
                <button
                  type="button"
                  onClick={() => setPlace("Procedimento")}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                    place === "Procedimento"
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                      : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  Serviço
                </button>
              </div>

              <input
                value={place}
                onChange={(e) => setPlace(e.target.value)}
                placeholder="Ex: Chegada / Agendamento"
                className="mt-3 block w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
          ) : null}

          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              {tCustomer(lang, "your_name")}
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              minLength={2}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
              placeholder={tCustomer(lang, "name_placeholder")}
            />
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{tCustomer(lang, "name_helper")}</p>
          </div>

          <button type="submit" className={button.className} style={button.style}>
            {tCustomer(lang, "continue")}
          </button>
        </form>

        <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">{tCustomer(lang, "start_terms")}</p>
      </div>
    </div>
  );
}
