"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import {
  CUSTOMER_NAME_COOKIE,
  CUSTOMER_PLACE_COOKIE,
  CUSTOMER_SESSION_COOKIE,
} from "@/lib/customer/constants";

export async function startBarbershopCustomerSession(formData: FormData) {
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const qrToken = (formData.get("qr_token") as string | null)?.trim() ?? "";
  const place = (formData.get("place") as string | null)?.trim() ?? "";

  if (!qrToken) {
    redirect("/");
  }

  if (name.length < 2) {
    redirect(`/b/${encodeURIComponent(qrToken)}?error=invalid_name`);
  }

  const cookieStore = await cookies();
  const sessionToken = randomBytes(24).toString("base64url");

  cookieStore.set(CUSTOMER_SESSION_COOKIE, sessionToken, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
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

  redirect(`/b/${encodeURIComponent(qrToken)}/menu`);
}
