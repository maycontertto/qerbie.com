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

### Bloqueio real de infraestrutura (Oracle Cloud)

- A VM Oracle Free Tier (A1.Flex/ARM) não pôde ser criada: a região São Paulo
  está com capacidade esgotada ("out of capacity") para 2 OCPU/12GB e
  1 OCPU/6GB, mesmo com toda a config pronta (rede, IP público, SSH,
  storage, imagem Ubuntu). Não é um bug do Qerbie — é limitação do free tier
  da Oracle. O lojista pode tentar novamente mais tarde (a disponibilidade
  varia) ou pagar por um plano com capacidade garantida.

### Pivô temporário: Groq como provedor bridge (em produção agora)

- Enquanto a VM Oracle não sobe, `AI_PROVIDER=groq` está ativo em produção —
  zero mudança de código, só variáveis de ambiente (valida a decisão de
  arquitetura do cliente OpenAI-compatible genérico).
- Env vars atuais na Vercel: `AI_PROVIDER=groq`, `AI_PROVIDER_API_KEY`
  (gerada em console.groq.com/keys, grátis, sem cartão) e
  `AI_PROVIDER_MODEL=openai/gpt-oss-120b`.
- **Bug corrigido:** `getConfiguredProvider()` não fazia `.trim()` nas env
  vars — corrigido para tolerar espaços/quebras de linha ao colar valores no
  dashboard da Vercel.
- **Causa raiz do 502 inicial:** o modelo configurado originalmente,
  `llama-3.3-70b-versatile`, foi **removido do catálogo da Groq**. Modelos
  de texto disponíveis em 2026-09 (revalidar antes de trocar no futuro, a
  Groq depreca modelos com frequência): `openai/gpt-oss-120b`,
  `openai/gpt-oss-20b`, `openai/gpt-oss-safeguard-20b`, `groq/compound`,
  `groq/compound-mini`, `qwen/qwen3.6-27b`, `qwen/qwen3.8-27b`,
  `allam-2-7b` (foco árabe). Escolhido `openai/gpt-oss-120b` por qualidade e
  suporte a tool calling.
- Adicionado `console.error` no catch de `route.ts` pra o erro real do
  provedor aparecer direto nos logs do Vercel (antes só ia pro
  `ai_usage_logs.error_message` no Supabase).
- **Testado e funcionando em produção** (`www.qerbie.com/dashboard`): o
  assistente respondeu corretamente a "quero que veja se foi vendido alguma
  coisa hoje" usando `get_sales_summary`.

### Pendências operacionais (fora do código, ação do lojista)

- [ ] Quando a Oracle liberar capacidade: criar a VM, instalar o Ollama,
      baixar um modelo (ex.: `ollama pull llama3.1:8b`) e publicar a porta
      atrás de HTTPS (proxy reverso) — aí trocar `AI_PROVIDER` de volta para
      `ollama` (self-hosted, sem custo por token) se desejado.

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
  operacional (provedor de IA configurado + env vars no Vercel) — hoje isso
  já está resolvido via Groq (ver seção "Pivô temporário" acima).
- **Confirmado funcionando em produção** — teste real do lojista via widget
  respondeu corretamente usando dados reais do Supabase.

## Sprint 4 (em andamento)

- [x] Widget em todas as páginas do dashboard via `src/app/dashboard/layout.tsx`
      (busca `merchant` uma vez com `allowSuspended: true` e envolve
      `{children}` — removido de `page.tsx` pra não duplicar).
- [x] Histórico de conversas anteriores:
  - `GET /api/ai/conversations` — lista conversas do merchant (id, title,
    updated_at), ordenadas por `updated_at desc`.
  - `GET /api/ai/conversations/[id]` — mensagens (só `user`/`assistant`) de
    uma conversa, validando `merchant_id` antes de retornar.
  - `src/app/api/ai/chat/route.ts` agora faz `update` em
    `ai_conversations.updated_at` a cada resposta bem-sucedida (o trigger
    `set_updated_at` só dispara em UPDATE, não em INSERT de mensagens — sem
    isso a lista de histórico nunca reordenava pela conversa mais recente).
  - `AssistantWidget.tsx` ganhou botões de "nova conversa" e "conversas
    anteriores" no cabeçalho; o segundo abre uma lista que troca o painel de
    chat por um `<ul>` de conversas (título + data), clicando carrega as
    mensagens salvas.
- [ ] Ferramentas de escrita (ex.: ajustar estoque, confirmar agendamento) — só
      depois de definir o fluxo de confirmação explícita do usuário antes de
      executar qualquer ação que altere dados.

### Item 3 — Agente de escrita (WRITE/GENERATE), Fase A (fundação) [x]

Plano completo (Fases A-E) registrado em `/memories/repo/qerbie-ai-assistant.md`.
Fase A concluída — infraestrutura de confirmação pronta, mas **nenhuma
ferramenta de escrita real ainda existe** (Fase B fica para a próxima etapa).

- [x] **A1** — `ToolDefinition` (`ai/types/index.ts`) ganhou `kind: "read" |
      "write" | "generate"`. As 4 ferramentas do Sprint 1 marcadas como `"read"`.
- [x] **A2** — Migration `integrations/supabase/schema/052_ai_pending_actions.sql`
      + `integrations/supabase/rls/ai_pending_actions.rls.sql`: tabela
      `ai_pending_actions` guarda toda proposta de escrita (tool_name,
      arguments, preview_text, status, expires_at) para o backend nunca
      confiar em argumentos reenviados pelo cliente na hora da confirmação.
      RLS: só quem propôs a ação pode confirmá-la/rejeitá-la; sem política de
      delete (auditoria é append-only).
- [x] **A3** — Gate de confirmação: `src/app/api/ai/chat/route.ts` agora
      detecta quando o modelo chama uma ferramenta `kind: "write"` e, em vez
      de executar, chama `proposeWriteAction()` (grava em
      `ai_pending_actions` + devolve `{ pendingAction: { id, previewText } }`
      ao cliente, sem rodar nada). Dois endpoints novos:
      `POST /api/ai/actions/[id]/confirm` (relê os `arguments` salvos, roda
      `toolRegistry.execute()` — que já revalida permissão — e grava
      resultado/erro real) e `POST /api/ai/actions/[id]/reject` (só marca como
      `rejected`). Lookup compartilhado em `ai/core/pendingActions.ts`
      (`fetchPendingAction`) trata expiração (10 min).
- [x] **A4** — `AssistantWidget.tsx`: mensagens do assistente que trazem
      `pendingActionId` mostram botões "Confirmar"/"Cancelar"; ao resolver,
      chama o endpoint correspondente e adiciona uma nova mensagem com o
      resultado real (nunca assume sucesso antes da resposta do backend).

Próximo passo (Fase B, ainda não iniciado): primeira ferramenta de escrita
real (`adjust_stock`), extraindo a mutação central de
`src/lib/merchant/stockActions.ts` para uma função pura reaproveitável tanto
pela Server Action existente quanto pela nova tool.

### Fase B1 — primeira ferramenta de escrita real (`adjust_stock`) [x]

- [x] `ai/types/index.ts` — `buildPreview` passou a aceitar retorno
      `string | Promise<string>` (necessário pro preview de `adjust_stock`
      consultar o produto real no banco antes de montar o texto).
- [x] `src/app/api/ai/chat/route.ts` — `proposeWriteAction()` agora dá
      `await` em `buildPreview()` e, no catch, repassa `error.message` real
      (quando é uma instância de `Error`) em vez de sempre devolver um texto
      genérico — necessário pra surfacear erros como "produto não
      encontrado" ou "somente o dono pode ajustar estoque".
- [x] `src/lib/merchant/stockActions.ts` — extraída `updateProductStockCore()`
      (mutação pura de `products.track_stock`/`stock_quantity`, sem nenhuma
      checagem de permissão — quem chama decide). `saveProductStock()`
      (Server Action humana) refatorada para chamar essa função central;
      `saveProductStockBatch()` não foi tocada (fora do escopo). Este é o
      padrão "extrair e delegar" a ser reaproveitado nas próximas
      ferramentas de escrita (agenda, catálogo etc.).
- [x] `ai/tools/inventory.ts` — duas ferramentas novas:
  - `find_product` (`kind: "read"`) — busca por nome parcial (`ilike`),
    retorna `productId`/`stockQuantity`/`trackStock`/`unitLabel`. Existe
    porque `get_low_stock` não expõe `id`, e o modelo nunca deve inventar um
    UUID de produto.
  - `adjust_stock` (`kind: "write"`) — propõe nova quantidade em estoque.
    Replica a restrição real da UI humana: `saveProductStock` é
    owner-only (não usa nenhuma permissão `dashboard_*`), então
    `adjust_stock` também checa `ctx.isOwner` explicitamente tanto no
    `buildPreview` (falha cedo, com mensagem clara) quanto no `run()`
    (defesa em profundidade, revalidado no momento da confirmação). Chama
    `updateProductStockCore()` para a escrita real.
- [x] `ai/tools/index.ts` — `findProductTool` e `adjustStockTool`
      registradas em `registerAllTools()`.
- [x] `ai/core/prompt.ts` — duas frases novas no prompt: (1) deixa claro que
      chamar uma ferramenta de escrita é só uma proposta, não uma execução
      confirmada; (2) instrui o modelo a usar uma ferramenta de busca antes
      de propor alteração num produto específico.

Validado com `get_errors`, `npm run build` e `npx eslint` nos arquivos
alterados; commit `4ac1564`, push e deploy em produção
(`https://www.qerbie.com`) concluídos. Testado manualmente pelo lojista em
produção em 2026-09-02 (perguntou estoque, pediu pra somar +4, confirmou, o
ajuste foi aplicado corretamente) — primeiro teste ponta a ponta real de
toda a arquitetura de confirmação da Fase A, com sucesso.

### Fase B2 — editar produto por texto (`update_product`) [x]

- [x] `src/lib/catalog/actions.ts` — nova `updateProductFieldsCore()`:
      atualização **parcial** (só toca as colunas explicitamente informadas:
      `name`, `description`, `price`, `isActive`, `isFeatured`). Diferente da
      Server Action `updateProduct` (formulário humano, sempre substitui o
      produto inteiro), essa função existe especificamente para a IA não
      apagar campos que o lojista não pediu para mudar. Replica a mesma
      regra de negócio: desativar o produto (`isActive: false`) zera o
      estoque automaticamente, igual ao formulário humano.
- [x] `ai/tools/catalog.ts` (novo arquivo, nova área) — `update_product`
      (`kind: "write"`): edita nome/descrição/preço/ativo de um produto já
      cadastrado. Preview lista só as mudanças reais (compara valor novo com
      valor atual do banco) e lança erro se nada mudou de fato. Não mexe em
      estoque (isso é papel do `adjust_stock`), nem em menu/categoria/imagem
      (fora de escopo desta etapa — criação de produto fica para uma fase
      futura por causa da resolução de `menu_id`).
- [x] `ai/tools/index.ts` — `updateProductTool` registrada.

Validado com `get_errors`, `npm run build` e `npx eslint`; commit `ba1a942`,
push e deploy em produção concluídos. Testado manualmente pelo lojista em
produção em 2026-09-02 (alterou nome e preço de um produto, confirmou,
aplicou certinho) — segunda ferramenta de escrita validada ponta a ponta.

### Fase B3 — status de trocas/devoluções (`update_exchange_status`) [x]

Descoberta ao mapear o plano original ("observações em pedidos/agendamentos/
trocas"): não existe um campo `notes` genérico e editável pelo lojista de
forma isolada em nenhuma tabela — `merchant_appointment_requests` só tem
`customer_notes` (preenchido pelo cliente, não deveria ser sobrescrito pela
IA) e `orders`/`order_items` têm notas por item de pedido, não por pedido
inteiro. O alvo seguro e realmente útil encontrado foi
`merchant_exchange_requests` (trocas/devoluções): tabela única, independente
de vertical de negócio, com `status` (`open`/`in_progress`/`done`/
`cancelled`) e `notes` já preenchidos na criação.

- [x] `src/lib/merchant/exchangeActions.ts` — extraída
      `updateExchangeStatusCore()` (mutação pura, valida o enum de status);
      `updateExchangeStatus()` (Server Action humana) refatorada para
      chamá-la. `createExchangeRequest()` não foi tocada (fora de escopo).
- [x] `ai/tools/exchanges.ts` (novo arquivo, nova área):
  - `get_exchange_requests` (`kind: "read"`) — lista solicitações por
    status (padrão: só as abertas).
  - `update_exchange_status` (`kind: "write"`) — propõe novo status para uma
    solicitação. Preview traduz os status para português ("aberta", "em
    andamento", "concluída", "cancelada").
- [x] `ai/tools/index.ts` — as duas ferramentas registradas.

Permissão `dashboard_orders` (mesma da tela humana de trocas), sem checagem
extra de dono — igual ao formulário humano, qualquer membro com essa
permissão pode mudar o status.

Validado com `get_errors`, `npm run build` e `npx eslint`; commit `317ad50`,
push e deploy em produção concluídos. **Ainda não testado manualmente.**

### Consciência de segmento de negócio (multi-vertical) [x]

Descoberta ao testar a Fase B3: o Qerbie atende ~20 segmentos diferentes
(`BusinessCategoryKey` em `src/lib/merchant/businessCategories.ts`) e nem
todo módulo do dashboard existe para todo segmento (ex.: "Trocas" só existe
para loja/material de construção/casa de ração/açaiteria — ver
`getDashboardModules()` em `src/lib/merchant/dashboardModules.ts`). O
assistente propôs uma ação de um módulo que o estabelecimento de teste do
usuário nem usa, o que gerou confusão.

- [x] `ai/types/index.ts` — `ToolDefinition` ganhou `requiresModuleHref?:
      string` opcional: se definido, a ferramenta só aparece disponível (e só
      executa) para segmentos que têm aquele módulo habilitado no dashboard.
- [x] `ai/core/moduleAvailability.ts` (novo) — `isModuleEnabledForCategory()`
      reaproveita `getDashboardModules()` (a MESMA função que decide a
      navegação real do dashboard humano) em vez de manter uma segunda lista
      paralela — elimina o risco de as duas listas divergirem.
- [x] `ai/core/registry.ts` — `listAvailable()` e `execute()` agora também
      checam `requiresModuleHref` (além da permissão), com a mesma filosofia
      de "falha fechada" já usada pra permissão.
- [x] `ai/tools/exchanges.ts` — `get_exchange_requests` e
      `update_exchange_status` marcadas com
      `requiresModuleHref: "/dashboard/modulos/trocas"`.
- [x] `ai/core/prompt.ts` — o prompt de sistema agora mostra o **nome legível**
      do segmento (ex.: "Casa de Ração" em vez da chave interna
      `casa_de_racao`) e explica ao modelo que nem todo recurso existe pra
      todo segmento, e que as ferramentas disponíveis já refletem isso.

Validado com `get_errors` + `npm run build` + `npx eslint`; commit `8653922`,
push e deploy em produção concluídos.


