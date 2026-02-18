"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { GYM_SESSION_COOKIE } from "@/lib/gym/constants";
import { hashPassword, verifyPassword } from "@/lib/gym/password";

function makeSessionToken(): string {
  return randomBytes(24).toString("base64url");
}

async function setGymSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(GYM_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

async function clearGymSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(GYM_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function gymSignUp(formData: FormData): Promise<void> {
  const qrToken = (formData.get("qr_token") as string | null)?.trim() ?? "";
  const loginRaw = (formData.get("login") as string | null)?.trim() ?? "";
  const login = loginRaw.toLowerCase();
  const password = (formData.get("password") as string | null)?.trim() ?? "";
  const rawPlanId = (formData.get("plan_id") as string | null)?.trim() ?? "";

  if (!qrToken) redirect("/");
  if (login.length < 2 || password.length < 1) {
    redirect(`/g/${encodeURIComponent(qrToken)}?error=invalid`);
  }

  const admin = createAdminClient();

  const { data: qr, error: qrError } = await admin
    .from("gym_qr_tokens")
    .select("merchant_id")
    .eq("qr_token", qrToken)
    .eq("is_active", true)
    .single();

  if (qrError || !qr?.merchant_id) {
    redirect(`/g/${encodeURIComponent(qrToken)}?error=invalid_qr`);
  }

  // Prevent confusing generic failures when user already exists (unique index is lower(login)).
  const { data: existing } = await admin
    .from("gym_students")
    .select("id")
    .eq("merchant_id", qr.merchant_id)
    .ilike("login", login)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    redirect(`/g/${encodeURIComponent(qrToken)}?error=login_taken`);
  }

  const passwordHash = hashPassword(password);
  const sessionToken = makeSessionToken();

  const name = loginRaw || login;

  const { data: student, error: insertError } = await admin
    .from("gym_students")
    .insert({
      merchant_id: qr.merchant_id,
      name,
      login,
      password_hash: passwordHash,
      session_token: sessionToken,
      is_active: true,
    })
    .select("id")
    .single();

  if (insertError || !student?.id) {
    if (insertError && "code" in insertError && insertError.code === "23505") {
      redirect(`/g/${encodeURIComponent(qrToken)}?error=login_taken`);
    }
    redirect(`/g/${encodeURIComponent(qrToken)}?error=signup_failed`);
  }

  let planId: string | null = null;
  if (rawPlanId) {
    const { data: plan } = await admin
      .from("gym_plans")
      .select("id")
      .eq("merchant_id", qr.merchant_id)
      .eq("id", rawPlanId)
      .eq("is_active", true)
      .maybeSingle();

    planId = plan?.id ?? null;
  }

  // Create membership with due today (merchant can adjust later).
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const due = `${yyyy}-${mm}-${dd}`;

  const { error: membershipError } = await admin.from("gym_memberships").insert({
    merchant_id: qr.merchant_id,
    student_id: student.id,
    plan_id: planId,
    status: "active",
    next_due_at: due,
    last_paid_at: null,
  });

  if (membershipError) {
    await admin.from("gym_students").delete().eq("id", student.id);
    redirect(`/g/${encodeURIComponent(qrToken)}?error=signup_failed`);
  }

  await setGymSessionCookie(sessionToken);
  redirect(`/g/${encodeURIComponent(qrToken)}`);
}

export async function gymSignIn(formData: FormData): Promise<void> {
  const qrToken = (formData.get("qr_token") as string | null)?.trim() ?? "";
  const login = ((formData.get("login") as string | null)?.trim() ?? "").toLowerCase();
  const password = (formData.get("password") as string | null)?.trim() ?? "";

  if (!qrToken) redirect("/");
  if (login.length < 2 || password.length < 1) {
    redirect(`/g/${encodeURIComponent(qrToken)}?error=invalid`);
  }

  const admin = createAdminClient();

  const { data: qr, error: qrError } = await admin
    .from("gym_qr_tokens")
    .select("merchant_id")
    .eq("qr_token", qrToken)
    .eq("is_active", true)
    .single();

  if (qrError || !qr?.merchant_id) {
    redirect(`/g/${encodeURIComponent(qrToken)}?error=invalid_qr`);
  }

  const { data: student, error: studentError } = await admin
    .from("gym_students")
    .select("id, password_hash, is_active")
    .eq("merchant_id", qr.merchant_id)
    .ilike("login", login)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (studentError || !student || !student.is_active) {
    redirect(`/g/${encodeURIComponent(qrToken)}?error=auth_failed`);
  }

  if (!verifyPassword(password, student.password_hash)) {
    redirect(`/g/${encodeURIComponent(qrToken)}?error=auth_failed`);
  }

  const sessionToken = makeSessionToken();

  await admin
    .from("gym_students")
    .update({ session_token: sessionToken, updated_at: new Date().toISOString() })
    .eq("id", student.id);

  await setGymSessionCookie(sessionToken);
  redirect(`/g/${encodeURIComponent(qrToken)}`);
}

export async function gymSignOut(formData: FormData): Promise<void> {
  const qrToken = (formData.get("qr_token") as string | null)?.trim() ?? "";
  if (!qrToken) redirect("/");
  await clearGymSessionCookie();
  redirect(`/g/${encodeURIComponent(qrToken)}`);
}

export async function gymChangePassword(formData: FormData): Promise<void> {
  const qrToken = (formData.get("qr_token") as string | null)?.trim() ?? "";
  const newPassword = (formData.get("new_password") as string | null)?.trim() ?? "";
  if (!qrToken) redirect("/");
  if (newPassword.length < 1) {
    redirect(`/g/${encodeURIComponent(qrToken)}?error=invalid`);
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(GYM_SESSION_COOKIE)?.value ?? "";
  if (!sessionToken) {
    redirect(`/g/${encodeURIComponent(qrToken)}?error=auth_failed`);
  }

  const admin = createAdminClient();

  const { data: qr, error: qrError } = await admin
    .from("gym_qr_tokens")
    .select("merchant_id")
    .eq("qr_token", qrToken)
    .eq("is_active", true)
    .single();

  if (qrError || !qr?.merchant_id) {
    redirect(`/g/${encodeURIComponent(qrToken)}?error=invalid_qr`);
  }

  const { data: student } = await admin
    .from("gym_students")
    .select("id")
    .eq("merchant_id", qr.merchant_id)
    .eq("session_token", sessionToken)
    .limit(1)
    .maybeSingle();

  if (!student?.id) {
    await clearGymSessionCookie();
    redirect(`/g/${encodeURIComponent(qrToken)}?error=auth_failed`);
  }

  const passwordHash = hashPassword(newPassword);
  const newSessionToken = makeSessionToken();

  const { error: updateError } = await admin
    .from("gym_students")
    .update({
      password_hash: passwordHash,
      session_token: newSessionToken,
      updated_at: new Date().toISOString(),
    })
    .eq("id", student.id);

  if (updateError) {
    redirect(`/g/${encodeURIComponent(qrToken)}?error=signup_failed`);
  }

  await setGymSessionCookie(newSessionToken);
  redirect(`/g/${encodeURIComponent(qrToken)}?changed=1`);
}
