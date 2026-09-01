-- Qerbie / Supabase Schema
-- Version: 051_ai_assistant
-- Purpose: Fundação de dados do Assistente de IA (conversas, mensagens e observabilidade).
-- Depends on: 002_merchants

begin;

create table if not exists public.ai_conversations (
  id          uuid        primary key default gen_random_uuid(),
  merchant_id uuid        not null references public.merchants(id) on delete cascade,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  title       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists ai_conversations_merchant_ix
  on public.ai_conversations (merchant_id, updated_at desc);

create index if not exists ai_conversations_user_ix
  on public.ai_conversations (user_id, updated_at desc);

drop trigger if exists set_updated_at on public.ai_conversations;
create trigger set_updated_at
before update on public.ai_conversations
for each row
execute function public.set_updated_at();

create table if not exists public.ai_messages (
  id              uuid        primary key default gen_random_uuid(),
  conversation_id uuid        not null references public.ai_conversations(id) on delete cascade,
  merchant_id     uuid        not null references public.merchants(id) on delete cascade,
  role            text        not null check (role in ('user', 'assistant', 'tool', 'system')),
  content         text        not null,
  tool_name       text,
  created_at      timestamptz not null default now()
);

create index if not exists ai_messages_conversation_ix
  on public.ai_messages (conversation_id, created_at);

-- Registro de execução de ferramentas/chamadas de IA para observabilidade e custo.
-- Não armazena o conteúdo das mensagens, apenas metadados de uso.
create table if not exists public.ai_usage_logs (
  id              uuid        primary key default gen_random_uuid(),
  merchant_id     uuid        not null references public.merchants(id) on delete cascade,
  user_id         uuid        references auth.users(id) on delete set null,
  conversation_id uuid        references public.ai_conversations(id) on delete set null,
  provider        text,
  model           text,
  tool_name       text,
  status          text        not null default 'ok' check (status in ('ok', 'error')),
  error_message   text,
  latency_ms      integer,
  input_tokens    integer,
  output_tokens   integer,
  created_at      timestamptz not null default now()
);

create index if not exists ai_usage_logs_merchant_ix
  on public.ai_usage_logs (merchant_id, created_at desc);

commit;
