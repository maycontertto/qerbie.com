/**
 * Resolve o AssistantContext a partir da sessão autenticada do Supabase.
 * Espelha o padrão de src/lib/auth/guard.ts (getDashboardUserOrRedirect) e
 * src/app/api/dashboard/caixa/_helpers.ts (getDashboardContextForApi), mas
 * sem redirecionar — retorna `null` quando não há acesso, para o chamador
 * decidir a resposta (ex.: 401 numa rota de API).
 *
 * REGRA DE SEGURANÇA: o merchantId nunca vem de um parâmetro da requisição,
 * do corpo do chat ou do modelo de IA — sempre da sessão Supabase Auth.
 */
import { createClient } from "@/lib/supabase/server";
import { hasMemberPermission } from "@/lib/auth/guard";
import type { AssistantContext, AssistantPermission } from "@ai/types";

export async function buildAssistantContext(): Promise<AssistantContext | null> {
  const supabase = await createClient({}, { withAuth: true });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: ownedMerchant } = await supabase
    .from("merchants")
    .select("id, name, business_category, owner_user_id")
    .eq("owner_user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (ownedMerchant) {
    return {
      supabase,
      userId: user.id,
      merchantId: ownedMerchant.id,
      merchantName: ownedMerchant.name,
      businessCategory: ownedMerchant.business_category,
      isOwner: true,
      can: () => true,
    };
  }

  const { data: membership } = await supabase
    .from("merchant_members")
    .select("merchant_id, role, permissions")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const merchantId = membership?.merchant_id;
  if (!merchantId || !membership) return null;

  const canDashboard = hasMemberPermission(membership.role, membership.permissions, "dashboard_access");
  if (!canDashboard) return null;

  const { data: merchant } = await supabase
    .from("merchants")
    .select("id, name, business_category, owner_user_id")
    .eq("id", merchantId)
    .maybeSingle();

  if (!merchant) return null;

  return {
    supabase,
    userId: user.id,
    merchantId: merchant.id,
    merchantName: merchant.name,
    businessCategory: merchant.business_category,
    isOwner: false,
    can: (permission: AssistantPermission) =>
      hasMemberPermission(membership.role, membership.permissions, permission),
  };
}
