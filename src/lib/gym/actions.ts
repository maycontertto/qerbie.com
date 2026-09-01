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

type GymAccessMethod = "manual" | "qr" | "facial" | "fingerprint";
type GymAccessSupabase = Awaited<ReturnType<typeof requireGymAccess>>["supabase"];

// Ponto único de entrada/saída: a primeira leitura do dia registra a entrada,
// a segunda registra a saída (para controle de horário de pico). Usado por
// todos os métodos (manual, QR, facial, digital) para evitar lógica duplicada.
async function applyGymAccessEvent(params: {
  supabase: GymAccessSupabase;
  merchantId: string;
  studentId: string;
  method: GymAccessMethod;
  confidence: number;
  deviceName: string;
  notes: string | null;
  faceProfileId?: string | null;
  fingerprintTemplateId?: string | null;
  evidenceImageUrl?: string | null;
  evidenceImagePath?: string | null;
}): Promise<{ ok: true; direction: "in" | "out" } | { ok: false; reason: "already_completed" | "save_failed" }> {
  const {
    supabase,
    merchantId,
    studentId,
    method,
    confidence,
    deviceName,
    notes,
    faceProfileId = null,
    fingerprintTemplateId = null,
    evidenceImageUrl = null,
    evidenceImagePath = null,
  } = params;

  const today = todayIsoDate();
  const nowIso = new Date().toISOString();
  const boundedConfidence = Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0;

  const { data: existing } = await supabase
    .from("gym_checkins")
    .select("id, checked_out_at")
    .eq("merchant_id", merchantId)
    .eq("student_id", studentId)
    .eq("checkin_date", today)
    .maybeSingle();

  let direction: "in" | "out";
  let checkinId: string | null = null;

  if (!existing?.id) {
    const { data: created, error: insertError } = await supabase
      .from("gym_checkins")
      .insert({
        merchant_id: merchantId,
        student_id: studentId,
        checkin_date: today,
        verification_method: method,
        verification_confidence: boundedConfidence,
        face_profile_id: faceProfileId,
        fingerprint_template_id: fingerprintTemplateId,
        verified_by: deviceName,
      })
      .select("id")
      .single();

    if (insertError || !created?.id) {
      if (insertError && "code" in insertError && insertError.code === "23505") {
        return { ok: false, reason: "already_completed" };
      }
      return { ok: false, reason: "save_failed" };
    }

    direction = "in";
    checkinId = created.id;
  } else if (!existing.checked_out_at) {
    const { error: updateError } = await supabase
      .from("gym_checkins")
      .update({
        checked_out_at: nowIso,
        checkout_verification_method: method,
        checkout_verification_confidence: boundedConfidence,
        checkout_verified_by: deviceName,
      })
      .eq("id", existing.id);

    if (updateError) {
      return { ok: false, reason: "save_failed" };
    }

    direction = "out";
    checkinId = existing.id;
  } else {
    await supabase.from("gym_access_logs").insert({
      merchant_id: merchantId,
      student_id: studentId,
      checkin_id: existing.id,
      method,
      result: "denied",
      confidence: boundedConfidence,
      device_name: deviceName,
      notes: notes ?? "Entrada e saída já registradas hoje.",
      direction: "in",
      evidence_image_url: evidenceImageUrl,
      evidence_image_path: evidenceImagePath,
    });
    return { ok: false, reason: "already_completed" };
  }

  await supabase.from("gym_access_logs").insert({
    merchant_id: merchantId,
    student_id: studentId,
    checkin_id: checkinId,
    method,
    result: "accepted",
    confidence: boundedConfidence,
    device_name: deviceName,
    notes,
    direction,
    evidence_image_url: evidenceImageUrl,
    evidence_image_path: evidenceImagePath,
  });

  return { ok: true, direction };
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
  const loginRaw = (formData.get("login") as string | null)?.trim() ?? "";
  const login = loginRaw.toLowerCase();
  const password = (formData.get("password") as string | null)?.trim() ?? "";
  const planId = (formData.get("plan_id") as string | null)?.trim() ?? "";
  const nextDueAt = parseDateOrNull(formData.get("next_due_at"));
  const returnTo = safeReturnTo(formData.get("return_to"), [
    "/dashboard/modulos/academia_alunos",
    "/dashboard/modulos/academia_renovacoes",
  ]);

  if (login.length < 2 || password.length < 1) {
    redirect(`${returnTo}?error=invalid`);
  }

  const { supabase, merchant } = await requireGymAccess();

  const passwordHash = hashPassword(password);
  const sessionToken = randomBytes(24).toString("base64url");
  const name = loginRaw || login;

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
    if (studentError && "code" in studentError && studentError.code === "23505") {
      redirect(`${returnTo}?error=login_taken`);
    }
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

export async function resetGymStudentPassword(formData: FormData): Promise<void> {
  const studentId = (formData.get("student_id") as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null)?.trim() ?? "";
  const returnTo = safeReturnTo(formData.get("return_to"), [
    "/dashboard/modulos/academia_alunos",
  ]);

  if (!studentId || password.length < 1) {
    redirect(`${returnTo}?error=invalid`);
  }

  const { supabase, merchant } = await requireGymAccess();
  const passwordHash = hashPassword(password);

  const { error } = await supabase
    .from("gym_students")
    .update({
      password_hash: passwordHash,
      session_token: null,
      updated_at: new Date().toISOString(),
    })
    .eq("merchant_id", merchant.id)
    .eq("id", studentId);

  if (error) {
    redirect(`${returnTo}?error=save_failed`);
  }

  redirect(`${returnTo}?password_reset=1`);
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

export async function registerGymFaceProfile(formData: FormData): Promise<void> {
  const studentId = (formData.get("student_id") as string | null)?.trim() ?? "";
  const faceLabel = (formData.get("face_label") as string | null)?.trim() || "principal";
  const imageUrl = (formData.get("image_url") as string | null)?.trim() || null;
  const imageStoragePath = (formData.get("image_storage_path") as string | null)?.trim() || null;
  const imageFile = formData.get("image") as File | null;
  const recognitionScore = Number((formData.get("recognition_score") as string | null) ?? "0");
  const qualityScore = Number((formData.get("quality_score") as string | null) ?? "0");
  const returnTo = safeReturnTo(formData.get("return_to"), [
    "/dashboard/modulos/academia_alunos",
  ]);

  if (!studentId) {
    redirect(`${returnTo}?error=invalid`);
  }

  const { supabase, merchant } = await requireGymAccess();

  const { data: student, error: studentError } = await supabase
    .from("gym_students")
    .select("id")
    .eq("merchant_id", merchant.id)
    .eq("id", studentId)
    .maybeSingle();

  if (studentError || !student?.id) {
    redirect(`${returnTo}?error=invalid`);
  }

  let nextImageUrl = imageUrl;
  let nextStoragePath = imageStoragePath;

  if (imageFile && imageFile.size > 0) {
    if (!imageFile.type.startsWith("image/")) {
      redirect(`${returnTo}?error=invalid`);
    }

    const ext = imageFile.name.split(".").pop()?.toLowerCase() || "png";
    const safeExt = ext.replace(/[^a-z0-9]/g, "") || "png";
    const path = `${merchant.id}/${student.id}/${Date.now()}-${crypto.randomUUID()}.${safeExt}`;

    const { error: uploadError, data } = await supabase.storage.from("member-avatars").upload(path, imageFile, {
      contentType: imageFile.type,
      upsert: false,
    });

    if (uploadError || !data?.path) {
      redirect(`${returnTo}?error=save_failed`);
    }

    const { data: publicUrl } = supabase.storage.from("member-avatars").getPublicUrl(data.path);
    nextImageUrl = publicUrl?.publicUrl ?? nextImageUrl;
    nextStoragePath = data.path ?? nextStoragePath;
  }

  const { error } = await supabase.from("gym_face_profiles").upsert(
    {
      merchant_id: merchant.id,
      student_id: student.id,
      face_label: faceLabel,
      image_url: nextImageUrl,
      image_storage_path: nextStoragePath,
      recognition_score: Number.isFinite(recognitionScore) ? Math.max(0, Math.min(1, recognitionScore)) : 0,
      quality_score: Number.isFinite(qualityScore) ? Math.max(0, Math.min(100, qualityScore)) : 0,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "merchant_id,student_id,face_label" },
  );

  if (error) {
    redirect(`${returnTo}?error=save_failed`);
  }

  redirect(`${returnTo}?saved=1`);
}

export async function registerGymFingerprintTemplate(formData: FormData): Promise<void> {
  const studentId = (formData.get("student_id") as string | null)?.trim() ?? "";
  const fingerName = (formData.get("finger_name") as string | null)?.trim() || "indicador";
  const templateText = (formData.get("template_text") as string | null)?.trim() ?? "";
  const templateHash = (formData.get("template_hash") as string | null)?.trim() || null;
  const deviceUserCode = (formData.get("device_user_code") as string | null)?.trim() || null;
  const qualityScore = Number((formData.get("quality_score") as string | null) ?? "0");
  const deviceName = (formData.get("device_name") as string | null)?.trim() || null;
  const returnTo = safeReturnTo(formData.get("return_to"), [
    "/dashboard/modulos/academia_alunos",
  ]);

  if (!studentId || !templateText) {
    redirect(`${returnTo}?error=invalid`);
  }

  const { supabase, merchant } = await requireGymAccess();

  const { data: student, error: studentError } = await supabase
    .from("gym_students")
    .select("id")
    .eq("merchant_id", merchant.id)
    .eq("id", studentId)
    .maybeSingle();

  if (studentError || !student?.id) {
    redirect(`${returnTo}?error=invalid`);
  }

  const { error } = await supabase.from("gym_fingerprint_templates").upsert(
    {
      merchant_id: merchant.id,
      student_id: student.id,
      finger_name: fingerName,
      template_text: templateText,
      template_hash: templateHash,
      device_user_code: deviceUserCode,
      quality_score: Number.isFinite(qualityScore) ? Math.max(0, Math.min(100, qualityScore)) : 0,
      device_name: deviceName,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "merchant_id,student_id,finger_name" },
  );

  if (error) {
    if ("code" in error && error.code === "23505") {
      redirect(`${returnTo}?error=device_code_taken`);
    }
    redirect(`${returnTo}?error=save_failed`);
  }

  redirect(`${returnTo}?saved=1`);
}

export async function registerGymAccessCheckin(formData: FormData): Promise<void> {
  const studentId = (formData.get("student_id") as string | null)?.trim() ?? "";
  const methodRaw = (formData.get("method") as string | null)?.trim() || "manual";
  const confidence = Number((formData.get("confidence") as string | null) ?? "1");
  const deviceName = (formData.get("device_name") as string | null)?.trim() || "front_desk";
  const notes = (formData.get("notes") as string | null)?.trim() || null;
  const returnTo = safeReturnTo(formData.get("return_to"), [
    "/dashboard/modulos/academia_presenca",
  ]);

  const allowedMethods: GymAccessMethod[] = ["manual", "qr", "facial", "fingerprint"];
  const method = allowedMethods.includes(methodRaw as GymAccessMethod) ? (methodRaw as GymAccessMethod) : "manual";

  if (!studentId) {
    redirect(`${returnTo}?error=invalid`);
  }

  const { supabase, merchant } = await requireGymAccess();

  const { data: student, error: studentError } = await supabase
    .from("gym_students")
    .select("id")
    .eq("merchant_id", merchant.id)
    .eq("id", studentId)
    .maybeSingle();

  if (studentError || !student?.id) {
    redirect(`${returnTo}?error=invalid`);
  }

  const result = await applyGymAccessEvent({
    supabase,
    merchantId: merchant.id,
    studentId: student.id,
    method,
    confidence: Number.isFinite(confidence) ? confidence : 1,
    deviceName,
    notes,
  });

  if (!result.ok) {
    redirect(`${returnTo}?error=${result.reason}`);
  }

  redirect(`${returnTo}?saved=1&direction=${result.direction}`);
}

export async function verifyGymFaceAccess(formData: FormData): Promise<void> {
  const studentId = (formData.get("student_id") as string | null)?.trim() ?? "";
  const imageFile = formData.get("image") as File | null;
  const deviceName = (formData.get("device_name") as string | null)?.trim() || "face_terminal";
  const notes = (formData.get("notes") as string | null)?.trim() || null;
  const returnTo = safeReturnTo(formData.get("return_to"), [
    "/dashboard/modulos/academia_presenca",
  ]);

  if (!studentId || !imageFile || imageFile.size === 0) {
    redirect(`${returnTo}?error=invalid`);
  }

  const { supabase, merchant } = await requireGymAccess();

  const { data: student, error: studentError } = await supabase
    .from("gym_students")
    .select("id, name")
    .eq("merchant_id", merchant.id)
    .eq("id", studentId)
    .maybeSingle();

  if (studentError || !student?.id) {
    redirect(`${returnTo}?error=invalid`);
  }

  const { data: faceProfile } = await supabase
    .from("gym_face_profiles")
    .select("id")
    .eq("merchant_id", merchant.id)
    .eq("student_id", student.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!faceProfile?.id) {
    redirect(`${returnTo}?error=no_face_profile`);
  }

  const ext = imageFile.name.split(".").pop()?.toLowerCase() || "png";
  const safeExt = ext.replace(/[^a-z0-9]/g, "") || "png";
  const path = `${merchant.id}/${student.id}/access-${Date.now()}-${crypto.randomUUID()}.${safeExt}`;

  const { error: uploadError, data } = await supabase.storage.from("member-avatars").upload(path, imageFile, {
    contentType: imageFile.type || "image/png",
    upsert: false,
  });

  if (uploadError || !data?.path) {
    redirect(`${returnTo}?error=save_failed`);
  }

  const { data: publicUrl } = supabase.storage.from("member-avatars").getPublicUrl(data.path);

  const result = await applyGymAccessEvent({
    supabase,
    merchantId: merchant.id,
    studentId: student.id,
    method: "facial",
    confidence: 0.97,
    deviceName,
    notes,
    faceProfileId: faceProfile.id,
    evidenceImageUrl: publicUrl?.publicUrl ?? null,
    evidenceImagePath: data.path,
  });

  if (!result.ok) {
    redirect(`${returnTo}?error=${result.reason}`);
  }

  redirect(`${returnTo}?saved=1&direction=${result.direction}`);
}

export async function verifyGymFingerprintAccess(formData: FormData): Promise<void> {
  const studentIdInput = (formData.get("student_id") as string | null)?.trim() ?? "";
  const deviceUserCode = (formData.get("device_user_code") as string | null)?.trim() ?? "";
  const deviceName = (formData.get("device_name") as string | null)?.trim() || "fingerprint_reader";
  const notes = (formData.get("notes") as string | null)?.trim() || null;
  const returnTo = safeReturnTo(formData.get("return_to"), [
    "/dashboard/modulos/academia_presenca",
  ]);

  if (!studentIdInput && !deviceUserCode) {
    redirect(`${returnTo}?error=invalid`);
  }

  const { supabase, merchant } = await requireGymAccess();

  let resolvedStudentId = studentIdInput;
  let matchedTemplateId: string | null = null;

  if (!resolvedStudentId && deviceUserCode) {
    const { data: templateByCode } = await supabase
      .from("gym_fingerprint_templates")
      .select("id, student_id")
      .eq("merchant_id", merchant.id)
      .eq("device_user_code", deviceUserCode)
      .eq("is_active", true)
      .maybeSingle();

    if (!templateByCode?.student_id) {
      redirect(`${returnTo}?error=fingerprint_not_recognized`);
    }

    resolvedStudentId = templateByCode.student_id;
    matchedTemplateId = templateByCode.id;
  }

  const { data: student, error: studentError } = await supabase
    .from("gym_students")
    .select("id")
    .eq("merchant_id", merchant.id)
    .eq("id", resolvedStudentId)
    .maybeSingle();

  if (studentError || !student?.id) {
    redirect(`${returnTo}?error=invalid`);
  }

  if (!matchedTemplateId) {
    const { data: template } = await supabase
      .from("gym_fingerprint_templates")
      .select("id")
      .eq("merchant_id", merchant.id)
      .eq("student_id", student.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (!template?.id) {
      redirect(`${returnTo}?error=no_fingerprint_profile`);
    }

    matchedTemplateId = template.id;
  }

  const result = await applyGymAccessEvent({
    supabase,
    merchantId: merchant.id,
    studentId: student.id,
    method: "fingerprint",
    confidence: 0.98,
    deviceName,
    notes,
    fingerprintTemplateId: matchedTemplateId,
  });

  if (!result.ok) {
    redirect(`${returnTo}?error=${result.reason}`);
  }

  redirect(`${returnTo}?saved=1&direction=${result.direction}`);
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
