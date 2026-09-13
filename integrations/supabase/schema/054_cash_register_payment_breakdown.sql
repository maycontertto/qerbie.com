-- Qerbie / Supabase Schema
-- Version: 054_cash_register_payment_breakdown
-- Purpose: Conferência de fechamento separada por forma de pagamento.
-- Depends on: 053_cash_register

begin;

alter table public.cash_register_sessions
  add column if not exists expected_cash_amount numeric(12,2),
  add column if not exists counted_cash_amount numeric(12,2),
  add column if not exists expected_pix_amount numeric(12,2),
  add column if not exists counted_pix_amount numeric(12,2),
  add column if not exists expected_card_amount numeric(12,2),
  add column if not exists counted_card_amount numeric(12,2),
  add column if not exists expected_other_amount numeric(12,2),
  add column if not exists counted_other_amount numeric(12,2);

commit;