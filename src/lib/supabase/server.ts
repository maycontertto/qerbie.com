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
 * - Uses the anon key (RLS enforced).
 * - Must be called inside a request context (not at module top-level).
 * - By default this client NEVER forwards the visitor's Supabase Auth
 *   cookies, so every query always runs as the plain `anon` Postgres role.
 *   This is critical for public/customer-facing pages (QR menu, fila,
 *   agenda, etc.): a visitor's browser may carry a stale/expired (or even
 *   valid but unrelated) merchant/staff auth session cookie — e.g. the same
 *   phone was previously used to log into the dashboard. If that cookie
 *   were forwarded, PostgREST could evaluate RLS as `authenticated` instead
 *   of `anon`, silently changing which rows are visible, or failing
 *   outright with an auth error (expired JWT) that gets swallowed by
 *   `{ data }` destructuring — which is exactly what caused the
 *   "QR inválido" bug for real customers whose browser had a lingering
 *   dashboard session.
 * - Pass `{ withAuth: true }` ONLY for trusted, authenticated surfaces
 *   (dashboard, atendente, auth callback, etc.) that legitimately need the
 *   signed-in merchant/staff session.
 */
export async function createClient(
  extraHeaders: Record<string, string> = {},
  options: { withAuth?: boolean } = {},
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase env ausente: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  const withAuth = options.withAuth ?? false;

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
          // Never forward auth cookies unless explicitly requested — see
          // the doc comment above for why this matters.
          if (!withAuth) return [];
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          if (!withAuth) return;
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
