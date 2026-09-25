-- Version: 060_private_records_rls_hardening
-- Purpose: tenant-scope purchasing, gym/private records, and QR bearer tokens.

begin;

do $$
declare
  table_name text;
  policy_name text;
  policy_row record;
  tenant_tables text[] := array[
    'merchant_tables',
    'aesthetic_qr_tokens', 'beauty_qr_tokens', 'barbershop_qr_tokens',
    'carwash_qr_tokens', 'pet_qr_tokens', 'gym_qr_tokens',
    'gym_students', 'gym_memberships', 'gym_payments', 'gym_checkins',
    'gym_access_logs', 'gym_face_profiles', 'gym_fingerprint_templates'
  ];
begin
  foreach table_name in array tenant_tables loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format(
      'revoke all on table public.%I from public, anon, authenticated',
      table_name
    );
    execute format(
      'grant select, insert, update, delete on table public.%I to authenticated',
      table_name
    );

    -- Remove any stale permissive rules before installing tenant rules.
    for policy_row in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = table_name
    loop
      execute format('drop policy %I on public.%I', policy_row.policyname, table_name);
    end loop;

    policy_name := table_name || '_auth_select';
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.has_merchant_access(merchant_id))',
      policy_name, table_name
    );

    policy_name := table_name || '_auth_insert';
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.has_merchant_access(merchant_id))',
      policy_name, table_name
    );

    policy_name := table_name || '_auth_update';
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.has_merchant_access(merchant_id)) with check (public.has_merchant_access(merchant_id))',
      policy_name, table_name
    );

    policy_name := table_name || '_auth_delete';
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_merchant_owner(merchant_id))',
      policy_name, table_name
    );
  end loop;

  -- Purchases contain invoice access keys, supplier details, quantities and
  -- unit costs. The app reads these with the merchant session; writes run via
  -- the owner-checked SECURITY DEFINER record_purchase_entry function.
  foreach table_name in array array['purchase_entries', 'purchase_entry_items'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'revoke all on table public.%I from public, anon, authenticated',
      table_name
    );
    execute format('grant select on table public.%I to authenticated', table_name);

    for policy_row in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = table_name
    loop
      execute format('drop policy %I on public.%I', policy_row.policyname, table_name);
    end loop;

    policy_name := table_name || '_auth_select';
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.has_merchant_access(merchant_id))',
      policy_name, table_name
    );
  end loop;
end $$;

commit;
