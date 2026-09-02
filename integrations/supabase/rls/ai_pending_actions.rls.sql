-- Qerbie / Supabase RLS Policies
-- Table: public.ai_pending_actions

begin;

alter table public.ai_pending_actions enable row level security;
alter table public.ai_pending_actions force row level security;

revoke all on table public.ai_pending_actions from anon;
revoke all on table public.ai_pending_actions from authenticated;

grant select, insert, update on table public.ai_pending_actions to authenticated;

-- Leitura: qualquer membro com acesso ao merchant pode ver (auditoria/histórico).
drop policy if exists ai_pending_actions_auth_select on public.ai_pending_actions;
create policy ai_pending_actions_auth_select
on public.ai_pending_actions
for select
to authenticated
using (public.has_merchant_access(merchant_id));

-- Criação: só o próprio usuário autenticado pode propor uma ação em seu nome,
-- nunca em nome de outro usuário do mesmo merchant.
drop policy if exists ai_pending_actions_auth_insert on public.ai_pending_actions;
create policy ai_pending_actions_auth_insert
on public.ai_pending_actions
for insert
to authenticated
with check (public.has_merchant_access(merchant_id) and user_id = (select auth.uid()));

-- Confirmação/rejeição: só quem propôs a ação pode resolvê-la — a IA nunca
-- deve executar em nome de uma confirmação de outra pessoa.
drop policy if exists ai_pending_actions_auth_update on public.ai_pending_actions;
create policy ai_pending_actions_auth_update
on public.ai_pending_actions
for update
to authenticated
using (public.has_merchant_access(merchant_id) and user_id = (select auth.uid()))
with check (public.has_merchant_access(merchant_id) and user_id = (select auth.uid()));

commit;
