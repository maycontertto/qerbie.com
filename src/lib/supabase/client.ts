"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";
import {
  CUSTOMER_SESSION_COOKIE,
  CUSTOMER_SESSION_HEADER,
} from "@/lib/customer/constants";

/**
 * Creates a Supabase client for use in Client Components.
 *
 * - Runs in the browser.
 * - Uses the anon key (RLS enforced).
 * - Safe to call multiple times — @supabase/ssr deduplicates internally.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase env ausente: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  const sessionToken = getCookie(CUSTOMER_SESSION_COOKIE);

  return createBrowserClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      global: {
        // Usado pelas políticas RLS para vincular ações/leitura ao "cliente" do QR.
        headers: sessionToken ? { [CUSTOMER_SESSION_HEADER]: sessionToken } : {},
      },
    },
  );
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(
      `(?:^|; )${name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, "\\$1")}=([^;]*)`,
    ),
  );
  return match ? decodeURIComponent(match[1]) : null;
}
