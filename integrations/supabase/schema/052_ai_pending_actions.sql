-- Qerbie / Supabase Schema
-- Version: 052_ai_pending_actions
-- Purpose: Ações de escrita propostas pelo Assistente de IA, aguardando
--          confirmação explícita do usuário antes de qualquer execução real
--          (Sprint 4, Fase A). O backend nunca reaceita argumentos vindos do
--          cliente no momento da confirmação — sempre relê `arguments` daqui.
-- Depends on: 002_merchants, 051_ai_assistant

begin;

create table if not exists public.ai_pending_actions (
  id                  uuid        primary key default gen_random_uuid(),
  merchant_id         uuid        not null references public.merchants(id) on delete cascade,
  user_id             uuid        not null references auth.users(id) on delete cascade,
  conversation_id     uuid        references public.ai_conversations(id) on delete set null,
  tool_name           text        not null,
  arguments           jsonb       not null default '{}'::jsonb,
  preview_text        text        not null,
  status              text        not null default 'pending'
                        check (status in ('pending', 'executed', 'failed', 'rejected', 'expired')),
  result              jsonb,
  error_message       text,
  created_at          timestamptz not null default now(),
  expires_at          timestamptz not null default (now() + interval '10 minutes'),
  resolved_at         timestamptz,
  resolved_by_user_id uuid        references auth.users(id) on delete set null
);

create index if not exists ai_pending_actions_merchant_ix
  on public.ai_pending_actions (merchant_id, created_at desc);

create index if not exists ai_pending_actions_user_status_ix
  on public.ai_pending_actions (user_id, status);

commit;
