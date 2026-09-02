/**
 * Confirma e EXECUTA uma ação de escrita proposta pela IA. Nunca aceita
 * argumentos do corpo da requisição — sempre reexecuta com os `arguments`
 * gravados em `ai_pending_actions` no momento da proposta (ver
 * src/app/api/ai/chat/route.ts → proposeWriteAction).
 */
import { NextResponse } from "next/server";
import { buildAssistantContext } from "@ai/core/context";
import { fetchPendingAction } from "@ai/core/pendingActions";
import { toolRegistry } from "@ai/core/registry";
import { registerAllTools } from "@ai/tools";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await buildAssistantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  registerAllTools();

  const { id } = await params;
  const lookup = await fetchPendingAction(ctx, id);
  if (!lookup.ok) {
    return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  }

  const { action } = lookup;
  const tool = toolRegistry.get(action.tool_name);

  if (!tool || tool.kind !== "write") {
    await ctx.supabase
      .from("ai_pending_actions")
      .update({
        status: "failed",
        error_message: "Ferramenta indisponível no momento da confirmação.",
        resolved_at: new Date().toISOString(),
        resolved_by_user_id: ctx.userId,
      })
      .eq("id", id);
    return NextResponse.json(
      { ok: false, error: "Ferramenta indisponível no momento da confirmação." },
      { status: 409 },
    );
  }

  const startedAt = Date.now();
  // toolRegistry.execute() reexecuta a checagem de permissão agora — a permissão
  // do usuário pode ter mudado desde que a ação foi proposta.
  const toolResult = await toolRegistry.execute(action.tool_name, ctx, action.arguments);

  await ctx.supabase.from("ai_usage_logs").insert({
    merchant_id: ctx.merchantId,
    user_id: ctx.userId,
    conversation_id: action.conversation_id,
    tool_name: action.tool_name,
    status: toolResult.ok ? "ok" : "error",
    error_message: toolResult.ok ? null : (toolResult.error ?? null),
    latency_ms: Date.now() - startedAt,
  });

  await ctx.supabase
    .from("ai_pending_actions")
    .update({
      status: toolResult.ok ? "executed" : "failed",
      result: toolResult.ok ? (toolResult.data ?? null) : null,
      error_message: toolResult.ok ? null : (toolResult.error ?? "Falha desconhecida ao executar a ação."),
      resolved_at: new Date().toISOString(),
      resolved_by_user_id: ctx.userId,
    })
    .eq("id", id);

  const confirmationMessage = toolResult.ok
    ? `✅ Ação executada: ${action.preview_text}`
    : `❌ Não foi possível executar: ${toolResult.error ?? "erro desconhecido"}`;

  if (action.conversation_id) {
    await ctx.supabase.from("ai_messages").insert({
      conversation_id: action.conversation_id,
      merchant_id: ctx.merchantId,
      role: "assistant",
      content: confirmationMessage,
    });
    await ctx.supabase
      .from("ai_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", action.conversation_id);
  }

  return NextResponse.json({
    ok: toolResult.ok,
    status: toolResult.ok ? "executed" : "failed",
    data: toolResult.ok ? toolResult.data : undefined,
    error: toolResult.ok ? undefined : toolResult.error,
  });
}
