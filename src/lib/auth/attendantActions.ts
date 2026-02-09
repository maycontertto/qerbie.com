"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

async function getRequestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export interface AuthResult {
  error: string | null;
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

  const emailRedirectTo = new URL("/auth/callback", await getRequestOrigin()).toString();

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
    const next = normalizeNext(nextRaw);
    if (next) redirect(next);
    if (code) redirect(`/atendente/vincular?code=${encodeURIComponent(code)}`);
    redirect("/atendente/vincular");
  }

  // Email confirmation required.
  redirect("/auth/check-email");
}

function normalizeNext(value: string): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  if (!v.startsWith("/")) return null;
  if (v.startsWith("//")) return null;
  if (v.startsWith("/\\")) return null;
  return v;
}
