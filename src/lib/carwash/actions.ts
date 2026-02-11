"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";

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

async function requireCarwashAccess() {
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

  return { supabase, merchant };
}

export async function createCarwashQrToken(formData: FormData): Promise<void> {
  const label = (formData.get("label") as string | null)?.trim() ?? "";
  const returnTo = safeReturnTo(formData.get("return_to"), ["/dashboard/modulos/lava_qr"]);

  const finalLabel = label.length >= 1 ? label.slice(0, 80) : "Lava Jato";
  const { supabase, merchant } = await requireCarwashAccess();

  const qrToken = randomBytes(18).toString("base64url");
  const { error } = await supabase.from("carwash_qr_tokens").insert({
    merchant_id: merchant.id,
    label: finalLabel,
    qr_token: qrToken,
    is_active: true,
  });

  if (error) {
    redirect(`${returnTo}?error=save_failed`);
  }

  redirect(`${returnTo}?saved=1&qr=${encodeURIComponent(qrToken)}`);
}

export async function deactivateCarwashQrToken(formData: FormData): Promise<void> {
  const id = (formData.get("id") as string | null)?.trim() ?? "";
  const returnTo = safeReturnTo(formData.get("return_to"), ["/dashboard/modulos/lava_qr"]);

  if (!id) {
    redirect(`${returnTo}?error=invalid`);
  }

  const { supabase, merchant } = await requireCarwashAccess();
  const { error } = await supabase
    .from("carwash_qr_tokens")
    .update({ is_active: false })
    .eq("merchant_id", merchant.id)
    .eq("id", id);

  if (error) {
    redirect(`${returnTo}?error=save_failed`);
  }

  redirect(`${returnTo}?saved=1`);
}

export async function createCarwashService(formData: FormData): Promise<void> {
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const description = (formData.get("description") as string | null)?.trim() ?? "";
  const notes = (formData.get("notes") as string | null)?.trim() ?? "";
  const imageUrl = (formData.get("image_url") as string | null)?.trim() ?? "";
  const priceCents = Math.max(0, parseIntOr(formData.get("price_cents"), 0));
  const durationMin = Math.min(24 * 60, Math.max(5, parseIntOr(formData.get("duration_min"), 30)));
  const returnTo = safeReturnTo(formData.get("return_to"), ["/dashboard/modulos/lava_servicos"]);

  if (name.length < 2) {
    redirect(`${returnTo}?error=invalid`);
  }

  const { supabase, merchant } = await requireCarwashAccess();
  const { error } = await supabase.from("carwash_services").insert({
    merchant_id: merchant.id,
    name: name.slice(0, 120),
    description: description ? description.slice(0, 800) : null,
    notes: notes ? notes.slice(0, 800) : null,
    image_url: imageUrl ? imageUrl.slice(0, 500) : null,
    price_cents: priceCents,
    duration_min: durationMin,
    is_active: true,
  });

  if (error) {
    redirect(`${returnTo}?error=save_failed`);
  }

  redirect(`${returnTo}?saved=1`);
}

export async function updateCarwashService(formData: FormData): Promise<void> {
  const id = (formData.get("id") as string | null)?.trim() ?? "";
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const description = (formData.get("description") as string | null)?.trim() ?? "";
  const notes = (formData.get("notes") as string | null)?.trim() ?? "";
  const imageUrl = (formData.get("image_url") as string | null)?.trim() ?? "";
  const priceCents = Math.max(0, parseIntOr(formData.get("price_cents"), 0));
  const durationMin = Math.min(24 * 60, Math.max(5, parseIntOr(formData.get("duration_min"), 30)));
  const isActive = formData.get("is_active") === "on";

  const returnTo = safeReturnTo(formData.get("return_to"), ["/dashboard/modulos/lava_servicos"]);

  if (!id || name.length < 2) {
    redirect(`${returnTo}?error=invalid`);
  }

  const { supabase, merchant } = await requireCarwashAccess();
  const { error } = await supabase
    .from("carwash_services")
    .update({
      name: name.slice(0, 120),
      description: description ? description.slice(0, 800) : null,
      notes: notes ? notes.slice(0, 800) : null,
      image_url: imageUrl ? imageUrl.slice(0, 500) : null,
      price_cents: priceCents,
      duration_min: durationMin,
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

export async function updateCarwashProfessionalServices(formData: FormData): Promise<void> {
  const queueId = (formData.get("queue_id") as string | null)?.trim() ?? "";
  const returnTo = safeReturnTo(formData.get("return_to"), ["/dashboard/modulos/lava_profissionais"]);

  if (!queueId) {
    redirect(`${returnTo}?error=invalid`);
  }

  const serviceIds = formData.getAll("service_ids").filter((v): v is string => typeof v === "string");
  const uniqueServiceIds = Array.from(new Set(serviceIds.map((s) => s.trim()).filter(Boolean)));

  const { supabase, merchant } = await requireCarwashAccess();

  const { data: queue } = await supabase
    .from("merchant_queues")
    .select("id")
    .eq("id", queueId)
    .eq("merchant_id", merchant.id)
    .maybeSingle();

  if (!queue) {
    redirect(`${returnTo}?error=invalid`);
  }

  await supabase
    .from("carwash_queue_services")
    .delete()
    .eq("merchant_id", merchant.id)
    .eq("queue_id", queueId);

  if (uniqueServiceIds.length) {
    const { data: services } = await supabase
      .from("carwash_services")
      .select("id")
      .eq("merchant_id", merchant.id)
      .in("id", uniqueServiceIds);

    const allowedIds = new Set((services ?? []).map((s) => s.id));
    const rows = uniqueServiceIds
      .filter((id) => allowedIds.has(id))
      .map((serviceId) => ({
        merchant_id: merchant.id,
        queue_id: queueId,
        service_id: serviceId,
      }));

    if (rows.length) {
      const { error } = await supabase.from("carwash_queue_services").insert(rows);
      if (error) {
        redirect(`${returnTo}?error=save_failed`);
      }
    }
  }

  redirect(`${returnTo}?saved=1`);
}

export async function createCarwashVehicleProfile(formData: FormData): Promise<void> {
  const vehicleLabel = (formData.get("vehicle_label") as string | null)?.trim() ?? "";
  const ownerName = (formData.get("owner_name") as string | null)?.trim() ?? "";
  const ownerContact = (formData.get("owner_contact") as string | null)?.trim() ?? "";
  const notes = (formData.get("notes") as string | null)?.trim() ?? "";
  const returnTo = safeReturnTo(formData.get("return_to"), ["/dashboard/modulos/lava_historico"]);

  if (vehicleLabel.length < 2) {
    redirect(`${returnTo}?error=invalid`);
  }

  const { supabase, merchant } = await requireCarwashAccess();
  const { error } = await supabase.from("carwash_vehicle_profiles").insert({
    merchant_id: merchant.id,
    vehicle_label: vehicleLabel.slice(0, 120),
    owner_name: ownerName ? ownerName.slice(0, 120) : null,
    owner_contact: ownerContact ? ownerContact.slice(0, 120) : null,
    notes: notes ? notes.slice(0, 2000) : null,
  });

  if (error) {
    redirect(`${returnTo}?error=save_failed`);
  }

  redirect(`${returnTo}?saved=1`);
}

export async function updateCarwashVehicleProfile(formData: FormData): Promise<void> {
  const id = (formData.get("id") as string | null)?.trim() ?? "";
  const vehicleLabel = (formData.get("vehicle_label") as string | null)?.trim() ?? "";
  const ownerName = (formData.get("owner_name") as string | null)?.trim() ?? "";
  const ownerContact = (formData.get("owner_contact") as string | null)?.trim() ?? "";
  const notes = (formData.get("notes") as string | null)?.trim() ?? "";
  const returnTo = safeReturnTo(formData.get("return_to"), ["/dashboard/modulos/lava_historico"]);

  if (!id || vehicleLabel.length < 2) {
    redirect(`${returnTo}?error=invalid`);
  }

  const { supabase, merchant } = await requireCarwashAccess();
  const { error } = await supabase
    .from("carwash_vehicle_profiles")
    .update({
      vehicle_label: vehicleLabel.slice(0, 120),
      owner_name: ownerName ? ownerName.slice(0, 120) : null,
      owner_contact: ownerContact ? ownerContact.slice(0, 120) : null,
      notes: notes ? notes.slice(0, 2000) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("merchant_id", merchant.id)
    .eq("id", id);

  if (error) {
    redirect(`${returnTo}?error=save_failed`);
  }

  redirect(`${returnTo}?saved=1`);
}
