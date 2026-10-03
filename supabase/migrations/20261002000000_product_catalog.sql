-- Base de referencia de produtos (dados publicos) + medicamentos CMED.
-- Fontes: Open Food Facts (ODbL) e CMED/Anvisa. Ver docs/catalog/README.md.

create table if not exists public.product_catalog (
  ean text primary key,
  name text not null,
  brand text,
  category text,
  quantity text,
  image_url text,
  source text not null default 'qerbie'
    check (source in ('openfoodfacts','qerbie')),
  source_updated_at timestamptz,
  attribution text,
  created_at timestamptz not null default now()
);

create index if not exists product_catalog_name_idx
  on public.product_catalog using gin (to_tsvector('portuguese', name));
create index if not exists product_catalog_source_idx on public.product_catalog (source);

create table if not exists public.pharmacy_cmed (
  id bigint generated always as identity primary key,
  ean text not null,
  registro text not null default '',
  substancia text,
  produto text not null,
  apresentacao text,
  laboratorio text,
  cnpj text,
  classe_terapeutica text,
  tipo_produto text,
  regime_preco text,
  tarja text,
  pf_sem_impostos numeric(12,2),
  pmc_sem_impostos numeric(12,2),
  pmc_18 numeric(12,2),
  source text not null default 'cmed',
  source_updated_at date,
  created_at timestamptz not null default now(),
  unique (ean, registro)
);

create index if not exists pharmacy_cmed_ean_idx on public.pharmacy_cmed (ean);
create index if not exists pharmacy_cmed_produto_idx
  on public.pharmacy_cmed using gin (to_tsvector('portuguese', produto || ' ' || coalesce(substancia,'')));

-- Leitura para usuarios logados; escrita so via service role (script de import).
alter table public.product_catalog enable row level security;
alter table public.pharmacy_cmed enable row level security;

drop policy if exists product_catalog_read on public.product_catalog;
create policy product_catalog_read on public.product_catalog
  for select to authenticated using (true);
drop policy if exists pharmacy_cmed_read on public.pharmacy_cmed;
create policy pharmacy_cmed_read on public.pharmacy_cmed
  for select to authenticated using (true);
