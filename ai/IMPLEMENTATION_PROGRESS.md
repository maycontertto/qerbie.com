# Qerbie AI — Progresso de implementação

Documento vivo. Atualizar a cada sprint concluído.

## Sprint 0 — Análise e plano (concluído)

- Mapeamento completo do schema relevante (merchants, products/estoque,
  orders/order_items, agenda, filas/profissionais, clientes).
- Plano de arquitetura de 10 seções apresentado e aprovado pelo lojista.
- Decisão bloqueante identificada: Vercel é serverless e não hospeda Ollama
  diretamente — ver "Decisões pendentes" abaixo.

## Sprint 1 — Fundação (concluído)

- [x] Migration `integrations/supabase/schema/051_ai_assistant.sql`:
      `ai_conversations`, `ai_messages`, `ai_usage_logs`.
- [x] RLS dedicada `integrations/supabase/rls/ai_assistant.rls.sql`
      (mesmo padrão de `has_merchant_access` / `is_merchant_owner` já usado
      no restante do projeto).
- [x] Tipos manuais adicionados em `src/lib/supabase/database.types.ts`
      para as 3 tabelas novas (seguindo o padrão hand-maintained existente).
- [x] `ai/types/index.ts` — `AssistantContext`, `ToolDefinition`, `ToolResult`,
      `AssistantPermission`, `AssistantMessage`.
- [x] `ai/core/context.ts` — `buildAssistantContext()`.
- [x] `ai/core/registry.ts` — `ToolRegistry` (registro/listagem/execução com
      checagem de permissão).
- [x] `ai/core/provider.ts` — interface `AIProvider` (sem implementação
      concreta; ver decisão pendente do Sprint 2).
- [x] `ai/providers/index.ts` — `getConfiguredProvider()` lança erro
      explícito (nenhum provedor plugado ainda; não há resposta "fake").
- [x] 4 ferramentas de leitura, todas filtradas por `ctx.merchantId`:
  - `get_sales_summary` (`ai/tools/sales.ts`) — pedidos concluídos, período
    hoje/7d/30d, faturamento e ticket médio. Reaproveita o mesmo padrão de
    consulta de `src/app/dashboard/page.tsx`.
  - `get_top_products` (`ai/tools/sales.ts`) — produtos mais vendidos por
    quantidade, mesmo período.
  - `get_low_stock` (`ai/tools/inventory.ts`) — produtos com
    `track_stock=true` e `stock_quantity <= stock_min_quantity`. Usa a coluna
    real `products.stock_min_quantity` (introduzida em
    `040_casa_racao_comercial.sql`), não um número inventado.
  - `get_appointments_today` (`ai/tools/agenda.ts`) — agendamentos
    confirmados/pendentes do dia, com profissional (`merchant_queues.name`)
    e cliente.
- [x] Path alias `@ai/*` adicionado em `tsconfig.json`.
- [x] Validado com `get_errors` (sem erros de tipo). Pendente: rodar
      `npx eslint` e `npm run build` antes de considerar 100% fechado.

### Descobertas registradas durante o Sprint 1

- Existe uma tabela `public.merchant_customers` (nome, telefone, notas, tags)
  criada em `040_casa_racao_comercial.sql`, com `orders.customer_id`
  referenciando-a. **Porém nenhuma tela do dashboard grava nela hoje**
  (`grep` em `src/` não encontrou nenhuma referência) — é uma tabela
  dormente. Por isso a ferramenta `get_customers` **não foi criada** neste
  sprint: ela sempre retornaria vazio e confundiria o lojista. Avaliar em um
  sprint futuro se vale a pena popular essa tabela no fluxo de caixa antes
  de expor uma ferramenta de IA sobre ela.
- Não existe tabela central de clientes para a maioria dos verticais (padrão
  de `session_token` anônimo); só Academias (`gym_students`) tem login real.

## Sprint 2 — Provider + wiring (bloqueado)

**Decisão pendente do lojista (repetindo o que já foi perguntado no plano do
Sprint 0):** a Vercel é serverless (sem GPU/processo persistente), então não
dá para rodar Ollama dentro do próprio deploy do Qerbie. Escolher uma opção
antes de iniciar este sprint:

1. Hospedar um servidor Ollama próprio, acessível via HTTPS (custo de
   infraestrutura + manutenção).
2. Usar uma API externa paga (ex.: Groq, DeepSeek, OpenAI) como provedor
   principal desde já.
3. Deixar a IA "desligada" (ferramentas prontas, sem provedor) até decidir.

Enquanto não houver resposta, **não criar** `ai/providers/ollama.ts`,
`ai/providers/openai.ts` nem `src/app/api/ai/chat/route.ts`.

## Sprint 3+ (planejado, não iniciado)

- `/api/ai/chat` (Node runtime) usando `getConfiguredProvider()` +
  `toolRegistry` + persistência em `ai_conversations`/`ai_messages`.
- Registro de uso/custo em `ai_usage_logs`.
- Painel de UI no dashboard (`src/components/ai/AssistantPanel.tsx` ou
  similar).
- Ferramentas de escrita (com confirmação explícita do usuário antes de
  executar qualquer ação que altere dados).
