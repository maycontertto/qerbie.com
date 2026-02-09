"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getDashboardUserOrRedirect,
  getMerchantMemberOrRedirect,
  hasMemberPermission,
} from "@/lib/auth/guard";

async function requireManageAttendants() {
  const { supabase, user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const ok =
    isOwner ||
    (membership
      ? hasMemberPermission(membership.role, membership.permissions, "manage_attendants")
      : false);

  if (!ok) {
    redirect("/dashboard");
  }

  return { supabase, user, merchant, membership, isOwner };
}

function normalizeLogin(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function makeCode(login: string): string {
  const base = normalizeLogin(login) || "ATENDENTE";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base.toUpperCase()}-${suffix}`;
}

export async function createAttendantInvite(formData: FormData) {
  const displayName = String(formData.get("display_name") ?? "").trim();
  const loginRaw = String(formData.get("login") ?? "");
  const login = normalizeLogin(loginRaw);
  const roleRaw = String(formData.get("role") ?? "staff").trim();
  const role = roleRaw === "admin" ? "admin" : "staff";
  const jobTitleRaw = String(formData.get("job_title") ?? "").trim();
  const jobTitleCustomRaw = String(formData.get("job_title_custom") ?? "").trim();
  const jobTitleValue = jobTitleRaw === "__other__" ? jobTitleCustomRaw : jobTitleRaw;
  const jobTitle = jobTitleValue ? jobTitleValue.slice(0, 60) : null;

  if (!login) {
    redirect("/dashboard/modulos/administracao?error=login_required");
  }

  const { user, merchant, supabase } = await requireManageAttendants();

  const code = makeCode(login);

  const { error } = await supabase.from("merchant_invites").insert({
    merchant_id: merchant.id,
    created_by_user_id: user.id,
    role,
    code,
    login,
    display_name: displayName || null,
    job_title: jobTitle,
    max_uses: 1,
    used_count: 0,
    is_active: true,
    expires_at: null,
  });

  if (error) {
    redirect("/dashboard/modulos/administracao?error=invite_create_failed");
  }

  redirect("/dashboard/modulos/administracao?saved=1");
}

export async function updateAttendantRole(formData: FormData) {
  const memberId = String(formData.get("member_id") ?? "").trim();
  const roleRaw = String(formData.get("role") ?? "staff").trim();
  const role = roleRaw === "admin" ? "admin" : "staff";

  if (!memberId) return;

  const { merchant, supabase } = await requireManageAttendants();

  await supabase
    .from("merchant_members")
    .update({ role })
    .eq("id", memberId)
    .eq("merchant_id", merchant.id);

  redirect("/dashboard/modulos/administracao?saved=1");
}

const PERMISSION_KEYS = [
  "dashboard_access",
  "dashboard_branding",
  "dashboard_products",
  "dashboard_orders",
  "dashboard_delivery",
  "dashboard_support",
  "dashboard_sales",
  "manage_attendants",
] as const;

export async function updateAttendantPermissions(formData: FormData) {
  const memberId = String(formData.get("member_id") ?? "").trim();
  if (!memberId) return;

  const { merchant, supabase } = await requireManageAttendants();

  const permissions: Record<string, boolean> = {};
  for (const key of PERMISSION_KEYS) {
    permissions[key] = formData.get(key) !== null;
  }

  await supabase
    .from("merchant_members")
    .update({ permissions })
    .eq("id", memberId)
    .eq("merchant_id", merchant.id);

  redirect("/dashboard/modulos/administracao?saved=1");
}

export async function revokeInvite(formData: FormData) {
  const inviteId = String(formData.get("invite_id") ?? "").trim();
  if (!inviteId) return;

  const { merchant, supabase } = await requireManageAttendants();

  await supabase
    .from("merchant_invites")
    .delete()
    .eq("id", inviteId)
    .eq("merchant_id", merchant.id);

  redirect("/dashboard/modulos/administracao?saved=1");
}

export async function removeAttendant(formData: FormData) {
  const memberId = String(formData.get("member_id") ?? "").trim();
  if (!memberId) return;

  const { merchant, supabase } = await requireManageAttendants();

  await supabase
    .from("merchant_members")
    .delete()
    .eq("id", memberId)
    .eq("merchant_id", merchant.id);

  redirect("/dashboard/modulos/administracao?saved=1");
}

export async function redeemAttendantInvite(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) {
    redirect("/atendente/vincular?error=code_required");
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("redeem_merchant_invite", {
    p_code: code,
  });

  if (error) {
    const msg = (error.message || "").toLowerCase();
    const key = msg.includes("invalid_code")
      ? "invalid"
      : msg.includes("code_used")
        ? "used"
        : "failed";
    redirect(`/atendente/vincular?error=${key}`);
  }

  redirect("/atendente?saved=1");
}

export async function uploadMyAvatar(formData: FormData) {
  const file = formData.get("avatar") as File | null;

  if (!file || file.size === 0) {
    redirect("/atendente?error=avatar_missing");
  }

  if (!file.type.startsWith("image/")) {
    redirect("/atendente?error=avatar_type");
  }

  const MAX_BYTES = 3 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    redirect("/atendente?error=avatar_too_large");
  }

  const { supabase, user, merchant } = await getMerchantMemberOrRedirect();

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const safeExt = ext.replace(/[^a-z0-9]/g, "") || "png";
  const path = `${merchant.id}/${user.id}/${Date.now()}-${crypto.randomUUID()}.${safeExt}`;

  const { error: uploadError, data } = await supabase
    .storage
    .from("member-avatars")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError || !data?.path) {
    const msg = (uploadError?.message ?? "").toLowerCase();
    if (msg.includes("bucket") && msg.includes("not") && msg.includes("found")) {
      redirect("/atendente?error=bucket_missing");
    }
    redirect("/atendente?error=avatar_upload_failed");
  }

  const { data: publicUrl } = supabase
    .storage
    .from("member-avatars")
    .getPublicUrl(data.path);

  const url = publicUrl?.publicUrl ?? null;

  await supabase
    .from("merchant_members")
    .update({ avatar_url: url })
    .eq("merchant_id", merchant.id)
    .eq("user_id", user.id);

  redirect("/atendente?avatar_saved=1");
}
