-- Qerbie / Supabase Schema
-- Version: 001_init
-- Purpose: Baseline extensions & shared utilities.

begin;

-- UUID generation used across the schema.
create extension if not exists pgcrypto;

-- Case-insensitive text for slugs and identifiers.
create extension if not exists citext;

-- Shared trigger function for updated_at.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

commit;
