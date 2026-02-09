import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Json, MerchantMemberRole } from "@/lib/supabase/database.types";

type MemberPermissions = Record<string, boolean>;

function asPermissions(value: Json | null | undefined): MemberPermissions {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: MemberPermissions = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "boolean") out[k] = v;
  }
  return out;
}

export function hasMemberPermission(
  role: MerchantMemberRole,
  permissions: Json | null | undefined,
  perm: string,
): boolean {
  const p = asPermissions(permissions);
  const explicit = Object.prototype.hasOwnProperty.call(p, perm) ? p[perm] : undefined;
  if (typeof explicit === "boolean") return explicit;
  return role === "admin";
}

/**
 * Returns the current authenticated user or redirects to sign-in.
 * Use at the top of any protected Server Component / page.
 */
export async function getSessionOrRedirect(options?: { redirectTo?: string }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(options?.redirectTo ?? "/auth/sign-in");
  }

  return { supabase, user };
}

/**
 * Returns the current merchant for the authenticated user.
 * Redirects to sign-in if not authenticated, or to onboarding
 * if no merchant exists yet.
 */
export async function getMerchantOrRedirect() {
  const { supabase, user } = await getSessionOrRedirect();

  // 1) Owner flow
  const { data: ownedMerchant } = await supabase
    .from("merchants")
    .select("*")
    .eq("owner_user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (ownedMerchant) {
    return { supabase, user, merchant: ownedMerchant };
  }

  // 2) Member flow
  const { data: membership } = await supabase
    .from("merchant_members")
    .select("merchant_id, role, permissions")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const merchantId = membership?.merchant_id;
  const { data: memberMerchant } = merchantId
    ? await supabase.from("merchants").select("*").eq("id", merchantId).maybeSingle()
    : { data: null };

  const merchant = memberMerchant;

  if (!merchant) {
    // Edge case: authenticated but no merchant (e.g. interrupted onboarding).
    redirect("/auth/sign-up?reason=missing_merchant");
  }

  return { supabase, user, merchant };
}

/**
 * Owner-only guard: staff/atendentes não devem acessar o /dashboard.
 */
export async function getMerchantOwnerOrRedirect() {
  const { supabase, user } = await getSessionOrRedirect();

  const { data: ownedMerchant } = await supabase
    .from("merchants")
    .select("*")
    .eq("owner_user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!ownedMerchant) {
    redirect("/atendente");
  }

  return { supabase, user, merchant: ownedMerchant };
}

/**
 * Staff/atendente guard: precisa estar logado e vinculado a uma loja.
 */
export async function getMerchantMemberOrRedirect() {
  const { supabase, user } = await getSessionOrRedirect();

  // 1) owner também pode usar.
  const { data: ownedMerchant } = await supabase
    .from("merchants")
    .select("*")
    .eq("owner_user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (ownedMerchant) {
    return { supabase, user, merchant: ownedMerchant };
  }

  // 2) member flow
  const { data: membership } = await supabase
    .from("merchant_members")
    .select("merchant_id, role, permissions")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const merchantId = membership?.merchant_id;
  const { data: memberMerchant } = merchantId
    ? await supabase.from("merchants").select("*").eq("id", merchantId).maybeSingle()
    : { data: null };

  if (!memberMerchant) {
    redirect("/atendente/vincular");
  }

  return { supabase, user, merchant: memberMerchant, membership };
}

/**
 * Dashboard guard: owner sempre entra; membro só entra se tiver permissão.
 */
export async function getDashboardUserOrRedirect() {
  const { supabase, user } = await getSessionOrRedirect();

  // 1) Owner always allowed.
  const { data: ownedMerchant } = await supabase
    .from("merchants")
    .select("*")
    .eq("owner_user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (ownedMerchant) {
    return { supabase, user, merchant: ownedMerchant, membership: null };
  }

  // 2) Member: requires dashboard_access permission (default: admin=true, staff=false).
  const { data: membership } = await supabase
    .from("merchant_members")
    .select("merchant_id, role, permissions")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const merchantId = membership?.merchant_id;
  if (!merchantId || !membership) {
    redirect("/atendente");
  }

  const canDashboard = hasMemberPermission(membership.role, membership.permissions, "dashboard_access");
  if (!canDashboard) {
    redirect("/atendente");
  }

  const { data: memberMerchant } = await supabase
    .from("merchants")
    .select("*")
    .eq("id", merchantId)
    .maybeSingle();

  if (!memberMerchant) {
    redirect("/atendente/vincular");
  }

  return { supabase, user, merchant: memberMerchant, membership };
}
