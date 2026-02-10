import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
import { CUSTOMER_SESSION_COOKIE } from "@/lib/customer/constants";
import { GYM_SESSION_COOKIE } from "@/lib/gym/constants";

/**
 * Refreshes the Supabase auth session on every request via middleware.
 *
 * This ensures that:
 * - Expired JWTs are refreshed transparently.
 * - Server Components always get a fresh session.
 * - Auth cookies are kept in sync.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If env vars are missing (common in new Vercel deploys), don't crash middleware.
  // Auth/session refresh won't run until these are configured.
  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const sessionToken = request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value;
  const gymSessionToken = request.cookies.get(GYM_SESSION_COOKIE)?.value;

  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      global: {
        headers: {
          ...(sessionToken ? { "x-session-token": sessionToken } : {}),
          ...(gymSessionToken ? { "x-gym-session-token": gymSessionToken } : {}),
        },
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: Do NOT add logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake here can make it
  // very hard to debug session refresh issues.
  await supabase.auth.getUser();

  return supabaseResponse;
}
