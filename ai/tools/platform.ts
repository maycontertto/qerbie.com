/**
 * Ferramenta de ajuda/onboarding sobre o próprio Qerbie (não sobre o dado
 * real do negócio). Cobre perguntas do tipo "o que essa plataforma faz pela
 * minha academia?" ou "onde eu cadastro meus alunos?" — comuns logo depois
 * que alguém cria conta e ainda está se situando no painel.
 *
 * Usa a mesma fonte que gera a navegação real do dashboard
 * (src/lib/merchant/dashboardModules.ts), para nunca inventar um recurso
 * que não existe para aquele segmento de negócio.
 */
import type { AssistantContext, ToolDefinition } from "@ai/types";
import { getDashboardModules, type DashboardCardModel } from "@/lib/merchant/dashboardModules";
import { BUSINESS_CATEGORIES } from "@/lib/merchant/businessCategories";

interface PlatformHelpArgs {
  topic?: string;
}

interface PlatformModuleInfo {
  title: string;
  description: string;
  status: string;
  href: string | null;
}

interface PlatformHelpData {
  businessSegment: string | null;
  headerNudge: string;
  catalogo: PlatformModuleInfo[];
  atendimento: PlatformModuleInfo[];
  vendas: PlatformModuleInfo[];
}

function toModuleInfo(cards: DashboardCardModel[]): PlatformModuleInfo[] {
  return cards.map((card) => ({
    title: card.title,
    description: card.description,
    status: card.hint,
    href: card.href ?? null,
  }));
}

export const getPlatformHelpTool: ToolDefinition<PlatformHelpArgs, PlatformHelpData> = {
  name: "get_platform_help",
  description:
    "Explica o que o Qerbie oferece para o segmento deste estabelecimento (ex.: 'o que essa plataforma faz pela minha academia?', 'onde eu cadastro meus alunos/clientes?', 'o que já dá pra usar e o que ainda está por vir?'). Use para perguntas sobre o PRÓPRIO QERBIE e seus recursos/navegação — nunca para perguntas sobre dados reais do negócio (vendas, clientes, agenda), que usam outras ferramentas.",
  requiredPermission: "dashboard_access",
  kind: "read",
  parameters: {
    type: "object",
    properties: {
      topic: {
        type: "string",
        description:
          "Opcional: assunto específico que o usuário perguntou (ex.: catálogo, vendas, atendimento), só para contexto — a ferramenta sempre retorna todos os módulos do segmento.",
      },
    },
  },
  async run(ctx: AssistantContext) {
    const modules = getDashboardModules(ctx.businessCategory);
    const businessSegment =
      BUSINESS_CATEGORIES.find((c) => c.key === ctx.businessCategory)?.label ?? ctx.businessCategory;

    return {
      ok: true,
      data: {
        businessSegment,
        headerNudge: modules.headerNudge,
        catalogo: toModuleInfo(modules.sections.catalogo ?? []),
        atendimento: toModuleInfo(modules.sections.atendimento ?? []),
        vendas: toModuleInfo(modules.sections.vendas ?? []),
      },
    };
  },
};
