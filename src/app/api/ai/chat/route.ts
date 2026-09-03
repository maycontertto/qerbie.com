import { NextResponse } from "next/server";
import { buildAssistantContext } from "@ai/core/context";
import { buildSystemPrompt } from "@ai/core/prompt";
import { toolRegistry } from "@ai/core/registry";
import { getConfiguredProvider } from "@ai/providers";
import { registerAllTools } from "@ai/tools";
import { AIProviderRateLimitError } from "@ai/core/provider";
import type { AIChatMessage, AIToolCallRequest } from "@ai/core/provider";
import type { AssistantContext } from "@ai/types";

const MAX_TOOL_ITERATIONS = 4;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY_MESSAGES = 30;

interface ChatRequestBody {
  conversationId?: string;
  message?: string;
}

export async function POST(req: Request) {
  const ctx = await buildAssistantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: ChatRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const userMessage = (body.message ?? "").trim();
  if (!userMessage) {
    return NextResponse.json({ error: "empty_message" }, { status: 400 });
  }
  if (userMessage.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: "message_too_long" }, { status: 400 });
  }

  registerAllTools();

  let conversationId = body.conversationId;
  if (conversationId) {
    const { data: existing } = await ctx.supabase
      .from("ai_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("merchant_id", ctx.merchantId)
      .maybeSingle();
    if (!existing) conversationId = undefined;
  }

  if (!conversationId) {
    const { data: created, error: createError } = await ctx.supabase
      .from("ai_conversations")
      .insert({ merchant_id: ctx.merchantId, user_id: ctx.userId, title: userMessage.slice(0, 80) })
      .select("id")
      .single();
    if (createError || !created) {
      return NextResponse.json({ error: "conversation_create_failed" }, { status: 500 });
    }
    conversationId = created.id;
  }

  const { data: history } = await ctx.supabase
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(MAX_HISTORY_MESSAGES);

  await ctx.supabase.from("ai_messages").insert({
    conversation_id: conversationId,
    merchant_id: ctx.merchantId,
    role: "user",
    content: userMessage,
  });

  let provider;
  try {
    provider = getConfiguredProvider();
  } catch (error) {
    return NextResponse.json(
      { conversationId, error: error instanceof Error ? error.message : "provider_not_configured" },
      { status: 503 },
    );
  }

  const tools = toolRegistry.listAvailable(ctx);
  const messages: AIChatMessage[] = [
    { role: "system", content: buildSystemPrompt(ctx) },
    ...(history ?? [])
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: userMessage },
  ];

  const startedAt = Date.now();
  let finalContent = "";
  let lastError: string | null = null;
  let isRateLimit = false;

  try {
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const result = await provider.chat({ messages, tools });

      if (result.finishReason === "tool_calls" && result.toolCalls && result.toolCalls.length > 0) {
        messages.push({ role: "assistant", content: result.message.content, toolCalls: result.toolCalls });

        // Se o modelo pedir uma ferramenta de escrita, a rodada para aqui: nenhuma
        // ferramenta é executada (nem as de leitura que vieram junto na mesma
        // chamada) até o usuário confirmar explicitamente a ação proposta.
        const writeCalls = result.toolCalls.filter((call) => toolRegistry.get(call.name)?.kind === "write");
        const writeCall = writeCalls[0];

        if (writeCall) {
          // O modelo às vezes pede várias ações de escrita na mesma resposta (ex.: "agende 3
          // horários"), mas só a primeira é proposta agora — as demais são descartadas aqui e
          // NUNCA acontecem sozinhas depois. Avisamos o usuário para não passar a impressão de
          // que todas foram entendidas/serão feitas.
          const extraWriteCallsCount = writeCalls.length - 1;
          const pendingActionResponse = await proposeWriteAction({
            ctx,
            conversationId,
            providerName: provider.name,
            call: writeCall,
            extraWriteCallsCount,
          });
          return pendingActionResponse;
        }

        for (const call of result.toolCalls) {
          const toolStartedAt = Date.now();
          const toolResult = await toolRegistry.execute(call.name, ctx, call.arguments);

          await ctx.supabase.from("ai_usage_logs").insert({
            merchant_id: ctx.merchantId,
            user_id: ctx.userId,
            conversation_id: conversationId,
            provider: provider.name,
            tool_name: call.name,
            status: toolResult.ok ? "ok" : "error",
            error_message: toolResult.ok ? null : (toolResult.error ?? null),
            latency_ms: Date.now() - toolStartedAt,
          });

          messages.push({
            role: "tool",
            toolName: call.name,
            toolCallId: call.id,
            content: JSON.stringify(toolResult),
          });
        }
        continue;
      }

      finalContent = result.message.content;
      break;
    }
  } catch (error) {
    isRateLimit = error instanceof AIProviderRateLimitError;
    lastError = error instanceof Error ? error.message : "Erro desconhecido ao consultar a IA.";
    console.error("[ai/chat] falha ao consultar o provedor de IA:", lastError);
  }

  await ctx.supabase.from("ai_usage_logs").insert({
    merchant_id: ctx.merchantId,
    user_id: ctx.userId,
    conversation_id: conversationId,
    provider: provider.name,
    status: lastError ? "error" : "ok",
    error_message: lastError,
    latency_ms: Date.now() - startedAt,
  });

  if (lastError) {
    const reply = isRateLimit
      ? "O assistente recebeu muitas mensagens nos últimos instantes. Aguarde alguns segundos e tente de novo."
      : "Não consegui falar com o assistente agora. Tente novamente em instantes.";
    return NextResponse.json({ conversationId, error: lastError, reply }, { status: 502 });
  }

  if (!finalContent.trim()) {
    finalContent = "Não consegui gerar uma resposta agora. Tente novamente em instantes.";
  }

  await ctx.supabase.from("ai_messages").insert({
    conversation_id: conversationId,
    merchant_id: ctx.merchantId,
    role: "assistant",
    content: finalContent,
  });

  // Traz a conversa pro topo da lista de histórico (mensagens não disparam o trigger sozinhas).
  await ctx.supabase
    .from("ai_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  return NextResponse.json({ conversationId, reply: finalContent });
}

interface ProposeWriteActionInput {
  ctx: AssistantContext;
  conversationId: string;
  providerName: string;
  call: AIToolCallRequest;
  /** Quantas outras ações de escrita pedidas na mesma resposta do modelo foram descartadas (não propostas agora). */
  extraWriteCallsCount: number;
}

/**
 * Registra uma proposta de ferramenta `kind: "write"` em `ai_pending_actions`
 * e devolve o preview ao cliente — NUNCA executa a ferramenta aqui. A execução
 * real só acontece em /api/ai/actions/[id]/confirm, relendo os argumentos
 * gravados nesta tabela (nunca os que o cliente reenviar).
 */
async function proposeWriteAction({
  ctx,
  conversationId,
  providerName,
  call,
  extraWriteCallsCount,
}: ProposeWriteActionInput): Promise<NextResponse> {
  const tool = toolRegistry.get(call.name);

  const replyWithoutProposal = async (message: string) => {
    await ctx.supabase.from("ai_messages").insert({
      conversation_id: conversationId,
      merchant_id: ctx.merchantId,
      role: "assistant",
      content: message,
    });
    await ctx.supabase
      .from("ai_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);
    return NextResponse.json({ conversationId, reply: message });
  };

  if (!tool || tool.kind !== "write") {
    return replyWithoutProposal("Essa ação ainda não está disponível pelo assistente.");
  }

  if (tool.requiredPermission !== null && !ctx.can(tool.requiredPermission)) {
    return replyWithoutProposal("Você não tem permissão para propor essa ação.");
  }

  if (typeof tool.buildPreview !== "function") {
    console.error(`[ai/chat] ferramenta de escrita "${tool.name}" sem buildPreview configurado.`);
    return replyWithoutProposal("Essa ação ainda não está disponível pelo assistente.");
  }

  let previewText: string;
  try {
    previewText = await tool.buildPreview(ctx, call.arguments);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Não consegui montar a prévia dessa ação. Tente novamente.";
    console.error(`[ai/chat] falha ao montar prévia da ação "${tool.name}":`, error);
    return replyWithoutProposal(message);
  }

  if (extraWriteCallsCount > 0) {
    previewText += ` (Você pediu mais de uma ação nessa mensagem — vamos confirmar uma de cada vez; me diga o que fazer em seguida depois desta.)`;
  }

  const { data: pending, error: pendingError } = await ctx.supabase
    .from("ai_pending_actions")
    .insert({
      merchant_id: ctx.merchantId,
      user_id: ctx.userId,
      conversation_id: conversationId,
      tool_name: tool.name,
      arguments: call.arguments,
      preview_text: previewText,
    })
    .select("id, preview_text")
    .single();

  if (pendingError || !pending) {
    console.error("[ai/chat] falha ao gravar ai_pending_actions:", pendingError);
    return replyWithoutProposal("Não consegui preparar essa ação para confirmação. Tente novamente.");
  }

  await ctx.supabase.from("ai_messages").insert({
    conversation_id: conversationId,
    merchant_id: ctx.merchantId,
    role: "assistant",
    content: pending.preview_text,
  });

  await ctx.supabase.from("ai_usage_logs").insert({
    merchant_id: ctx.merchantId,
    user_id: ctx.userId,
    conversation_id: conversationId,
    provider: providerName,
    tool_name: tool.name,
    status: "ok",
  });

  await ctx.supabase
    .from("ai_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  return NextResponse.json({
    conversationId,
    pendingAction: { id: pending.id, previewText: pending.preview_text },
  });
}
