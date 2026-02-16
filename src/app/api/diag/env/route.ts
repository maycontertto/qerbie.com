import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function hasNonEmpty(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Diagnostic endpoint to validate env var availability at runtime.
 *
 * Security:
 * - Does NOT return secrets.
 * - Returns only booleans + string lengths.
 */
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const anonEqualsServiceRole =
    typeof supabaseAnonKey === "string" &&
    typeof serviceRoleKey === "string" &&
    supabaseAnonKey.length > 0 &&
    serviceRoleKey.length > 0 &&
    supabaseAnonKey === serviceRoleKey;

  return NextResponse.json(
    {
      ok: true,
      env: {
        VERCEL: hasNonEmpty(process.env.VERCEL),
        VERCEL_ENV: process.env.VERCEL_ENV ?? null,
        NODE_ENV: process.env.NODE_ENV ?? null,
      },
      supabase: {
        hasUrl: hasNonEmpty(supabaseUrl),
        urlLength: supabaseUrl?.length ?? 0,
        hasAnonKey: hasNonEmpty(supabaseAnonKey),
        anonKeyLength: supabaseAnonKey?.length ?? 0,
        hasServiceRoleKey: hasNonEmpty(serviceRoleKey),
        serviceRoleKeyLength: serviceRoleKey?.length ?? 0,
        anonEqualsServiceRole,
      },
    },
    { status: 200 },
  );
}
