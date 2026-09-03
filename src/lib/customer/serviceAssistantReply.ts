import { createClient } from "@/lib/supabase/server";
import { getConfiguredProvider } from "@ai/providers";
import { AIProviderRateLimitError } from "@ai/core/provider";
import type { AIChatMessage } from "@ai/core/provider";
import { SERVICE_VERTICALS, type ServiceVerticalKey } from "@/lib/customer/serviceVerticals";

const MAX_MESSAGE_LENGTH = 500;
const MAX_HISTORY_MESSAGES = 8;

export interface ServiceAssistantReplyResult {
  reply: string;
  status: number;
}

function formatBRLFromCents(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((cents ?? 0) / 100);
}

/**
 * Núcleo compartilhado do assistente de autoatendimento das verticais de
 * serviço (barbearia/estética/academia/lava-jato/pet/salão) — resolve qrToken ->
 * merchant com o MESMO client/header usado nas páginas humanas dessas
 * verticais (sem admin client, sem tool-calling), busca os serviços reais
 * ativos e injeta como texto no system prompt. Nunca inventa serviço fora
 * da lista, nunca marca/agenda nada (só orienta a usar fila/agenda reais).
 */
export async function getServiceAssistantReply(params: {
  vertical: ServiceVerticalKey;
  qrToken: string;
  message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<ServiceAssistantReplyResult> {
  const config = SERVICE_VERTICALS[params.vertical];
  const supabase = await createClient({ [config.qrHeaderName]: params.qrToken });

  // Todas as tabelas de QR das verticais têm o mesmo formato; o cast pra uma
  // literal representativa preserva a tipagem do supabase-js com tabela dinâmica.
  const { data: token } = await supabase
    .from(config.qrTokenTable as "barbershop_qr_tokens")
    .select("merchant_id")
    .eq("qr_token", params.qrToken)
    .eq("is_active", true)
    .maybeSingle();

  if (!token) {
    return { reply: "QR inválido.", status: 404 };
  }

  const { data: merchant } = await supabase
    .from("merchants")
    .select("name")
    .eq("id", token.merchant_id)
    .maybeSingle();

  if (!merchant) {
    return { reply: "QR inválido.", status: 404 };
  }

  const message = params.message.trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!message) {
    return { reply: "Mensagem vazia.", status: 400 };
  }

  type ServiceLine = {
    name: string;
    price_cents: number;
    description?: string | null;
    duration_min?: number | null;
  };

  let services: ServiceLine[] = [];
  if (params.vertical === "g") {
    const { data } = await supabase
      .from("gym_additional_services")
      .select("name, price_cents")
      .eq("merchant_id", token.merchant_id)
      .eq("is_active", true)
      .limit(60);
    services = data ?? [];
  } else {
    const { data } = await supabase
      .from(config.servicesTable as "barbershop_services")
      .select("name, description, price_cents, duration_min")
      .eq("merchant_id", token.merchant_id)
      .eq("is_active", true)
      .limit(60);
    services = data ?? [];
  }

  // Academia: planos são a informação principal (RLS já permite select anon de planos ativos).
  let plansText = "";
  if (params.vertical === "g") {
    const { data: plans } = await supabase
      .from("gym_plans")
      .select("name, price_cents, billing_period_months")
      .eq("merchant_id", token.merchant_id)
      .eq("is_active", true)
      .order("price_cents", { ascending: true })
      .limit(50);
    plansText = (plans ?? [])
      .map((p) => {
        const months = Number(p.billing_period_months ?? 1);
        const period = months === 1 ? "mensal" : `a cada ${months} meses`;
        return `- ${p.name} (${formatBRLFromCents(p.price_cents)}, ${period})`;
      })
      .join("\n");
  }

  const servicesText = services
    .map((s) => {
      const price = typeof s.duration_min === "number"
        ? ` (${formatBRLFromCents(s.price_cents)}, ~${s.duration_min}min)`
        : ` (${formatBRLFromCents(s.price_cents)})`;
      const description = s.description ? `: ${s.description}` : "";
      return `- ${s.name}${price}${description}`;
    })
    .join("\n");

  const guidanceLine = params.vertical === "g"
    ? "Você não consegue fazer check-in, matrícula, trocar plano nem cobrar nada — só explicar os planos e serviços e ajudar o aluno a escolher; para se matricular, fazer check-in ou trocar de plano, oriente a usar as opções da própria página do QR."
    : "Você não consegue marcar horário, entrar na fila nem cobrar nada — só explicar os serviços e ajudar o cliente a escolher; para agendar de verdade, oriente a usar os botões \"Entrar na fila\"/\"Agendar horário\" da própria página.";

  const systemPrompt = [
    `Você é o assistente de autoatendimento de "${merchant.name}" (${config.label}) no Qerbie.`,
    "Responda em português do Brasil. Seja curto e simpático.",
    "Você só pode falar sobre os serviços DESTE estabelecimento — nunca invente serviço fora da lista abaixo, nunca fale de outro estabelecimento, nunca dê informação financeira do lojista (faturamento, custos, margem).",
    guidanceLine,
    ...(params.vertical === "g"
      ? ["Planos ativos:", plansText || "(nenhum plano cadastrado no momento)", "Serviços adicionais ativos:"]
      : ["Serviços ativos:"]),
    servicesText || "(nenhum serviço cadastrado no momento)",
  ].join("\n");

  const history: AIChatMessage[] = (params.history ?? [])
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, MAX_MESSAGE_LENGTH) }));

  const messages: AIChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: message },
  ];

  let provider;
  try {
    provider = getConfiguredProvider();
  } catch {
    return { reply: "O assistente não está disponível agora.", status: 502 };
  }

  try {
    const result = await provider.chat({ messages, tools: [] });
    return { reply: result.message.content, status: 200 };
  } catch (error) {
    const isRateLimit = error instanceof AIProviderRateLimitError;
    console.error("[service-assistant] falha ao consultar o provedor de IA:", error);
    return {
      reply: isRateLimit
        ? "O assistente recebeu muitas perguntas agora. Tente de novo em alguns segundos."
        : "Não consegui responder agora. Tente novamente em instantes.",
      status: 502,
    };
  }
}
