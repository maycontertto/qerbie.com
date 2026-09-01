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

export function createOpenAiCompatibleProvider(config: OpenAiCompatibleConfig): AIProvider {
  return {
    name: config.name,
    async chat({ messages, tools }: AIChatInput): Promise<AIChatResult> {
      const res = await fetch(`${config.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: config.model,
          messages: toOpenAiMessages(messages),
          tools: tools.length > 0 ? toOpenAiTools(tools) : undefined,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
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
