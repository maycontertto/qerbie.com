"use server";

import { redirect } from "next/navigation";
import { getDashboardUserOrRedirect } from "@/lib/auth/guard";

const RETURN_TO = "/dashboard/modulos/prontuario";

function value(formData: FormData, key: string, limit: number): string {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry.trim().slice(0, limit) : "";
}

export async function createClinicPatientRecord(formData: FormData): Promise<void> {
  const patientName = value(formData, "patient_name", 160);
  const patientContact = value(formData, "patient_contact", 160);
  const visitDate = value(formData, "visit_date", 10);
  const reason = value(formData, "reason", 1000);
  const recordNotes = value(formData, "record_notes", 12000);
  if (patientName.length < 2 || recordNotes.length < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(visitDate)) {
    redirect(`${RETURN_TO}?error=invalid`);
  }

  const { supabase, merchant, user } = await getDashboardUserOrRedirect();
  if (user.id !== merchant.owner_user_id) redirect("/dashboard");
  if (merchant.business_category !== "clinica" && merchant.business_category !== "consultorio") redirect("/dashboard");

  const { error } = await supabase.from("clinic_patient_records").insert({
    merchant_id: merchant.id,
    patient_name: patientName,
    patient_contact: patientContact || null,
    visit_date: visitDate,
    reason: reason || null,
    record_notes: recordNotes,
  });
  if (error) redirect(`${RETURN_TO}?error=save_failed`);
  redirect(`${RETURN_TO}?saved=1`);
}
