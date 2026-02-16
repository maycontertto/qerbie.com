import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/database.types";
import {
  CUSTOMER_SESSION_COOKIE,
  CUSTOMER_SESSION_HEADER,
} from "@/lib/customer/constants";

/**
 * Creates a Supabase client for use in Server Components, Server Actions,
 * and Route Handlers.
 *
 * - Reads/writes auth tokens via Next.js cookies.
 * - Must be called inside a request context (not at module top-level).
 * - Uses the anon key (RLS enforced).
 */
export async function createClient(extraHeaders: Record<string, string> = {}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase env ausente: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;

  const headers = {
    ...(sessionToken ? { [CUSTOMER_SESSION_HEADER]: sessionToken } : {}),
    ...extraHeaders,
  };

  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      global: {
        headers,
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll can throw when called from a Server Component.
            // This is safe to ignore if middleware is refreshing sessions.
          }
        },
      },
    },
  );
}
