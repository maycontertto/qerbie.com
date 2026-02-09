-- 018_support_contact.sql
-- Suporte & Contato: WhatsApp, horário e contatos opcionais.

alter table public.merchants
  add column if not exists support_whatsapp_url text,
  add column if not exists support_hours text,
  add column if not exists support_email text,
  add column if not exists support_phone text;
