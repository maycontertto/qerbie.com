-- Qerbie / Supabase Schema
-- Version: 019_merchant_welcome_message
-- Purpose: Add configurable customer welcome message for merchants.

begin;

alter table public.merchants
add column if not exists customer_welcome_message text;

-- Guardrail: keep it short for UI.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'merchants_customer_welcome_message_len'
  ) then
    alter table public.merchants
    add constraint merchants_customer_welcome_message_len
    check (customer_welcome_message is null or char_length(customer_welcome_message) <= 240);
  end if;
end
$$;

commit;
