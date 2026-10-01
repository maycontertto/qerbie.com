"use server";

import { redirect } from "next/navigation";
import { getDashboardUserOrRedirect } from "@/lib/auth/guard";

const RETURN_TO = "/dashboard/modulos/convenios";

async function requireClinicOwner() {
  const { supabase, merchant, user } = await getDashboardUserOrRedirect();
  if (user.id !== merchant.owner_user_id) redirect("/dashboard");
  if (merchant.business_category !== "clinica" && merchant.business_category !== "consultorio") {
    redirect("/dashboard");
  }
  return { supabase, merchant };
}

function text(formData: FormData, key: string, maxLength: number): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function createClinicInsurancePlan(formData: FormData): Promise<void> {
  const providerName = text(formData, "provider_name", 120);
  const planName = text(formData, "plan_name", 120);
  const registrationCode = text(formData, "registration_code", 80);
  const contact = text(formData, "contact", 160);
  const notes = text(formData, "notes", 2000);
  if (providerName.length < 2 || planName.length < 2) redirect(`${RETURN_TO}?error=invalid`);

  const { supabase, merchant } = await requireClinicOwner();
  const { error } = await supabase.from("clinic_insurance_plans").insert({
    merchant_id: merchant.id,
    provider_name: providerName,
    plan_name: planName,
    registration_code: registrationCode || null,
    contact: contact || null,
    notes: notes || null,
  });
  if (error) redirect(`${RETURN_TO}?error=save_failed`);
  redirect(`${RETURN_TO}?saved=1`);
}

export async function updateClinicInsurancePlan(formData: FormData): Promise<void> {
  const id = text(formData, "id", 64);
  const providerName = text(formData, "provider_name", 120);
  const planName = text(formData, "plan_name", 120);
  const registrationCode = text(formData, "registration_code", 80);
  const contact = text(formData, "contact", 160);
  const notes = text(formData, "notes", 2000);
  const isActive = formData.get("is_active") === "on";
  if (!id || providerName.length < 2 || planName.length < 2) redirect(`${RETURN_TO}?error=invalid`);

  const { supabase, merchant } = await requireClinicOwner();
  const { data, error } = await supabase
    .from("clinic_insurance_plans")
    .update({
      provider_name: providerName,
      plan_name: planName,
      registration_code: registrationCode || null,
      contact: contact || null,
      notes: notes || null,
      is_active: isActive,
    })
    .eq("merchant_id", merchant.id)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error || !data) redirect(`${RETURN_TO}?error=save_failed`);
  redirect(`${RETURN_TO}?saved=1`);
}
