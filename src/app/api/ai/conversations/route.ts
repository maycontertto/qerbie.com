import { NextResponse } from "next/server";
import { buildAssistantContext } from "@ai/core/context";

const MAX_CONVERSATIONS = 30;

export async function GET() {
  const ctx = await buildAssistantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await ctx.supabase
    .from("ai_conversations")
    .select("id, title, created_at, updated_at")
    .eq("merchant_id", ctx.merchantId)
    .order("updated_at", { ascending: false })
    .limit(MAX_CONVERSATIONS);

  if (error) {
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }

  return NextResponse.json({ conversations: data ?? [] });
}
