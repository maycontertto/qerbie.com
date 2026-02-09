"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CUSTOMER_LANGUAGES,
  CUSTOMER_LANGUAGE_STORAGE_KEY,
  CustomerLanguage,
  normalizeCustomerLanguage,
  tCustomer,
} from "@/lib/customer/i18n";

export function useCustomerLanguage(): {
  lang: CustomerLanguage;
  setLang: (lang: CustomerLanguage) => void;
} {
  const [lang, setLangState] = useState<CustomerLanguage>("pt");

  useEffect(() => {
    const read = () => {
      const raw = localStorage.getItem(CUSTOMER_LANGUAGE_STORAGE_KEY);
      setLangState(normalizeCustomerLanguage(raw));
    };

    read();

    const onStorage = (e: StorageEvent) => {
      if (e.key !== CUSTOMER_LANGUAGE_STORAGE_KEY) return;
      read();
    };

    const onCustom = () => read();

    window.addEventListener("storage", onStorage);
    window.addEventListener("qerbie:customer-language", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("qerbie:customer-language", onCustom);
    };
  }, []);

  function setLang(next: CustomerLanguage) {
    setLangState(next);
    try {
      localStorage.setItem(CUSTOMER_LANGUAGE_STORAGE_KEY, next);
    } catch {
      // ignore
    }

    // Keep other components in sync (same tab).
    window.dispatchEvent(new Event("qerbie:customer-language"));
  }

  return { lang, setLang };
}

export function CustomerLanguagePicker({
  value,
  onChange,
  className,
}: {
  value: CustomerLanguage;
  onChange: (lang: CustomerLanguage) => void;
  className?: string;
}) {
  const label = useMemo(() => tCustomer(value, "language"), [value]);

  return (
    <label className={className ?? ""}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(normalizeCustomerLanguage(e.target.value))}
        className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        aria-label={label}
      >
        {CUSTOMER_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
