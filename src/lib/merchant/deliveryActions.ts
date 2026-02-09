"use server";

import { redirect } from "next/navigation";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";

function parseMoney(raw: FormDataEntryValue | null): number | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const normalized = s.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function clampInt(
  value: FormDataEntryValue | null,
  min: number,
  max: number,
): number | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const n = Math.trunc(Number(s));
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, n));
}

export async function saveDeliverySettings(formData: FormData): Promise<void> {
  const enabled = formData.get("delivery_enabled") === "on";
  const fee = parseMoney(formData.get("delivery_fee"));
  const noteRaw = (formData.get("delivery_note") as string | null)?.trim() ?? "";
  const note = noteRaw ? noteRaw.slice(0, 500) : null;
  const eta = clampInt(formData.get("delivery_eta_minutes"), 1, 240);

  const { supabase, user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const ok =
    isOwner ||
    (membership
      ? hasMemberPermission(membership.role, membership.permissions, "dashboard_delivery")
      : false);
  if (!ok) {
    redirect("/dashboard");
  }

  const { error } = await supabase
    .from("merchants")
    .update({
      delivery_enabled: enabled,
      delivery_fee: fee,
      delivery_note: note,
      delivery_eta_minutes: eta,
    })
    .eq("id", merchant.id);

  if (error) {
    console.error("saveDeliverySettings: update failed", {
      code: error.code,
      message: error.message,
      details: (error as { details?: string | null }).details,
    });
    redirect("/dashboard/modulos/entrega?error=save_failed");
  }

  redirect("/dashboard/modulos/entrega?saved=1");
}
