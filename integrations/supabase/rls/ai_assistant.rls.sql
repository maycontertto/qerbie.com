-- Qerbie / Supabase RLS Policies
-- Tables: public.ai_conversations, public.ai_messages, public.ai_usage_logs

begin;

alter table public.ai_conversations enable row level security;
alter table public.ai_conversations force row level security;

revoke all on table public.ai_conversations from anon;
revoke all on table public.ai_conversations from authenticated;

grant select, insert, update, delete on table public.ai_conversations to authenticated;

alter table public.ai_messages enable row level security;
alter table public.ai_messages force row level security;

revoke all on table public.ai_messages from anon;
revoke all on table public.ai_messages from authenticated;

grant select, insert, update, delete on table public.ai_messages to authenticated;

alter table public.ai_usage_logs enable row level security;
alter table public.ai_usage_logs force row level security;

revoke all on table public.ai_usage_logs from anon;
revoke all on table public.ai_usage_logs from authenticated;

grant select, insert on table public.ai_usage_logs to authenticated;

-- Conversas: qualquer membro/dono com acesso ao merchant pode ler e criar;
-- só o dono pode apagar (limpar histórico).
drop policy if exists ai_conversations_auth_select on public.ai_conversations;
create policy ai_conversations_auth_select
on public.ai_conversations
for select
to authenticated
using (public.has_merchant_access(merchant_id));

drop policy if exists ai_conversations_auth_insert on public.ai_conversations;
create policy ai_conversations_auth_insert
on public.ai_conversations
for insert
to authenticated
with check (public.has_merchant_access(merchant_id));

drop policy if exists ai_conversations_auth_update on public.ai_conversations;
create policy ai_conversations_auth_update
on public.ai_conversations
for update
to authenticated
using (public.has_merchant_access(merchant_id))
with check (public.has_merchant_access(merchant_id));

drop policy if exists ai_conversations_auth_delete on public.ai_conversations;
create policy ai_conversations_auth_delete
on public.ai_conversations
for delete
to authenticated
using (public.is_merchant_owner(merchant_id));

-- Mensagens: mesma regra de acesso das conversas (mesmo merchant_id).
drop policy if exists ai_messages_auth_select on public.ai_messages;
create policy ai_messages_auth_select
on public.ai_messages
for select
to authenticated
using (public.has_merchant_access(merchant_id));

drop policy if exists ai_messages_auth_insert on public.ai_messages;
create policy ai_messages_auth_insert
on public.ai_messages
for insert
to authenticated
with check (public.has_merchant_access(merchant_id));

drop policy if exists ai_messages_auth_delete on public.ai_messages;
create policy ai_messages_auth_delete
on public.ai_messages
for delete
to authenticated
using (public.is_merchant_owner(merchant_id));

-- Logs de uso/observabilidade: leitura só do dono (métricas administrativas);
-- inserção liberada para qualquer membro autenticado que use o assistente.
drop policy if exists ai_usage_logs_auth_select on public.ai_usage_logs;
create policy ai_usage_logs_auth_select
on public.ai_usage_logs
for select
to authenticated
using (public.is_merchant_owner(merchant_id));

drop policy if exists ai_usage_logs_auth_insert on public.ai_usage_logs;
create policy ai_usage_logs_auth_insert
on public.ai_usage_logs
for insert
to authenticated
with check (public.has_merchant_access(merchant_id));

commit;
