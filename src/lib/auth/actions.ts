"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

async function getRequestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;

  const appUrlRaw = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrlRaw) {
    const appUrl = appUrlRaw.startsWith("http://") || appUrlRaw.startsWith("https://")
      ? appUrlRaw
      : `https://${appUrlRaw}`;
    return appUrl;
  }

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;

  return "http://localhost:3000";
}

// ── Types ───────────────────────────────────────────────────

export interface AuthResult {
  error: string | null;
}

// ── Sign Up (email + password) ──────────────────────────────

export async function signUp(formData: FormData): Promise<AuthResult> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const merchantName = formData.get("merchant_name") as string;

  if (!email || !password || !merchantName) {
    return { error: "Todos os campos são obrigatórios." };
  }

  if (password.length < 8) {
    return { error: "A senha deve ter pelo menos 8 caracteres." };
  }

  const supabase = await createClient();

  const emailRedirectTo = new URL("/auth/callback", await getRequestOrigin()).toString();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        merchant_name: merchantName,
      },
      emailRedirectTo,
    },
  });

  if (error) {
    return { error: error.message };
  }

  // If email confirmation is required, Supabase returns a user but
  // no session. We handle both cases.
  if (data.user && data.session) {
    // Auto-create merchant record for the new owner.
    await ensureMerchant(supabase, data.user.id, merchantName);
    redirect("/dashboard");
  }

  // Email confirmation required — redirect to a check-email page.
  redirect("/auth/check-email");
}

// ── Sign In (email + password) ──────────────────────────────

export async function signIn(formData: FormData): Promise<AuthResult> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const nextRaw = String(formData.get("next") ?? "");

  if (!email || !password) {
    return { error: "E-mail e senha são obrigatórios." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  const next = normalizeNext(nextRaw);
  redirect(next ?? "/dashboard");
}

function normalizeNext(value: string): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  if (!v.startsWith("/")) return null;
  if (v.startsWith("//")) return null;
  if (v.startsWith("/\\")) return null;
  // avoid open-redirects and keep it internal
  return v;
}

// ── Sign Out ────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/sign-in");
}

// ── Helpers ─────────────────────────────────────────────────

/**
 * Creates a merchant record if one doesn't already exist for this user.
 * Called after sign-up and after first OAuth login.
 */
async function ensureMerchant(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  name: string,
) {
  // Check if user already owns a merchant.
  const { data: existing } = await supabase
    .from("merchants")
    .select("id")
    .eq("owner_user_id", userId)
    .limit(1)
    .maybeSingle();

  if (existing) return;

  // Generate a URL-safe slug from the merchant name.
  const slug = generateSlug(name);

  await supabase.from("merchants").insert({
    owner_user_id: userId,
    name,
    slug,
    status: "active",
  });
}

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, "-")    // non-alphanum → dash
    .replace(/^-+|-+$/g, "");       // trim dashes

  // Append random suffix to avoid collisions.
  const suffix = Math.random().toString(36).substring(2, 8);
  return `${base}-${suffix}`;
}

/**
 * Ensures a merchant exists after OAuth login (Google).
 * Exported so the callback or middleware can call it.
 */
export async function ensureMerchantForOAuth(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return;

  const name =
    user.user_metadata?.merchant_name ??
    user.user_metadata?.full_name ??
    user.email?.split("@")[0] ??
    "Meu Negócio";

  await ensureMerchant(supabase, user.id, name);
}
