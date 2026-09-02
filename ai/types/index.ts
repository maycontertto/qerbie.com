/**
 * Tipos centrais do Qerbie AI. Nenhum outro módulo do Qerbie deve depender de um
 * provedor de IA específico (Ollama, OpenAI, etc.) — tudo passa por estes tipos.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/** Chaves de permissão de dashboard já existentes no Qerbie (ver src/lib/auth/guard.ts). */
export type AssistantPermission =
  | "dashboard_access"
  | "dashboard_sales"
  | "dashboard_products"
  | "dashboard_orders"
  | "dashboard_branding"
  | "dashboard_delivery"
  | "dashboard_support";

/**
 * Contexto de execução de uma ferramenta/conversa, sempre resolvido a partir da
 * sessão autenticada (nunca de um valor enviado pelo usuário ou pelo modelo de IA).
 */
export interface AssistantContext {
  supabase: SupabaseClient<Database>;
  userId: string;
  merchantId: string;
  merchantName: string;
  businessCategory: string | null;
  isOwner: boolean;
  /** Retorna true se o usuário atual pode usar uma ferramenta que exige essa permissão. */
  can(permission: AssistantPermission): boolean;
}

/** Subconjunto de JSON Schema usado para descrever os parâmetros de uma ferramenta. */
export interface ToolParameterSchema {
  type: "object";
  properties: Record<
    string,
    {
      type: "string" | "number" | "boolean";
      description: string;
      enum?: readonly string[];
    }
  >;
  required?: readonly string[];
}

export interface ToolResult<TData = unknown> {
  ok: boolean;
  data?: TData;
  error?: string;
}

/**
 * Classifica o efeito de uma ferramenta:
 * - "read": só consulta, executa direto (comportamento atual).
 * - "write": cria/altera dados reais — nunca executa sozinha, sempre passa
 *   por uma proposta + confirmação explícita do usuário antes do backend
 *   gravar algo (ver Sprint 4, Fase A).
 * - "generate": gera texto/conteúdo sem tocar dado do lojista (ex.: rascunho
 *   de mensagem) — não precisa de confirmação de escrita, mas também não
 *   persiste nada sozinha.
 */
export type ToolKind = "read" | "write" | "generate";

/**
 * Uma ferramenta é a única forma da IA "tocar" nos dados do Qerbie.
 * Ela nunca recebe SQL livre nem o merchant_id do modelo — apenas os argumentos
 * declarados em `parameters`, e o `AssistantContext` resolvido pela sessão.
 */
export interface ToolDefinition<TArgs = Record<string, never>, TData = unknown> {
  name: string;
  description: string;
  /** Permissão de dashboard exigida para chamar a ferramenta. `null` = qualquer usuário com acesso ao painel. */
  requiredPermission: AssistantPermission | null;
  /** Ver `ToolKind`. Toda ferramenta nova precisa declarar isso explicitamente. */
  kind: ToolKind;
  parameters: ToolParameterSchema;
  run(ctx: AssistantContext, args: TArgs): Promise<ToolResult<TData>>;
}

export type AssistantRole = "user" | "assistant" | "tool" | "system";

export interface AssistantMessage {
  role: AssistantRole;
  content: string;
  toolName?: string;
  createdAt?: string;
}
