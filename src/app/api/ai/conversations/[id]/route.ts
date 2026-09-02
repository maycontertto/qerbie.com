import { NextResponse } from "next/server";
import { buildAssistantContext } from "@ai/core/context";

const MAX_MESSAGES = 100;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await buildAssistantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: conversation } = await ctx.supabase
    .from("ai_conversations")
    .select("id")
    .eq("id", id)
    .eq("merchant_id", ctx.merchantId)
    .maybeSingle();
  if (!conversation) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data, error } = await ctx.supabase
    .from("ai_messages")
    .select("role, content, created_at")
    .eq("conversation_id", id)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: true })
    .limit(MAX_MESSAGES);

  if (error) {
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }

  return NextResponse.json({ conversationId: id, messages: data ?? [] });
}
