/**
 * Rejeita (cancela) uma ação de escrita proposta pela IA. Nunca executa
 * nada — só marca a proposta como "rejected" para auditoria.
 */
import { NextResponse } from "next/server";
import { buildAssistantContext } from "@ai/core/context";
import { fetchPendingAction } from "@ai/core/pendingActions";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await buildAssistantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const lookup = await fetchPendingAction(ctx, id);
  if (!lookup.ok) {
    return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  }

  const { action } = lookup;

  await ctx.supabase
    .from("ai_pending_actions")
    .update({
      status: "rejected",
      resolved_at: new Date().toISOString(),
      resolved_by_user_id: ctx.userId,
    })
    .eq("id", id);

  if (action.conversation_id) {
    await ctx.supabase.from("ai_messages").insert({
      conversation_id: action.conversation_id,
      merchant_id: ctx.merchantId,
      role: "assistant",
      content: "Ação cancelada. Nada foi alterado.",
    });
    await ctx.supabase
      .from("ai_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", action.conversation_id);
  }

  return NextResponse.json({ ok: true, status: "rejected" });
}
