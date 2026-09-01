# Qerbie AI — Assistente de Inteligência Artificial

Assistente operacional integrado ao dashboard do Qerbie. Não é um chatbot
genérico: ele responde perguntas sobre o negócio do lojista consultando os
dados reais (vendas, estoque, agenda, clientes) através de **ferramentas
controladas** — nunca recebendo o banco de dados inteiro nem executando SQL
livre.

## Princípios de segurança (não negociáveis)

1. **Multi-tenant sempre pelo servidor.** O `merchantId` de cada consulta vem
   de `buildAssistantContext()`, que resolve a sessão via Supabase Auth. Ele
   nunca vem de um argumento da ferramenta, do corpo da requisição ou de algo
   que o modelo de IA "decida" enviar.
2. **Ferramentas, não SQL livre.** A IA só pode chamar as funções registradas
   em `ai/tools/*`, cada uma com uma consulta Supabase fixa e parametrizada.
3. **Permissões reaproveitadas.** Cada ferramenta declara `requiredPermission`
   usando as mesmas chaves de `src/lib/auth/guard.ts`
   (`dashboard_access`, `dashboard_sales`, `dashboard_products`, etc.). O
   `ToolRegistry.execute()` valida a permissão antes de rodar qualquer coisa.
4. **Provedor de IA é uma abstração.** Nenhum módulo fora de `ai/providers/`
   importa um SDK de IA específico. O resto do app conhece apenas a interface
   `AIProvider` (`ai/core/provider.ts`).

## Estrutura de pastas

```
ai/
  core/
    context.ts    — buildAssistantContext() (sessão → AssistantContext)
    registry.ts   — ToolRegistry (registro, listagem por permissão, execução)
    provider.ts   — interface AIProvider (sem implementação concreta ainda)
  providers/
    index.ts      — getConfiguredProvider() (Sprint 2+)
  tools/
    sales.ts       — get_sales_summary, get_top_products
    inventory.ts   — get_low_stock
    agenda.ts      — get_appointments_today
    index.ts       — registerAllTools()
  types/
    index.ts       — tipos compartilhados (AssistantContext, ToolDefinition, ...)
```

## Como adicionar uma nova ferramenta

1. Crie o arquivo em `ai/tools/<area>.ts` seguindo o padrão de `sales.ts`:
   um objeto `ToolDefinition` com `name`, `description`, `requiredPermission`,
   `parameters` (JSON-schema simplificado) e `run(ctx, args)`.
2. `run()` **sempre** filtra as consultas por `ctx.merchantId` — nunca por um
   id vindo de `args`.
3. Registre a ferramenta em `ai/tools/index.ts` via `toolRegistry.register(...)`.
4. Se a ferramenta expõe um dado sensível novo, confirme se a permissão
   (`requiredPermission`) é a correta antes de liberar.

## Estado atual (Sprint 1)

Somente fundação + ferramentas de leitura. Não há provedor de IA plugado
ainda — `getConfiguredProvider()` lança um erro explícito até a decisão de
hospedagem (Ollama próprio vs. API externa) ser tomada. Ver
`ai/IMPLEMENTATION_PROGRESS.md` para o roadmap completo e decisões pendentes.
