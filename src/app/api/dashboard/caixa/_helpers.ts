import { createClient } from "@/lib/supabase/server";
import { hasMemberPermission } from "@/lib/auth/guard";

type ApiDashboardContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string };
  merchant: { id: string; owner_user_id: string };
  isOwner: boolean;
  canSales: boolean;
  canManage: boolean;
  membership: { id: string; role: string; permissions: unknown; cash_register_device_id: string | null; job_title: string | null } | null;
};

export async function getDashboardContextForApi(): Promise<ApiDashboardContext | null> {
  const supabase = await createClient({}, { withAuth: true });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: ownedMerchant } = await supabase
    .from("merchants")
    .select("id, owner_user_id")
    .eq("owner_user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (ownedMerchant) {
    return {
      supabase,
      user: { id: user.id },
      merchant: ownedMerchant,
      isOwner: true,
      canSales: true,
      canManage: true,
      membership: null,
    };
  }

  const { data: membership } = await supabase
    .from("merchant_members")
    .select("id, merchant_id, role, permissions, cash_register_device_id, job_title")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const merchantId = membership?.merchant_id ?? "";
  if (!merchantId || !membership) return null;

  const canSales = hasMemberPermission(membership.role, membership.permissions, "dashboard_sales");
  if (!canSales) return null;
  if (membership.job_title === "Caixa" && !membership.cash_register_device_id) return null;

  const { data: merchant } = await supabase
    .from("merchants")
    .select("id, owner_user_id")
    .eq("id", merchantId)
    .maybeSingle();

  if (!merchant) return null;

  return {
    supabase,
    user: { id: user.id },
    merchant,
    isOwner: false,
    canSales,
    canManage: hasMemberPermission(membership.role, membership.permissions, "manage_attendants"),
    membership,
  };
}
