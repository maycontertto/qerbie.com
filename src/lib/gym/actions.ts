"use server";

import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { hashPassword } from "@/lib/gym/password";

function safeReturnTo(raw: FormDataEntryValue | null, allowed: string[]): string {
  const v = typeof raw === "string" ? raw : "";
  return allowed.includes(v) ? v : "/dashboard";
}

function parseIntOr(input: FormDataEntryValue | null, fallback: number): number {
  const v = typeof input === "string" ? input : "";
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function parseDateOrNull(input: FormDataEntryValue | null): string | null {
  const v = typeof input === "string" ? input.trim() : "";
  if (!v) return null;
  // Expect YYYY-MM-DD from <input type="date">
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return v;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // Handle month rollover (e.g. Jan 31 -> Mar 3). Clamp to last day of previous month.
  if (d.getDate() !== day) {
    d.setDate(0);
  }
  return d;
}

function todayIsoDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function requireGymAccess() {
  const { supabase, user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const ok =
    isOwner ||
    (membership
      ? hasMemberPermission(membership.role, membership.permissions, "dashboard_products") ||
        hasMemberPermission(membership.role, membership.permissions, "dashboard_orders")
      : false);
  if (!ok) {
    redirect("/dashboard");
  }
  return { supabase, merchant, isOwner };
}

export async function createGymPlan(formData: FormData): Promise<void> {
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const priceCents = Math.max(0, parseIntOr(formData.get("price_cents"), 0));
  const periodMonths = Math.max(1, parseIntOr(formData.get("billing_period_months"), 1));
  const returnTo = safeReturnTo(formData.get("return_to"), [
    "/dashboard/modulos/academia_planos",
  ]);

  if (name.length < 2) {
    redirect(`${returnTo}?error=invalid`);
  }

  const { supabase, merchant } = await requireGymAccess();
  const { error } = await supabase.from("gym_plans").insert({
    merchant_id: merchant.id,
    name,
    price_cents: priceCents,
    billing_period_months: periodMonths,
    is_active: true,
  });

  if (error) {
    redirect(`${returnTo}?error=save_failed`);
  }

  redirect(`${returnTo}?saved=1`);
}

export async function updateGymPlan(formData: FormData): Promise<void> {
  const id = (formData.get("id") as string | null)?.trim() ?? "";
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const priceCents = Math.max(0, parseIntOr(formData.get("price_cents"), 0));
  const periodMonths = Math.max(1, parseIntOr(formData.get("billing_period_months"), 1));
  const isActive = formData.get("is_active") === "on";
  const returnTo = safeReturnTo(formData.get("return_to"), [
    "/dashboard/modulos/academia_planos",
  ]);

  if (!id || name.length < 2) {
    redirect(`${returnTo}?error=invalid`);
  }

  const { supabase, merchant } = await requireGymAccess();
  const { error } = await supabase
    .from("gym_plans")
    .update({
      name,
      price_cents: priceCents,
      billing_period_months: periodMonths,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("merchant_id", merchant.id)
    .eq("id", id);

  if (error) {
    redirect(`${returnTo}?error=save_failed`);
  }

  redirect(`${returnTo}?saved=1`);
}

export async function removeGymPlan(formData: FormData): Promise<void> {
  const id = (formData.get("id") as string | null)?.trim() ?? "";
  const returnTo = safeReturnTo(formData.get("return_to"), [
    "/dashboard/modulos/academia_planos",
  ]);

  if (!id) {
    redirect(`${returnTo}?error=invalid`);
  }

  const { supabase, merchant, isOwner } = await requireGymAccess();
  if (!isOwner) {
    redirect(`${returnTo}?error=not_allowed`);
  }

  const { data: plan } = await supabase
    .from("gym_plans")
    .select("id, is_active")
    .eq("merchant_id", merchant.id)
    .eq("id", id)
    .maybeSingle();

  if (!plan?.id) {
    redirect(`${returnTo}?error=invalid`);
  }

  if (plan.is_active) {
    redirect(`${returnTo}?error=plan_active`);
  }

  const { data: inUse } = await supabase
    .from("gym_memberships")
    .select("id")
    .eq("merchant_id", merchant.id)
    .eq("plan_id", id)
    .limit(1);

  if (inUse?.length) {
    redirect(`${returnTo}?error=plan_in_use`);
  }

  const { error } = await supabase
    .from("gym_plans")
    .delete()
    .eq("merchant_id", merchant.id)
    .eq("id", id);

  if (error) {
    redirect(`${returnTo}?error=plan_delete_failed`);
  }

  redirect(`${returnTo}?removed=1`);
}

export async function createGymModality(formData: FormData): Promise<void> {
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const returnTo = safeReturnTo(formData.get("return_to"), [
    "/dashboard/modulos/academia_modalidades",
  ]);

  if (name.length < 2) {
    redirect(`${returnTo}?error=invalid`);
  }

  const { supabase, merchant } = await requireGymAccess();
  const { error } = await supabase.from("gym_modalities").insert({
    merchant_id: merchant.id,
    name,
    is_active: true,
  });

  if (error) {
    redirect(`${returnTo}?error=save_failed`);
  }

  redirect(`${returnTo}?saved=1`);
}

export async function updateGymModality(formData: FormData): Promise<void> {
  const id = (formData.get("id") as string | null)?.trim() ?? "";
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const isActive = formData.get("is_active") === "on";
  const returnTo = safeReturnTo(formData.get("return_to"), [
    "/dashboard/modulos/academia_modalidades",
  ]);

  if (!id || name.length < 2) {
    redirect(`${returnTo}?error=invalid`);
  }

  const { supabase, merchant } = await requireGymAccess();
  const { error } = await supabase
    .from("gym_modalities")
    .update({ name, is_active: isActive, updated_at: new Date().toISOString() })
    .eq("merchant_id", merchant.id)
    .eq("id", id);

  if (error) {
    redirect(`${returnTo}?error=save_failed`);
  }

  redirect(`${returnTo}?saved=1`);
}

export async function createGymAdditionalService(formData: FormData): Promise<void> {
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const priceCents = Math.max(0, parseIntOr(formData.get("price_cents"), 0));
  const returnTo = safeReturnTo(formData.get("return_to"), [
    "/dashboard/modulos/academia_servicos",
  ]);

  if (name.length < 2) {
    redirect(`${returnTo}?error=invalid`);
  }

  const { supabase, merchant } = await requireGymAccess();
  const { error } = await supabase.from("gym_additional_services").insert({
    merchant_id: merchant.id,
    name,
    price_cents: priceCents,
    is_active: true,
  });

  if (error) {
    redirect(`${returnTo}?error=save_failed`);
  }

  redirect(`${returnTo}?saved=1`);
}

export async function updateGymAdditionalService(formData: FormData): Promise<void> {
  const id = (formData.get("id") as string | null)?.trim() ?? "";
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const priceCents = Math.max(0, parseIntOr(formData.get("price_cents"), 0));
  const isActive = formData.get("is_active") === "on";
  const returnTo = safeReturnTo(formData.get("return_to"), [
    "/dashboard/modulos/academia_servicos",
  ]);

  if (!id || name.length < 2) {
    redirect(`${returnTo}?error=invalid`);
  }

  const { supabase, merchant } = await requireGymAccess();
  const { error } = await supabase
    .from("gym_additional_services")
    .update({
      name,
      price_cents: priceCents,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("merchant_id", merchant.id)
    .eq("id", id);

  if (error) {
    redirect(`${returnTo}?error=save_failed`);
  }

  redirect(`${returnTo}?saved=1`);
}

export async function createGymStudent(formData: FormData): Promise<void> {
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const login = (formData.get("login") as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null)?.trim() ?? "";
  const planId = (formData.get("plan_id") as string | null)?.trim() ?? "";
  const nextDueAt = parseDateOrNull(formData.get("next_due_at"));
  const returnTo = safeReturnTo(formData.get("return_to"), [
    "/dashboard/modulos/academia_alunos",
    "/dashboard/modulos/academia_renovacoes",
  ]);

  if (name.length < 2 || login.length < 2 || password.length < 4) {
    redirect(`${returnTo}?error=invalid`);
  }

  const { supabase, merchant } = await requireGymAccess();

  const passwordHash = hashPassword(password);
  const sessionToken = randomBytes(24).toString("base64url");

  const { data: student, error: studentError } = await supabase
    .from("gym_students")
    .insert({
      merchant_id: merchant.id,
      name,
      login,
      password_hash: passwordHash,
      session_token: sessionToken,
      is_active: true,
    })
    .select("id")
    .single();

  if (studentError || !student?.id) {
    redirect(`${returnTo}?error=save_failed`);
  }

  const due = nextDueAt ?? todayIsoDate();

  const { error: membershipError } = await supabase.from("gym_memberships").insert({
    merchant_id: merchant.id,
    student_id: student.id,
    plan_id: planId || null,
    status: "active",
    next_due_at: due,
    last_paid_at: null,
  });

  if (membershipError) {
    redirect(`${returnTo}?error=save_failed`);
  }

  redirect(`${returnTo}?saved=1`);
}

export async function setGymMembershipDueDate(formData: FormData): Promise<void> {
  const membershipId = (formData.get("membership_id") as string | null)?.trim() ?? "";
  const nextDueAt = parseDateOrNull(formData.get("next_due_at"));
  const returnTo = safeReturnTo(formData.get("return_to"), [
    "/dashboard/modulos/academia_alunos",
    "/dashboard/modulos/academia_renovacoes",
  ]);

  if (!membershipId || !nextDueAt) {
    redirect(`${returnTo}?error=invalid`);
  }

  const { supabase, merchant } = await requireGymAccess();
  const { error } = await supabase
    .from("gym_memberships")
    .update({ next_due_at: nextDueAt, updated_at: new Date().toISOString() })
    .eq("merchant_id", merchant.id)
    .eq("id", membershipId);

  if (error) {
    redirect(`${returnTo}?error=save_failed`);
  }

  redirect(`${returnTo}?saved=1`);
}

export async function recordGymPayment(formData: FormData): Promise<void> {
  const membershipId = (formData.get("membership_id") as string | null)?.trim() ?? "";
  const note = (formData.get("note") as string | null)?.trim() ?? "";
  const returnTo = safeReturnTo(formData.get("return_to"), [
    "/dashboard/modulos/academia_alunos",
    "/dashboard/modulos/academia_renovacoes",
    "/dashboard/modulos/academia_financeiro",
  ]);

  if (!membershipId) {
    redirect(`${returnTo}?error=invalid`);
  }

  const { supabase, merchant } = await requireGymAccess();

  const { data: membership, error: membershipError } = await supabase
    .from("gym_memberships")
    .select("id, student_id, plan_id, next_due_at")
    .eq("merchant_id", merchant.id)
    .eq("id", membershipId)
    .single();

  if (membershipError || !membership) {
    redirect(`${returnTo}?error=save_failed`);
  }

  let billingMonths = 1;
  let amountCents = 0;

  if (membership.plan_id) {
    const { data: plan } = await supabase
      .from("gym_plans")
      .select("billing_period_months, price_cents")
      .eq("merchant_id", merchant.id)
      .eq("id", membership.plan_id)
      .single();

    if (plan) {
      billingMonths = Math.max(1, Number(plan.billing_period_months ?? 1));
      amountCents = Math.max(0, Number(plan.price_cents ?? 0));
    }
  }

  const now = new Date();
  const lastPaidAt = todayIsoDate();

  const baseDate = membership.next_due_at ? new Date(`${membership.next_due_at}T00:00:00`) : now;
  const nextDue = addMonths(baseDate, billingMonths);
  const nextDueAt = `${nextDue.getFullYear()}-${String(nextDue.getMonth() + 1).padStart(2, "0")}-${String(
    nextDue.getDate(),
  ).padStart(2, "0")}`;

  const { error: paymentError } = await supabase.from("gym_payments").insert({
    merchant_id: merchant.id,
    student_id: membership.student_id,
    membership_id: membership.id,
    amount_cents: amountCents,
    paid_at: now.toISOString(),
    note: note || null,
  });

  if (paymentError) {
    redirect(`${returnTo}?error=save_failed`);
  }

  const { error: updateError } = await supabase
    .from("gym_memberships")
    .update({
      last_paid_at: lastPaidAt,
      next_due_at: nextDueAt,
      status: "active",
      updated_at: now.toISOString(),
    })
    .eq("merchant_id", merchant.id)
    .eq("id", membership.id);

  if (updateError) {
    redirect(`${returnTo}?error=save_failed`);
  }

  redirect(`${returnTo}?saved=1`);
}

export async function createGymQrToken(formData: FormData): Promise<void> {
  const label = (formData.get("label") as string | null)?.trim() ?? "Academia";
  const returnTo = safeReturnTo(formData.get("return_to"), [
    "/dashboard/modulos/academia_qr",
  ]);

  const { supabase, merchant } = await requireGymAccess();

  for (let attempt = 0; attempt < 3; attempt++) {
    const qrToken = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const { error } = await supabase.from("gym_qr_tokens").insert({
      merchant_id: merchant.id,
      label: label || "Academia",
      qr_token: qrToken,
      is_active: true,
    });

    if (!error) {
      redirect(`${returnTo}?qr=${encodeURIComponent(qrToken)}`);
    }
  }

  redirect(`${returnTo}?error=save_failed`);
}

export async function deactivateGymQrToken(formData: FormData): Promise<void> {
  const id = (formData.get("id") as string | null)?.trim() ?? "";
  const returnTo = safeReturnTo(formData.get("return_to"), [
    "/dashboard/modulos/academia_qr",
  ]);

  if (!id) {
    redirect(`${returnTo}?error=invalid`);
  }

  const { supabase, merchant } = await requireGymAccess();
  const { error } = await supabase
    .from("gym_qr_tokens")
    .update({ is_active: false })
    .eq("merchant_id", merchant.id)
    .eq("id", id);

  if (error) {
    redirect(`${returnTo}?error=save_failed`);
  }

  redirect(returnTo);
}
