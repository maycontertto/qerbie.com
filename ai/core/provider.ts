/**
 * Abstração de provedor de IA. O restante do Qerbie conhece apenas esta
 * interface — nunca Ollama, OpenAI ou qualquer SDK específico diretamente.
 *
 * Implementações concretas (Sprint 2+): ai/providers/ollama.ts, ai/providers/openai.ts.
 */
import type { ToolDefinition } from "@ai/types";

export type AIChatRole = "system" | "user" | "assistant" | "tool";

export interface AIChatMessage {
  role: AIChatRole;
  content: string;
  /** Presente quando `role === "tool"`: nome da ferramenta que gerou o conteúdo. */
  toolName?: string;
  /** Presente quando `role === "tool"`: id da chamada de ferramenta correspondente. */
  toolCallId?: string;
  /** Presente quando `role === "assistant"` pediu chamadas de ferramenta nesta resposta. */
  toolCalls?: AIToolCallRequest[];
}

export interface AIToolCallRequest {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export type AIFinishReason = "stop" | "tool_calls" | "length" | "error";

export interface AIChatResult {
  message: AIChatMessage;
  toolCalls?: AIToolCallRequest[];
  finishReason: AIFinishReason;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface AIChatInput {
  messages: AIChatMessage[];
  tools: ToolDefinition<unknown, unknown>[];
}

export interface AIProvider {
  /** Identificador curto do provedor, usado em logs de observabilidade (ex.: "ollama", "openai"). */
  readonly name: string;
  chat(input: AIChatInput): Promise<AIChatResult>;
}
