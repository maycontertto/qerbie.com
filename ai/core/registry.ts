/**
 * Registro central de ferramentas do Qerbie AI. Nenhuma ferramenta é chamada
 * diretamente pelo provedor de IA — tudo passa pelo `execute()` daqui, que
 * valida permissão antes de rodar a consulta real no Supabase.
 */
import type { AssistantContext, ToolDefinition, ToolResult } from "@ai/types";
import { isModuleEnabledForCategory } from "@ai/core/moduleAvailability";

class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition<unknown, unknown>>();

  register<TArgs, TData>(tool: ToolDefinition<TArgs, TData>): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Ferramenta de IA duplicada: "${tool.name}" já foi registrada.`);
    }
    this.tools.set(tool.name, tool as ToolDefinition<unknown, unknown>);
  }

  get(name: string): ToolDefinition<unknown, unknown> | undefined {
    return this.tools.get(name);
  }

  /** Lista as ferramentas que o usuário atual tem permissão de usar (para montar o function-calling da IA). */
  listAvailable(ctx: AssistantContext): ToolDefinition<unknown, unknown>[] {
    return Array.from(this.tools.values()).filter(
      (tool) =>
        (tool.requiredPermission === null || ctx.can(tool.requiredPermission)) &&
        (!tool.requiresModuleHref || isModuleEnabledForCategory(ctx.businessCategory, tool.requiresModuleHref)),
    );
  }

  async execute(name: string, ctx: AssistantContext, args: unknown): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { ok: false, error: `Ferramenta desconhecida: "${name}".` };
    }

    if (tool.requiredPermission !== null && !ctx.can(tool.requiredPermission)) {
      return { ok: false, error: "Você não tem permissão para consultar esses dados." };
    }

    if (tool.requiresModuleHref && !isModuleEnabledForCategory(ctx.businessCategory, tool.requiresModuleHref)) {
      return { ok: false, error: "Esse recurso não está disponível para o segmento deste estabelecimento." };
    }

    try {
      return (await tool.run(ctx, args)) as ToolResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido ao executar a ferramenta.";
      return { ok: false, error: message };
    }
  }
}

export const toolRegistry = new ToolRegistry();
