/**
 * Cliente genérico para qualquer provedor compatível com a API de chat da
 * OpenAI (Ollama, Groq, DeepSeek, OpenAI). Trocar de provedor é só trocar a
 * baseUrl/model/apiKey em `ai/providers/index.ts` — nenhum outro código muda.
 */
import type {
  AIChatInput,
  AIChatMessage,
  AIChatResult,
  AIProvider,
  AIToolCallRequest,
} from "@ai/core/provider";
import { AIProviderRateLimitError } from "@ai/core/provider";
import type { ToolDefinition } from "@ai/types";

export interface OpenAiCompatibleConfig {
  name: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
}

interface OpenAiToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface OpenAiChatCompletionResponse {
  choices?: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: OpenAiToolCall[];
    };
    finish_reason: string;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

function toOpenAiTools(tools: ToolDefinition<unknown, unknown>[]) {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

function toOpenAiMessages(messages: AIChatMessage[]) {
  return messages.map((m) => {
    if (m.role === "tool") {
      return { role: "tool" as const, content: m.content, tool_call_id: m.toolCallId, name: m.toolName };
    }
    if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
      return {
        role: "assistant" as const,
        content: m.content || null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        })),
      };
    }
    return { role: m.role, content: m.content };
  });
}

function safeParseJsonObject(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function toFinishReason(value: string): AIChatResult["finishReason"] {
  if (value === "tool_calls") return "tool_calls";
  if (value === "length") return "length";
  return "stop";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Extrai o tempo de espera sugerido (em ms) de um 429, seja do header `Retry-After` ou do texto do erro (ex.: Groq: "Please try again in 2.205s"). */
function parseRetryDelayMs(res: Response, bodyText: string): number {
  const headerValue = res.headers.get("retry-after");
  if (headerValue) {
    const headerSeconds = Number(headerValue);
    if (Number.isFinite(headerSeconds) && headerSeconds > 0) return headerSeconds * 1000;
  }
  const match = bodyText.match(/try again in ([\d.]+)s/i);
  if (match) {
    const seconds = Number(match[1]);
    if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  }
  return 1500;
}

const MAX_RATE_LIMIT_RETRIES = 2;

export function createOpenAiCompatibleProvider(config: OpenAiCompatibleConfig): AIProvider {
  return {
    name: config.name,
    async chat({ messages, tools }: AIChatInput): Promise<AIChatResult> {
      const body = JSON.stringify({
        model: config.model,
        messages: toOpenAiMessages(messages),
        tools: tools.length > 0 ? toOpenAiTools(tools) : undefined,
      });

      let res: Response;
      let attempt = 0;
      for (;;) {
        res = await fetch(`${config.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
          },
          body,
        });

        if (res.status !== 429 || attempt >= MAX_RATE_LIMIT_RETRIES) break;

        const text = await res.text().catch(() => "");
        const delayMs = parseRetryDelayMs(res, text);
        console.warn(`[ai/provider] ${config.name} respondeu 429, tentando de novo em ${delayMs}ms (tentativa ${attempt + 1}/${MAX_RATE_LIMIT_RETRIES})`);
        await sleep(delayMs);
        attempt += 1;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        if (res.status === 429) {
          throw new AIProviderRateLimitError(config.name);
        }
        throw new Error(`Provedor de IA "${config.name}" respondeu ${res.status}: ${text.slice(0, 300)}`);
      }

      const json = (await res.json()) as OpenAiChatCompletionResponse;
      const choice = json.choices?.[0];
      if (!choice) {
        throw new Error(`Provedor de IA "${config.name}" não retornou nenhuma resposta.`);
      }

      const toolCalls: AIToolCallRequest[] | undefined = choice.message.tool_calls?.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: safeParseJsonObject(tc.function.arguments),
      }));

      return {
        message: { role: "assistant", content: choice.message.content ?? "" },
        toolCalls,
        finishReason: toFinishReason(choice.finish_reason),
        usage: {
          inputTokens: json.usage?.prompt_tokens,
          outputTokens: json.usage?.completion_tokens,
        },
      };
    },
  };
}
