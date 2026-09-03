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

### Fase C — solicitações de agendamento (`confirm_appointment`/`decline_appointment`) [x]

Escopo: confirmar/recusar uma solicitação de agendamento pendente
(`merchant_appointment_requests`), mesmo fluxo da tela humana em
`src/app/dashboard/modulos/agenda/page.tsx`. Não inclui criar/cancelar slot
nem reagendar (fora de escopo desta fase).

Descoberta ao verificar `getDashboardModules()`: o módulo "Agenda"
(`/dashboard/modulos/agenda`) NÃO existe para todos os segmentos — academias,
por exemplo, usam um fluxo próprio de planos/presença/renovações, sem
`merchant_appointment_requests`. Isso confirma que a ferramenta de leitura já
existente (`get_appointments_today`, criada no Sprint 1, antes do sistema de
`requiresModuleHref` existir) também precisava do gate — foi retrofitada
nesta fase.

- [x] `src/lib/merchant/agendaActions.ts` — extraída
      `resolveAppointmentRequestCore()` (privada) + `confirmAppointmentRequestCore()`/
      `declineAppointmentRequestCore()` (exportadas). Só altera o status se a
      solicitação ainda estiver `pending` (mesmo guard `.eq("status","pending")`
      do código original); retorna `{ ok, updated, error }` em vez de decidir
      sozinha o redirect. `confirmAppointmentRequest()`/`declineAppointmentRequest()`
      (Server Actions humanas) refatoradas para chamar essas funções, **mantendo
      o comportamento exato de antes** (inclusive o caso "já resolvida por outra
      via" continua sendo tratado como sucesso silencioso no formulário humano,
      como sempre foi).
- [x] `ai/tools/agenda.ts`:
  - `get_appointments_today` — retrofitada com
    `requiresModuleHref: "/dashboard/modulos/agenda"`.
  - `get_pending_appointments` (novo, `kind: "read"`) — lista só as
    solicitações `pending`, incluindo o `appointmentRequestId` (necessário
    pras ferramentas de escrita; o tool antigo não expunha id nenhum).
  - `confirm_appointment` / `decline_appointment` (novos, `kind: "write"`) —
    `buildPreview` busca a solicitação real (nome do cliente + horário) antes
    de descrever a ação, e recusa a proposta se ela já não estiver mais
    `pending`. Diferente da tela humana, o `run()` trata "0 linhas afetadas"
    (solicitação já resolvida por outra via) como **erro explícito** em vez de
    sucesso silencioso — decisão deliberada pra nunca a IA afirmar sucesso sem
    confirmação real do backend (regra #4), mesmo que isso divirja do
    comportamento (mais permissivo) do formulário humano.
- [x] `ai/tools/index.ts` — as 3 ferramentas novas registradas.

Permissão `dashboard_orders` (mesma da tela humana — não é restrito a dono).

Validado com `get_errors`, `npm run build` e `npx eslint`; commit `70f0790`,
push e deploy em produção concluídos.
**Ainda não testado manualmente** — depende de o merchant de teste do usuário
ser de um segmento com o módulo Agenda habilitado (não é o caso de academia).

### Fase C2 — criar/cancelar horário de agenda (`create_appointment_slot`/`cancel_appointment_slot`) [x]

Escopo: criar um novo horário disponível e cancelar um horário que ainda não
tem nenhuma solicitação de cliente associada. "Reagendar" continua fora de
escopo (não existe como ação isolada hoje, seria lógica nova).

- [x] `src/lib/merchant/agendaActions.ts` — extraídas `createAppointmentSlotCore()`
      e `cancelAppointmentSlotCore()`; `createAppointmentSlot()`/
      `cancelAppointmentSlot()` (Server Actions humanas) refatoradas para
      chamá-las, mantendo o comportamento exato de antes (inclusive
      `cancelAppointmentSlot()` continua sem checar o status atual do slot,
      igual sempre foi).
- [x] `ai/tools/agenda.ts`:
  - `list_queues` (novo, `kind: "read"`) — lista profissionais/filas ativos,
    necessário porque nenhuma ferramenta expunha `queue_id` antes (evita a IA
    inventar um UUID de profissional).
  - `create_appointment_slot` (novo, `kind: "write"`) — args em ISO 8601 com
    fuso horário explícito (evita a ambiguidade do input `datetime-local` sem
    timezone usado no form humano). `buildPreview` valida data/duração e
    resolve o nome do profissional antes de descrever a ação.
  - `cancel_appointment_slot` (novo, `kind: "write"`) — **mais restrito que o
    form humano de propósito**: só cancela slots com `status: "available"`
    (sem nenhuma solicitação associada); se o slot já tiver virado
    `pending`/`booked`, a ferramenta recusa e instrui a resolver a
    solicitação primeiro via `confirm_appointment`/`decline_appointment`.
    Evita a IA cancelar por baixo dos panos um horário que um cliente real já
    reservou (o form humano permite isso sem aviso, mas a IA não deveria).
- [x] `ai/tools/index.ts` — as 3 ferramentas novas registradas.

Todas com `requiresModuleHref: "/dashboard/modulos/agenda"`, permissão
`dashboard_orders`.

Validado com `get_errors`, `npm run build` e `npx eslint`; commit `1905bcb`,
push e deploy em produção concluídos.
**Ainda não testado manualmente** — mesma limitação da Fase C1 (precisa de
merchant de segmento com módulo Agenda).

### Correções pós-teste em produção (barbearia) [x]

Usuário testou em produção com merchant do segmento barbearia (primeiro
segmento real com módulo Agenda testado) e reportou 2 problemas:

1. Pediu para agendar 3 horários, confirmou, mas só 2 ficaram marcados e o
   horário criado não ficou correto.
2. Perguntou quantos atendimentos tinha marcado; o assistente respondeu que
   só sabia quantos atendimentos foram *concluídos* (confundiu com dados de
   vendas) — e não existia nenhuma ferramenta para consultar horários
   disponíveis.

Causas raiz encontradas e corrigidas:

- [x] **Bug de fuso horário em `create_appointment_slot`**: o servidor
      (Vercel) roda em UTC, e o tool exigia que o modelo sempre incluísse o
      offset `-03:00` no horário — o modelo nem sempre inclui isso de forma
      confiável, então uma data "nua" (ex. `2026-09-10T14:00:00`) era
      interpretada como UTC em vez de horário de Brasília, ficando 3h errada.
      Corrigido com `resolveAppointmentDateTime()` (`ai/tools/agenda.ts`):
      se a string não tiver timezone explícito, assume `-03:00`
      automaticamente (Brasil não tem mais horário de verão desde 2019,
      então America/Sao_Paulo é sempre UTC-3 — não precisa de lib de timezone
      pra isso).
- [x] **Múltiplas ações de escrita descartadas silenciosamente**:
      `src/app/api/ai/chat/route.ts` só propõe a PRIMEIRA ferramenta de
      escrita quando o modelo pede várias na mesma resposta (ex.: 3x
      `create_appointment_slot` de uma vez) — as outras eram descartadas sem
      nenhum aviso, e como o histórico da conversa só guarda texto (não a
      lista de tool_calls original), o modelo não tinha como saber que só 1
      das 3 foi de fato proposta. Isso explica "confirmei tudo mas só 2
      ficaram marcados". Correção: `proposeWriteAction()` agora recebe
      `extraWriteCallsCount` e anexa um aviso explícito no preview quando
      há mais ações pedidas na mesma mensagem, para o usuário saber que
      precisa confirmar uma de cada vez. Reforçado também no system prompt
      (`ai/core/prompt.ts`): "só pode propor UMA ação de escrita por vez".
      NÃO foi feita uma reformulação arquitetural maior (ex.: persistir a
      fila de tool_calls pendentes) — fica para se o problema persistir
      mesmo com o aviso.
- [x] **Sem ferramenta pra "quantos atendimentos marcados" além de hoje**:
      `get_appointments_today` ganhou parâmetro opcional `daysAhead`
      (padrão 1 = só hoje, máximo 30) — permite responder "quantos
      atendimentos tem essa semana", etc.
- [x] **Sem ferramenta pra horários disponíveis**: novo tool
      `get_available_slots` (`kind: "read"`) lista slots com
      `status: "available"` (ainda sem cliente) num período (padrão 7 dias),
      com filtro opcional por profissional/fila.
- [x] `ai/core/prompt.ts`: nova frase deixando explícito que
      "atendimentos/agendamentos marcados" (ferramentas de agenda) é um
      domínio DIFERENTE de "vendas/pedidos" (`get_sales_summary`,
      `get_top_products`) — para o modelo não confundir os dois ao responder
      perguntas sobre "quantos atendimentos".
- [x] `ai/tools/index.ts` — `get_available_slots` registrada.

Validado com `get_errors`, `npm run build` e `npx eslint`; commit `fce31e0`,
deploy em produção concluído. **Testado manualmente** — usuário reportou
que timezone e confirmação sequencial funcionaram corretamente (3 slots
criados com horários certos, um de cada vez).

### Gap: "vaga aberta" vs. "cliente marcado direto" [x]

No reteste em produção (mesmo merchant de barbearia), o usuário pediu pra
agendar 3 clientes pelo nome (Victor, mariano, João) via `create_appointment_slot`
— o assistente criou os 3 horários corretamente, mas quando o usuário
perguntou "quantos atendimentos tenho marcados", a resposta foi "nenhum".
Tecnicamente correto (o modelo de dados separa "vaga disponível" —
`merchant_appointment_slots`, sem cliente nenhum associado — de "solicitação
de cliente" — `merchant_appointment_requests`, que é o que as ferramentas de
leitura de "atendimentos" consultam), mas inútil pra quem só quer marcar um
cliente conhecido por telefone/balcão e já considerar isso um atendimento
real marcado. Confirmado por leitura de código que essa capacidade não
existia nem no painel humano (`src/app/dashboard/modulos/agenda/page.tsx`
só tem o form de criar vaga aberta).

Decisão (perguntada ao usuário via clarifying question, aprovada): construir
uma capacidade nova de "marcar cliente direto", em vez de só melhorar a
comunicação sobre a limitação.

- [x] `bookAppointmentForCustomerCore()` (`src/lib/merchant/agendaActions.ts`)
      — reaproveita `createAppointmentSlotCore` (cria a vaga) e
      `confirmAppointmentRequestCore` (confirma a solicitação) em sequência:
      cria o slot, insere uma `merchant_appointment_requests` com
      `customer_name`/`customer_contact`/`customer_notes` e
      `session_token: "staff:${userId}"` (sintético — não há sessão real de
      cliente aqui; a trigger `handle_appointment_request_insert` só valida
      `session_token` pra role `anon`, então funciona normalmente pro
      cliente autenticado do painel), e confirma imediatamente. Sem
      migration — `customer_name`/`customer_contact`/`customer_notes` já
      existiam na tabela (nullable), só não havia nenhum código que os
      preenchesse fora do fluxo de reserva do próprio cliente.
- [x] Novo tool de IA `book_appointment_for_customer` (`ai/tools/agenda.ts`,
      `kind: "write"`) — args `startsAt`, `durationMin`, `customerName`
      (obrigatório), `customerContact`/`customerNotes`/`queueId` (opcionais).
      `buildPreview` deixa explícito que o agendamento já fica CONFIRMADO
      pro cliente citado.
- [x] `create_appointment_slot`: descrição atualizada instruindo o modelo a
      usar `book_appointment_for_customer` em vez desta sempre que o lojista
      citar o nome de um cliente específico.
- [x] `ai/core/prompt.ts`: nova frase explicando a diferença entre os dois
      conceitos e reforçando quando usar cada ferramenta.
- [x] `ai/tools/index.ts` — `book_appointment_for_customer` registrada.

Ainda não existe uma Server Action humana equivalente no painel (fica pra
uma iteração futura, se o usuário quiser um botão "marcar cliente direto"
também no painel) — a capacidade nova só está exposta via IA por enquanto.

Validado com `get_errors`, `npm run build` e `npx eslint`; commit `55193d5`,
push e deploy em produção concluídos. **Testado manualmente e confirmado** —
usuário marcou 3 clientes (Victor, João, Junio) e o assistente confirmou
corretamente dias/horários de todos ao perguntar "atendimentos marcados
essa semana".

### Fase C3 — reagendar (`reschedule_appointment`) [x]

Escopo: mudar a data/hora de um agendamento já existente (pendente ou
confirmado), sem precisar cancelar e criar outro. Não existia como ação
isolada até aqui (ver nota em Fase C2).

- [x] `rescheduleAppointmentCore()` (`src/lib/merchant/agendaActions.ts`) —
      atualiza `starts_at`/`ends_at` do slot associado e a cópia
      denormalizada (`slot_starts_at`/`slot_ends_at`) na
      `merchant_appointment_requests` correspondente (nenhuma trigger
      sincroniza esses campos automaticamente, só `status` — confirmado
      lendo `handle_appointment_request_update`, que só age quando
      `new.status <> old.status`). Duração mantém a atual se não informada.
      Só aceita agendamentos com status `pending`/`confirmed`.
- [x] Novo tool `reschedule_appointment` (`ai/tools/agenda.ts`,
      `kind: "write"`) — args `appointmentRequestId`, `startsAt`,
      `durationMin` (opcional). `buildPreview` mostra data/hora antiga →
      nova.
- [x] `get_appointments_today` passou a expor `appointmentRequestId` em cada
      linha (antes só `get_pending_appointments` expunha id) — necessário
      pra reagendar um agendamento já CONFIRMADO (não só pendente).
- [x] `ai/core/prompt.ts` — nova frase instruindo usar `reschedule_appointment`
      em vez de criar um novo agendamento + cancelar o antigo.
- [x] `ai/tools/index.ts` — `reschedule_appointment` registrada.

Ainda não existe Server Action humana equivalente (só IA por enquanto).

Validado com `get_errors`, `npm run build` e `npx eslint`; commit `10b1d80`,
push e deploy em produção concluídos.
**Ainda não testado manualmente.**

### Fase: `get_platform_help` (onboarding sobre o próprio Qerbie) [x]

Pedido do usuário: um lojista que acabou de criar conta (já autenticado,
dentro do painel) pergunta pro mesmo assistente coisas como "o que essa
plataforma faz pela minha academia?" ou "onde eu cadastro meus alunos/
clientes?" — dúvida sobre o PRÓPRIO Qerbie e seus recursos, não sobre dado
real do negócio. Diferente de um chat público pré-cadastro: como o usuário
já está autenticado, `ctx.merchantId`/`ctx.businessCategory` já vêm de
`buildAssistantContext()` normalmente — não precisou de rota nova, tabela de
leads nem rate-limit extra.

- [x] `ai/tools/platform.ts` (área nova) — `get_platform_help` (`kind:
      "read"`), sem `requiresModuleHref` (é universal). Reaproveita
      `getDashboardModules(ctx.businessCategory)` — mesma fonte que gera a
      navegação real do dashboard — pra nunca inventar um módulo que não
      existe pro segmento do lojista. Retorna `headerNudge` + módulos de
      catálogo/atendimento/vendas com título, descrição, status ("Agora"/
      "Em breve") e link.
- [x] `ai/core/prompt.ts` — 2 frases novas orientando quando usar essa tool
      (perguntas sobre o próprio Qerbie/navegação) vs. as demais tools
      (dado real do negócio).
- [x] `ai/tools/index.ts` — `get_platform_help` registrada.

Validado com `get_errors`, `npm run build` e `npx eslint`; commit `db18e7e`,
push e deploy em produção concluídos.
**Testado manualmente e confirmado** (2026-09-03) — usuário perguntou "o que
tem na plataforma" (resposta correta via `get_platform_help`) e depois "por
que eu deveria virar cliente da Qerbie" (pergunta de venda, sem tool
dedicada — o modelo respondeu bem só com o prompt + contexto do segmento).

### Marcar cliente e reagendar também no painel humano [x]

Desde a Fase C2/C3, `book_appointment_for_customer` e
`reschedule_appointment` só existiam como ferramentas de IA — o lojista não
conseguia fazer a mesma coisa sem passar pelo chat. Retomando a ordem de
evolução do plano após o desvio do `get_platform_help`, expostas as duas
ações também como Server Actions humanas no módulo de Agenda.

- [x] `src/lib/merchant/agendaActions.ts` — novas Server Actions
      `bookAppointmentForCustomer(formData)` e `rescheduleAppointment(formData)`,
      ambas reaproveitando `bookAppointmentForCustomerCore`/
      `rescheduleAppointmentCore` (mesma mutação central da IA, sem duplicar
      lógica de negócio) atrás de `requireAgendaPermission()` (mesma
      permissão `dashboard_orders`/isOwner das outras ações da agenda).
- [x] `src/app/dashboard/modulos/agenda/page.tsx`:
  - Novo card "Marcar cliente diretamente" (nome, contato, profissional,
    início, duração, observações) — já confirma na hora, igual à tool de IA.
  - Cada solicitação pendente e cada atendimento confirmado (nova seção
    "Atendimentos confirmados", que consulta `status='confirmed'` com
    `slot_starts_at >= agora`) ganhou um mini-formulário inline
    "Reagendar" (novo horário + duração opcional).
  - Novos códigos de erro tratados no banner: `invalid_booking`,
    `booking_failed`, `invalid_status`.

Validado com `get_errors`, `npm run build` e `npx eslint`; commit `8a65686`,
push e deploy em produção concluídos. **Ainda não testado manualmente.**

### Autoatendimento do cliente no cardápio (vertical `t`/restaurante) [x] — MVP (commit `a5e6257`)

Nova superfície, diferente das duas anteriores: chat de IA para o CLIENTE
final (anônimo, sem login — resolvido só por `qrToken` -> `merchant_tables`
-> `merchants`, igual ao padrão já usado em
`src/app/t/[qrToken]/menu/page.tsx`). Objetivo: responder perguntas tipo
"qual o prato mais vendido?"/"o que vocês têm de sobremesa?" no próprio
cardápio público, sem expor dado financeiro nem de outros clientes.

Decisões de escopo (MVP, não perguntado ao lojista antes por já ter sido
delegado — "fica a seu critério"):
- Só a vertical `t` (restaurante/cardápio) por enquanto. Outras verticais
  (`b`, `e`, `g`, `l`, `p`, `s`) ficam para depois, se validar bem.
- **Injeção de contexto, sem tool-calling**: cardápio ativo + itens mais
  pedidos são buscados no servidor e embutidos como texto no system prompt;
  o modelo só responde com base nisso (`tools: []`), sem precisar de um
  registro de ferramentas paralelo pra usuário anônimo. Reduz risco e
  garante que a IA nunca invente prato fora da lista real.
- **Sem tabela nova**: histórico da conversa fica só no estado do React no
  navegador do cliente (perdido ao recarregar a página) — não criamos
  `ai_conversations`/`ai_messages` equivalentes pra visitante anônimo.
- **Rate limit em memória, por instância** (`Map` simples, janela de 60s,
  máx. 8 mensagens por merchant+IP) — contém abuso básico, mas **não é
  distribuído** entre instâncias serverless da Vercel (cada instância tem
  seu próprio contador). Motivo de aceitar isso no MVP: o provedor de IA
  (Groq, `openai/gpt-oss-120b`) já tem um limite de TPM apertado (8000)
  compartilhado com o chat pago dos lojistas no painel — importante não
  deixar essa superfície nova (pública, sem autenticação) consumir esse
  orçamento sem nenhuma contenção. Evoluir pra um limitador real
  (Supabase ou KV distribuído) se o uso justificar.
- Nunca expõe faturamento/receita/dado de outro cliente — só nome do
  produto e quantas vezes foi pedido (mesmo padrão de segurança do
  `get_top_products` já usado no painel do lojista).

Arquivos:
- [x] `src/lib/customer/popularItems.ts` — `getPopularMenuItemsCore(merchantId, limit=5)`.
      Usa `createAdminClient()` (service role) porque a RLS anônima de
      `orders`/`order_items` só permite ler os PRÓPRIOS pedidos
      (`orders_anon_select` via `session_token`), e aqui precisamos agregar
      pedidos de TODOS os clientes daquele lojista. `merchantId` é sempre
      resolvido no servidor a partir do `qrToken` — nunca aceito do cliente.
- [x] `src/app/api/public/menu-assistant/[qrToken]/route.ts` (POST) —
      resolve `qrToken` -> merchant (cliente Supabase comum, sem admin),
      aplica o rate limit em memória, monta o system prompt com cardápio
      real + itens mais pedidos, chama
      `getConfiguredProvider().chat({messages, tools: []})`, trata
      `AIProviderRateLimitError` com mensagem amigável em português (ou
      inglês/espanhol, conforme `lang` enviado pelo cliente).
- [x] `src/app/t/[qrToken]/menu/CustomerMenuAssistant.tsx` — widget de chat
      flutuante (bolha + painel), versão simplificada do
      `AssistantWidget.tsx` do painel (sem histórico persistido, sem ações
      pendentes de confirmação, já que essa superfície é só leitura).
- [x] `src/app/t/[qrToken]/menu/CustomerMenuShell.tsx` — importa e renderiza
      `<CustomerMenuAssistant qrToken={qrToken} />` só quando há cardápio
      ativo publicado.

Validado com `get_errors`, `npm run build` e `npx eslint`; commit `a5e6257`,
push e deploy em produção (`npx vercel --prod --yes`) concluídos.
**Testado manualmente e confirmado** (2026-09-03) — usuário perguntou sobre
um prato específico ("a pizza é boa?"), o assistente respondeu de forma
amigável, sugeriu outros itens e disse corretamente que não podia fazer o
pedido (só orientar), instruindo a usar o carrinho normal do cardápio.

Limitações conhecidas / evoluções futuras:
- Rate limiter não-distribuído (ver acima).
- UI do widget (placeholder, rótulos) ainda só em português, mesmo que a
  resposta da IA já respeite o idioma escolhido pelo cliente (`lang`).
- MVP restrito à vertical `t`; replicar padrão pras demais verticais
  (`b`/`e`/`g`/`l`/`p`/`s`) depois de validar com uso real (já validado com
  sucesso nessa primeira vertical).
- Sem persistência de conversa (perde histórico ao recarregar a página).


