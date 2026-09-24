-- Perfil fiscal privado e caixa de NF-e. Certificado, senha, CPF/CNPJ e XML
-- devem ser armazenados cifrados pela aplicação antes de chegar ao banco.
begin;

create table if not exists public.merchant_fiscal_profiles (
  merchant_id uuid primary key references public.merchants(id) on delete cascade,
  tax_id_ciphertext text,
  tax_id_type text check (tax_id_type is null or tax_id_type in ('CPF', 'CNPJ')),
  certificate_ciphertext text,
  certificate_password_ciphertext text,
  certificate_file_name text,
  last_nsu text not null default '000000000000000',
  last_query_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint merchant_fiscal_profile_certificate_pair check (
    (certificate_ciphertext is null and certificate_password_ciphertext is null and certificate_file_name is null)
    or (certificate_ciphertext is not null and certificate_password_ciphertext is not null and certificate_file_name is not null)
  )
);

alter table public.merchant_fiscal_profiles enable row level security;
alter table public.merchant_fiscal_profiles force row level security;
revoke all on public.merchant_fiscal_profiles from anon, authenticated;
grant select, insert, update, delete on public.merchant_fiscal_profiles to authenticated;
drop policy if exists merchant_fiscal_profiles_owner_all on public.merchant_fiscal_profiles;
create policy merchant_fiscal_profiles_owner_all on public.merchant_fiscal_profiles
  for all to authenticated
  using (public.is_merchant_owner(merchant_id))
  with check (public.is_merchant_owner(merchant_id));

create table if not exists public.merchant_received_invoices (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  access_key text not null check (access_key ~ '^\d{44}$'),
  invoice_number text,
  series text,
  issuer_name text,
  issuer_tax_id text,
  issued_at timestamptz,
  total_amount numeric(14,2),
  status text not null default 'available' check (status in ('available', 'xml_requested', 'ready_for_review', 'entered', 'ignored')),
  summary_xml_ciphertext text,
  full_xml_ciphertext text,
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, access_key)
);

create index if not exists merchant_received_invoices_recent_ix
  on public.merchant_received_invoices (merchant_id, issued_at desc nulls last);
alter table public.merchant_received_invoices enable row level security;
alter table public.merchant_received_invoices force row level security;
revoke all on public.merchant_received_invoices from anon, authenticated;
grant select, insert, update on public.merchant_received_invoices to authenticated;
drop policy if exists merchant_received_invoices_owner_select on public.merchant_received_invoices;
create policy merchant_received_invoices_owner_select on public.merchant_received_invoices
  for select to authenticated using (public.is_merchant_owner(merchant_id));
drop policy if exists merchant_received_invoices_owner_insert on public.merchant_received_invoices;
create policy merchant_received_invoices_owner_insert on public.merchant_received_invoices
  for insert to authenticated with check (public.is_merchant_owner(merchant_id));
drop policy if exists merchant_received_invoices_owner_update on public.merchant_received_invoices;
create policy merchant_received_invoices_owner_update on public.merchant_received_invoices
  for update to authenticated using (public.is_merchant_owner(merchant_id))
  with check (public.is_merchant_owner(merchant_id));

commit;
