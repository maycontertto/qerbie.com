"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import {
  CUSTOMER_NAME_COOKIE,
  CUSTOMER_PLACE_COOKIE,
  CUSTOMER_SESSION_COOKIE,
} from "@/lib/customer/constants";

/**
 * "Login" do cliente via QR: captura apenas o nome e cria um session_token.
 *
 * Clientes NÃO usam Supabase Auth. Isso é uma sessão própria do app,
 * usada para:
 * - identificar pedidos do cliente (RLS via x-session-token)
 * - preencher customer_name nos pedidos
 */
export async function startCustomerSession(formData: FormData) {
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const qrToken = (formData.get("qr_token") as string | null)?.trim() ?? "";
  const place = (formData.get("place") as string | null)?.trim() ?? "";

  if (!qrToken) {
    redirect("/");
  }

  if (name.length < 2) {
    // Keep it simple — page will show validation.
    redirect(`/t/${encodeURIComponent(qrToken)}?error=invalid_name`);
  }

  const cookieStore = await cookies();
  const sessionToken = randomBytes(24).toString("base64url");

  // Non-HttpOnly by design so the browser client can read it and attach
  // x-session-token automatically. This matches the RLS strategy.
  cookieStore.set(CUSTOMER_SESSION_COOKIE, sessionToken, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  cookieStore.set(CUSTOMER_NAME_COOKIE, name, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  if (place) {
    cookieStore.set(CUSTOMER_PLACE_COOKIE, place.slice(0, 60), {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  } else {
    cookieStore.delete(CUSTOMER_PLACE_COOKIE);
  }

  redirect(`/t/${encodeURIComponent(qrToken)}/menu`);
}
