import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureMerchantForOAuth } from "@/lib/auth/actions";

/**
 * GET /auth/callback
 *
 * Supabase redirects here after OAuth (Google) or email confirmation.
 * Exchanges the `code` query param for a session, ensures a merchant
 * record exists, then redirects to the intended destination.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Ensure merchant record exists for OAuth users (first login).
      await ensureMerchantForOAuth();
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If code exchange fails, send to sign-in with an error hint.
  return NextResponse.redirect(`${origin}/auth/sign-in?error=auth_callback_error`);
}
