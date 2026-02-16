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

export interface AuthResult {
  error: string | null;
}

function normalizeNext(value: string): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  if (!v.startsWith("/")) return null;
  if (v.startsWith("//")) return null;
  if (v.startsWith("/\\")) return null;
  return v;
}

function normalizeLogin(value: string): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function makeStaffEmail(login: string): string {
  return `${login}@staff.qerbie.local`;
}

export async function signInAttendant(formData: FormData): Promise<AuthResult> {
  const loginRaw = String(formData.get("login") ?? "");
  const password = String(formData.get("password") ?? "");
  const nextRaw = String(formData.get("next") ?? "");

  const login = normalizeLogin(loginRaw);
  if (!login || !password) {
    return { error: "Login e senha são obrigatórios." };
  }

  const supabase = await createClient();
  const email = makeStaffEmail(login);

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "Login ou senha inválidos." };
  }

  const next = normalizeNext(nextRaw);
  if (next && next.startsWith("/atendente")) {
    redirect(next);
  }

  redirect("/atendente");
}

export async function signUpAttendant(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const code = String(formData.get("code") ?? "").trim();
  const nextRaw = String(formData.get("next") ?? "");

  if (!email || !password) {
    return { error: "E-mail e senha são obrigatórios." };
  }

  if (password.length < 8) {
    return { error: "A senha deve ter pelo menos 8 caracteres." };
  }

  const supabase = await createClient();

  const next = normalizeNext(nextRaw);
  const fallbackNext = code
    ? `/atendente/vincular?code=${encodeURIComponent(code)}&auto=1`
    : "/atendente/vincular";
  const nextFinal = next ?? fallbackNext;

  const emailRedirectTo = new URL(
    `/auth/callback?next=${encodeURIComponent(nextFinal)}&flow=attendant`,
    await getRequestOrigin(),
  ).toString();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
    },
  });

  if (error) {
    return { error: error.message };
  }

  // If session is present, go straight to linking.
  if (data.session) {
    if (code) {
      const { error: redeemError } = await supabase.rpc("redeem_merchant_invite", {
        p_code: code,
      });

      if (redeemError) {
        const msg = (redeemError.message || "").toLowerCase();
        const key = msg.includes("invalid_code")
          ? "invalid"
          : msg.includes("code_used")
            ? "used"
            : "failed";
        redirect(`/atendente/vincular?error=${key}`);
      }

      redirect("/atendente?saved=1");
    }

    if (next) redirect(next);
    redirect("/atendente/vincular");
  }

  // Email confirmation required.
  redirect("/auth/check-email");
}
