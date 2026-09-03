import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getConfiguredProvider } from "@ai/providers";
import { AIProviderRateLimitError } from "@ai/core/provider";
import type { AIChatMessage } from "@ai/core/provider";
import { getPopularMenuItemsCore } from "@/lib/customer/popularItems";

const MAX_MESSAGE_LENGTH = 500;
const MAX_HISTORY_MESSAGES = 8;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 8;

/**
 * Limite simples de taxa em memória, por instância do processo — contém
 * abuso/custo básico (o provedor de IA tem TPM compartilhado com o painel
 * dos lojistas pagantes), mas NÃO é distribuído entre instâncias serverless
 * da Vercel (cada instância tem seu próprio contador). Ver nota em
 * ai/IMPLEMENTATION_PROGRESS.md — evoluir pra um limitador real (Supabase
 * ou KV) se o uso crescer.
 */
const requestLog = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  requestLog.set(key, timestamps);
  return timestamps.length > RATE_LIMIT_MAX_REQUESTS;
}

interface MenuAssistantRequestBody {
  message?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  lang?: string;
}

function languageInstruction(lang: string | undefined): string {
  if (lang === "en") return "Respond in English.";
  if (lang === "es") return "Responda em espanhol.";
  return "Responda em português do Brasil.";
}

export async function POST(req: Request, { params }: { params: Promise<{ qrToken: string }> }) {
  const { qrToken } = await params;
  const supabase = await createClient();

  const { data: table } = await supabase
    .from("merchant_tables")
    .select("merchant_id")
    .eq("qr_token", qrToken)
    .maybeSingle();

  if (!table) {
    return NextResponse.json({ error: "invalid_qr" }, { status: 404 });
  }

  const { data: merchant } = await supabase
    .from("merchants")
    .select("id, name")
    .eq("id", table.merchant_id)
    .maybeSingle();

  if (!merchant) {
    return NextResponse.json({ error: "invalid_qr" }, { status: 404 });
  }

  const rateLimitKey = `${merchant.id}:${req.headers.get("x-forwarded-for") ?? "unknown"}`;
  if (isRateLimited(rateLimitKey)) {
    return NextResponse.json(
      { reply: "Muitas mensagens em pouco tempo. Aguarde um instante e tente de novo." },
      { status: 429 },
    );
  }

  let body: MenuAssistantRequestBody;
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

  const [{ data: menuProducts }, popularItems] = await Promise.all([
    supabase
      .from("products")
      .select("name, description, price")
      .eq("merchant_id", merchant.id)
      .eq("is_active", true)
      .limit(60),
    getPopularMenuItemsCore(merchant.id),
  ]);

  const menuText = (menuProducts ?? [])
    .map((p) => {
      const price = p.price != null ? ` (R$ ${Number(p.price).toFixed(2)})` : "";
      const description = p.description ? `: ${p.description}` : "";
      return `- ${p.name}${price}${description}`;
    })
    .join("\n");

  const popularText = popularItems.length
    ? popularItems.map((p, i) => `${i + 1}. ${p.productName} (pedido ${p.timesOrdered}x nos últimos 30 dias)`).join("\n")
    : "Ainda não há dados suficientes de pedidos para calcular os mais pedidos.";

  const systemPrompt = [
    `Você é o assistente de autoatendimento do cardápio de "${merchant.name}" no Qerbie.`,
    languageInstruction(body.lang),
    "Seja curto e simpático.",
    "Você só pode falar sobre o cardápio e os pedidos DESTE estabelecimento — nunca invente prato que não esteja na lista abaixo, nunca fale de outro estabelecimento, nunca dê informação financeira do lojista (faturamento, custos, margem).",
    "Você não consegue fazer pedidos, alterar o carrinho nem cobrar nada — só dar sugestões e explicações; se o cliente quiser pedir de verdade, oriente a usar o cardápio normal da página.",
    "Cardápio ativo:",
    menuText || "(nenhum item cadastrado no momento)",
    "Itens mais pedidos nos últimos 30 dias (use isso para responder 'o que é mais pedido'/'o que você recomenda'):",
    popularText,
  ].join("\n");

  const history: AIChatMessage[] = (body.history ?? [])
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, MAX_MESSAGE_LENGTH) }));

  const messages: AIChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userMessage },
  ];

  let provider;
  try {
    provider = getConfiguredProvider();
  } catch {
    return NextResponse.json({ reply: "O assistente do cardápio não está disponível agora." }, { status: 502 });
  }

  try {
    const result = await provider.chat({ messages, tools: [] });
    return NextResponse.json({ reply: result.message.content });
  } catch (error) {
    const isRateLimit = error instanceof AIProviderRateLimitError;
    console.error("[menu-assistant] falha ao consultar o provedor de IA:", error);
    return NextResponse.json(
      {
        reply: isRateLimit
          ? "O assistente recebeu muitas perguntas agora. Tente de novo em alguns segundos."
          : "Não consegui responder agora. Tente novamente em instantes.",
      },
      { status: 502 },
    );
  }
}
