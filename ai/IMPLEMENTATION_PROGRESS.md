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

## Sprint 2 — Provider + wiring (concluído)

**Decisão do lojista:** Ollama auto-hospedado, começando pela **Oracle Cloud
Free Tier** (VM ARM grátis para sempre) por ser gratuita e mais confiável que
rodar num PC de casa. A abstração `AIProvider` foi construída para trocar de
provedor depois (API paga) sem reescrever nada além de variáveis de ambiente.

- [x] `ai/providers/openaiCompatible.ts` — cliente genérico para qualquer
      provedor compatível com a API de chat da OpenAI (Ollama expõe isso
      nativamente em `/v1`, assim como Groq/DeepSeek/OpenAI). Faz a conversão
      de `ToolDefinition`/`AIChatMessage` para o formato `tools`/`messages` da
      OpenAI, incluindo o ciclo `tool_calls` → resultado da ferramenta.
- [x] `ai/providers/index.ts` — `getConfiguredProvider()` real, lida por
      variável de ambiente `AI_PROVIDER`:
  - `AI_PROVIDER=ollama` + `OLLAMA_BASE_URL` (ex.: `https://ollama.seu-dominio.com/v1`)
    + `OLLAMA_MODEL` (ex.: `llama3.1:8b`) + `OLLAMA_API_KEY` (opcional, se você
    colocar autenticação no proxy reverso na frente do Ollama).
  - `AI_PROVIDER=openai|groq|deepseek` (troca futura) + `AI_PROVIDER_API_KEY`
    + `AI_PROVIDER_MODEL` — usa os endpoints públicos já conhecidos dessas APIs.
- [x] `ai/core/prompt.ts` — `buildSystemPrompt()`: regras anti-alucinação
      (só responder com dados reais das ferramentas, nunca inventar números).
- [x] `src/app/api/ai/chat/route.ts` (Node runtime) — `POST` que:
  1. resolve `AssistantContext` pela sessão (401 se não autenticado);
  2. cria ou reaproveita uma `ai_conversations` do próprio merchant;
  3. carrega até 30 mensagens de histórico + insere a mensagem do usuário;
  4. roda um loop de até 4 chamadas ao provedor, executando `tool_calls` via
     `toolRegistry.execute()` e devolvendo o resultado ao modelo;
  5. grava cada chamada de ferramenta e o resultado final em `ai_usage_logs`;
  6. persiste a resposta final em `ai_messages` e retorna `{ conversationId, reply }`.
- [x] Validado com `get_errors`, `npx eslint` e `npm run build` (todos limpos).

### Pendências operacionais (fora do código, ação do lojista)

- [ ] Criar a VM na Oracle Cloud Free Tier, instalar o Ollama, baixar um
      modelo (ex.: `ollama pull llama3.1:8b`) e publicar a porta do Ollama
      atrás de HTTPS (proxy reverso, ex.: Caddy/Nginx com certificado
      automático) — o Ollama sozinho não tem HTTPS nem autenticação.
- [ ] Definir no Vercel: `AI_PROVIDER=ollama`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`
      (e `OLLAMA_API_KEY` se configurar autenticação no proxy).
- [ ] Testar `POST /api/ai/chat` (`{ "message": "quanto vendi hoje?" }`) com
      o usuário logado antes de construir a UI do painel.

## Sprint 3 — UI do painel (concluído)

- [x] `src/app/dashboard/AssistantWidget.tsx` — botão flutuante + painel de
      chat (client component), mesmo estilo visual do dashboard (zinc/rounded,
      dark mode). Mantém `conversationId` em memória durante a sessão da
      página e consome `POST /api/ai/chat`.
- [x] Renderizado apenas em `src/app/dashboard/page.tsx` (hub principal) por
      enquanto — ainda não replicado em `/dashboard/modulos/**`,
      `/dashboard/branding` ou `/dashboard/pagamento`. Se quiser em todas as
      páginas do dashboard, criar `src/app/dashboard/layout.tsx` envolvendo
      `{children}` com o widget.
- [x] Validado com `get_errors`, `npx eslint` e `npm run build` (limpos).
- Antes de funcionar de verdade, ainda depende do Sprint 2 estar 100%
  operacional (servidor Ollama no ar + env vars no Vercel) — até lá, o
  widget mostra a mensagem de erro amigável vinda da API (503 provider não
  configurado).

## Sprint 4+ (planejado, não iniciado)

- Ferramentas de escrita (ex.: ajustar estoque, confirmar agendamento) — só
  depois de definir o fluxo de confirmação explícita do usuário antes de
  executar qualquer ação que altere dados.
- Persistir/mostrar histórico de conversas anteriores (hoje cada carregamento
  de página começa uma conversa nova no widget, embora o histórico fique
  salvo em `ai_conversations`/`ai_messages`).
- Replicar o widget nas demais páginas do dashboard via layout compartilhado.


