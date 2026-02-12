import { createClient } from "@/lib/supabase/server";
import { hasMemberPermission } from "@/lib/auth/guard";

type ApiDashboardContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string };
  merchant: { id: string; owner_user_id: string };
  isOwner: boolean;
  canSales: boolean;
};

export async function getDashboardContextForApi(): Promise<ApiDashboardContext | null> {
  const supabase = await createClient();

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
    };
  }

  const { data: membership } = await supabase
    .from("merchant_members")
    .select("merchant_id, role, permissions")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const merchantId = membership?.merchant_id ?? "";
  if (!merchantId || !membership) return null;

  const canDashboard = hasMemberPermission(membership.role, membership.permissions, "dashboard_access");
  if (!canDashboard) return null;

  const { data: merchant } = await supabase
    .from("merchants")
    .select("id, owner_user_id")
    .eq("id", merchantId)
    .maybeSingle();

  if (!merchant) return null;

  const canSales = hasMemberPermission(membership.role, membership.permissions, "dashboard_sales");

  return {
    supabase,
    user: { id: user.id },
    merchant,
    isOwner: false,
    canSales,
  };
}
