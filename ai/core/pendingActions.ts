/**
 * Leitura segura de `ai_pending_actions` para os endpoints de confirmação.
 * Sempre filtra por merchant_id + user_id da sessão (nunca por parâmetro),
 * e nunca retorna uma ação já resolvida ou expirada como se ainda valesse.
 */
import type { AssistantContext } from "@ai/types";
import type { Row } from "@/lib/supabase/database.types";

export type PendingActionRow = Row<"ai_pending_actions">;

export type PendingActionLookup =
  | { ok: true; action: PendingActionRow }
  | { ok: false; status: 404 | 410; error: string };

export async function fetchPendingAction(ctx: AssistantContext, id: string): Promise<PendingActionLookup> {
  const { data: action } = await ctx.supabase
    .from("ai_pending_actions")
    .select("*")
    .eq("id", id)
    .eq("merchant_id", ctx.merchantId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (!action || action.status !== "pending") {
    return { ok: false, status: 404, error: "Ação não encontrada ou já resolvida." };
  }

  if (new Date(action.expires_at).getTime() < Date.now()) {
    await ctx.supabase
      .from("ai_pending_actions")
      .update({ status: "expired", resolved_at: new Date().toISOString(), resolved_by_user_id: ctx.userId })
      .eq("id", id);
    return { ok: false, status: 410, error: "Essa ação expirou. Peça ao assistente novamente." };
  }

  return { ok: true, action };
}
