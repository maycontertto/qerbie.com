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

async function requireBarbershopAccess() {
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

export async function createBarbershopQrToken(formData: FormData): Promise<void> {
  const label = (formData.get("label") as string | null)?.trim() ?? "";
  const returnTo = safeReturnTo(formData.get("return_to"), ["/dashboard/modulos/barbearia_qr"]);

  const finalLabel = label.length >= 1 ? label.slice(0, 80) : "Barbearia";

  const { supabase, merchant } = await requireBarbershopAccess();

  const qrToken = randomBytes(18).toString("base64url");
  const { error } = await supabase.from("barbershop_qr_tokens").insert({
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

export async function deactivateBarbershopQrToken(formData: FormData): Promise<void> {
  const id = (formData.get("id") as string | null)?.trim() ?? "";
  const returnTo = safeReturnTo(formData.get("return_to"), ["/dashboard/modulos/barbearia_qr"]);

  if (!id) {
    redirect(`${returnTo}?error=invalid`);
  }

  const { supabase, merchant } = await requireBarbershopAccess();
  const { error } = await supabase
    .from("barbershop_qr_tokens")
    .update({ is_active: false })
    .eq("merchant_id", merchant.id)
    .eq("id", id);

  if (error) {
    redirect(`${returnTo}?error=save_failed`);
  }

  redirect(`${returnTo}?saved=1`);
}

export async function createBarbershopService(formData: FormData): Promise<void> {
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const description = (formData.get("description") as string | null)?.trim() ?? "";
  const priceCents = Math.max(0, parseIntOr(formData.get("price_cents"), 0));
  const durationMin = Math.min(24 * 60, Math.max(5, parseIntOr(formData.get("duration_min"), 30)));
  const returnTo = safeReturnTo(formData.get("return_to"), ["/dashboard/modulos/barbearia_servicos"]);

  if (name.length < 2) {
    redirect(`${returnTo}?error=invalid`);
  }

  const { supabase, merchant } = await requireBarbershopAccess();
  const { error } = await supabase.from("barbershop_services").insert({
    merchant_id: merchant.id,
    name: name.slice(0, 120),
    description: description ? description.slice(0, 400) : null,
    price_cents: priceCents,
    duration_min: durationMin,
    is_active: true,
  });

  if (error) {
    redirect(`${returnTo}?error=save_failed`);
  }

  redirect(`${returnTo}?saved=1`);
}

export async function updateBarbershopService(formData: FormData): Promise<void> {
  const id = (formData.get("id") as string | null)?.trim() ?? "";
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const description = (formData.get("description") as string | null)?.trim() ?? "";
  const priceCents = Math.max(0, parseIntOr(formData.get("price_cents"), 0));
  const durationMin = Math.min(24 * 60, Math.max(5, parseIntOr(formData.get("duration_min"), 30)));
  const isActive = formData.get("is_active") === "on";
  const returnTo = safeReturnTo(formData.get("return_to"), ["/dashboard/modulos/barbearia_servicos"]);

  if (!id || name.length < 2) {
    redirect(`${returnTo}?error=invalid`);
  }

  const { supabase, merchant } = await requireBarbershopAccess();
  const { error } = await supabase
    .from("barbershop_services")
    .update({
      name: name.slice(0, 120),
      description: description ? description.slice(0, 400) : null,
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
